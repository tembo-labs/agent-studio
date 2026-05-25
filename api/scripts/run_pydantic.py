"""Pydantic AI runner wrapper invoked by api/src/runs/pydantic.rs.

Reads a Pydantic AgentSpec (YAML or JSON) from stdin, runs the
agent against the user message passed on the CLI, and prints the
result to stdout. Mirrors the cargo-ai shellout shape so the Rust
runner has parallel knobs for both frameworks.

Auth: provider API keys come in via environment variables the
caller sets before spawn (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.).
pydantic-ai picks them up from the provider's SDK conventionally —
no constructor wiring needed.

stdout protocol: free-form agent output, followed by a single
sentinel line `__TAS_USAGE__:{...json...}` carrying usage counts
when pydantic-ai reports them. The Rust runner strips the
sentinel before writing the user-facing transcript and feeds the
JSON into the run row's token columns.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import traceback

import yaml
from pydantic_ai import Agent


USAGE_SENTINEL = "__TAS_USAGE__:"


def parse_spec(content: str, fmt: str) -> dict:
    if fmt == "yaml":
        loaded = yaml.safe_load(content)
    elif fmt == "json":
        loaded = json.loads(content)
    else:
        raise ValueError(f"unsupported spec format: {fmt!r}")
    if not isinstance(loaded, dict):
        raise ValueError("AgentSpec must parse to a top-level object")
    return loaded


def usage_payload(usage_obj) -> dict:
    """Pull whatever fields pydantic-ai reports into a flat dict.

    The Usage object's exact attribute set has shifted across
    pydantic-ai versions; we read defensively so a minor upstream
    rename doesn't crash the runner — the Rust side treats missing
    fields as None.
    """
    if usage_obj is None:
        return {}
    out = {}
    for attr in (
        "input_tokens",
        "output_tokens",
        "request_tokens",
        "response_tokens",
        "total_tokens",
        "requests",
    ):
        val = getattr(usage_obj, attr, None)
        if val is not None:
            out[attr] = val
    return out


async def run(spec: dict, user_message: str) -> None:
    agent = Agent.from_spec(spec)
    # run_sync would block the event loop; use the async path so
    # we play nicely with pydantic-ai's internals.
    result = await agent.run(user_message)
    # `.output` is the model's structured result (string for default
    # output_type=str, or a pydantic model otherwise). str() coerces
    # the model case into something readable for the run row;
    # downstream we can route structured output through a sentinel
    # if a customer asks for it.
    sys.stdout.write(str(result.output))
    sys.stdout.write("\n")
    usage = usage_payload(getattr(result, "usage", None))
    if usage:
        sys.stdout.write(f"{USAGE_SENTINEL}{json.dumps(usage)}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a Pydantic AI AgentSpec.")
    parser.add_argument(
        "--fmt",
        choices=("yaml", "json"),
        required=True,
        help="Spec content format (the Rust caller knows this from the file extension).",
    )
    parser.add_argument(
        "--user-message",
        default="",
        help="Freeform user input to pass as the agent's prompt.",
    )
    args = parser.parse_args()

    content = sys.stdin.read()

    try:
        spec = parse_spec(content, args.fmt)
    except Exception as e:
        sys.stderr.write(f"failed to parse spec: {e}\n")
        return 2

    # Pydantic AI's run loop wants a non-empty prompt. Match the
    # Rust-side default we used to use for the hand-rolled path so
    # behavior doesn't shift for existing agents.
    prompt = args.user_message if args.user_message else "Hello."

    try:
        asyncio.run(run(spec, prompt))
    except Exception as e:
        # Print the traceback to stderr so the run row's
        # error_message has actionable context, then exit non-zero
        # so the Rust runner marks the run as failed.
        traceback.print_exc(file=sys.stderr)
        sys.stderr.write(f"\npydantic-ai run failed: {e}\n")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())

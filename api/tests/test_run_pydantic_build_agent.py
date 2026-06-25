from __future__ import annotations

import sys
from pathlib import Path

import pytest
from pydantic_ai import Agent

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts import run_pydantic


@pytest.fixture(autouse=True)
def provider_api_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-anthropic-key")
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")


@pytest.mark.parametrize(
    "spec",
    [
        {
            "name": "anthropic-basic",
            "model": "anthropic:claude-sonnet-4-5",
            "instructions": "Reply briefly.",
        },
        {
            "name": "openai-basic",
            "model": "openai:gpt-5-mini",
            "instructions": "Reply briefly.",
        },
        {
            "name": "anthropic-settings",
            "model": "anthropic:claude-sonnet-4-5",
            "instructions": "Reply briefly.",
            "model_settings": {
                "temperature": 0,
                "parallel_tool_calls": True,
            },
        },
    ],
)
def test_build_agent_constructs_provider_models(spec: dict) -> None:
    assert isinstance(run_pydantic.build_agent(spec), Agent)


def test_build_agent_constructs_with_tools_module() -> None:
    tools = run_pydantic.load_tools_module(
        """
def echo(message: str) -> str:
    \"\"\"Return the provided message.\"\"\"
    return message

tools = [echo]
"""
    )

    agent = run_pydantic.build_agent(
        {
            "name": "openai-tools",
            "model": "openai:gpt-5-mini",
            "instructions": "Use the echo tool when helpful.",
            "tools_module": "agent_tools.py",
        },
        tools=tools,
    )

    assert isinstance(agent, Agent)


def test_build_capabilities_maps_websearch() -> None:
    from pydantic_ai.capabilities import WebSearch

    # Bare-name form and single-key-map form both map to the WebSearch capability.
    for caps in (["WebSearch"], [{"WebSearch": {}}], ["web_search"]):
        built = run_pydantic._build_capabilities({"capabilities": caps})
        assert len(built) == 1
        assert isinstance(built[0], WebSearch)


def test_build_capabilities_ignores_unknown_and_empty() -> None:
    # Unwired capabilities (handled elsewhere) and absent/empty lists yield none,
    # and never raise — a typo must not break agent construction.
    assert run_pydantic._build_capabilities({}) == []
    assert run_pydantic._build_capabilities({"capabilities": []}) == []
    assert run_pydantic._build_capabilities({"capabilities": ["Thinking"]}) == []
    assert run_pydantic._build_capabilities({"capabilities": "WebSearch"}) == []


def test_build_agent_attaches_websearch_capability() -> None:
    agent = run_pydantic.build_agent(
        {
            "name": "searcher",
            "model": "anthropic:claude-sonnet-4-5",
            "instructions": "Search the web when current info is needed.",
            "capabilities": ["WebSearch"],
        }
    )
    assert isinstance(agent, Agent)


def test_uncached_input_excludes_cache_halves() -> None:
    from types import SimpleNamespace

    # The real run that overstated cost ~6x: input_tokens is the TOTAL incl. cache.
    u = SimpleNamespace(
        input_tokens=940477, cache_read_tokens=938547, cache_write_tokens=1929
    )
    assert run_pydantic._uncached_input(u) == 940477 - 938547 - 1929  # == 1

    # No caching reported → uncached == input.
    assert run_pydantic._uncached_input(
        SimpleNamespace(input_tokens=5000)
    ) == 5000

    # Clamp at 0; None input → None.
    assert run_pydantic._uncached_input(
        SimpleNamespace(input_tokens=100, cache_read_tokens=200)
    ) == 0
    assert run_pydantic._uncached_input(SimpleNamespace()) is None

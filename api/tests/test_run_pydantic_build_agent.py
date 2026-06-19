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

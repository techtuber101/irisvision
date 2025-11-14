#!/usr/bin/env python3
"""
Utility to inspect the context-building pipeline for a given thread.

Usage:
    python backend/scripts/diagnose_context_pipeline.py --thread THREAD_ID
"""

import argparse
import asyncio
from typing import Optional, Dict, Any

from core.utils.config import config
from core.services.supabase import DBConnection
from core.agentpress.context_planner import get_project_context
from core.agentpress.context_builder import (
    build_minimal_context,
    SYSTEM_INSTRUCTION_BRIEF,
    read_runtime_state,
)
from core.agentpress.context_retriever import assemble_retrieval_block


async def _get_latest_user_message(thread_id: str) -> Optional[str]:
    db = DBConnection()
    client = await db.client
    result = (
        await client.table("messages")
        .select("content, type")
        .eq("thread_id", thread_id)
        .eq("type", "user")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if result.data and len(result.data) > 0:
        row = result.data[0]
        content = row.get("content")
        if isinstance(content, list) and content:
            return content[0].get("text") if isinstance(content[0], dict) else str(content)
        if isinstance(content, dict):
            return content.get("text") or str(content)
        return str(content)
    return None


async def run_diagnostics(thread_id: str, user_override: Optional[str]) -> None:
    db = DBConnection()
    client = await db.client
    project_context = await get_project_context(thread_id, client)
    kv_store = project_context.get("kv_store")
    sandbox = project_context.get("sandbox")

    latest_user = user_override or await _get_latest_user_message(thread_id) or "(no recent user message)"
    runtime_state = read_runtime_state()

    minimal = build_minimal_context(
        user_message=latest_user,
        system_instructions=SYSTEM_INSTRUCTION_BRIEF,
        task_state=runtime_state.get("tasks"),
    )

    print("=== Minimal Context Decisions ===")
    for key, value in minimal.decisions.items():
        print(f"{key}: {value}")
    print("\nAssistant summaries:", minimal.assistant_summaries)

    retrieval_block = await assemble_retrieval_block(
        kv_store=kv_store,
        decisions=minimal.decisions,
        sandbox=sandbox,
    )
    print("\n=== Retrieval Block Preview ===")
    if retrieval_block:
        print(retrieval_block[:800])
    else:
        print("(empty)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Diagnose context builder/retriever pipeline")
    parser.add_argument("--thread", required=True, help="Thread ID to inspect")
    parser.add_argument("--user-message", help="Override latest user message")
    args = parser.parse_args()

    print(f"USE_KV_CACHE_PROMPT={config.USE_KV_CACHE_PROMPT}")
    asyncio.run(run_diagnostics(args.thread, args.user_message))


if __name__ == "__main__":
    main()

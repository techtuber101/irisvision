import os
import sys
import types
import json
import pytest

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "jwt-secret")
os.environ.setdefault("REDIS_HOST", "localhost")
os.environ.setdefault("DAYTONA_API_KEY", "daytona-key")
os.environ.setdefault("DAYTONA_SERVER_URL", "https://daytona.local")
os.environ.setdefault("DAYTONA_TARGET", "local-target")
os.environ.setdefault("TAVILY_API_KEY", "tavily-key")
os.environ.setdefault("RAPID_API_KEY", "rapid-key")
os.environ.setdefault("FIRECRAWL_API_KEY", "firecrawl-key")


class _DummyAsyncClient:
    async def table(self, *args, **kwargs):
        raise RuntimeError("DB access not supported in unit tests")


async def _dummy_create_async_client(*args, **kwargs):
    return _DummyAsyncClient()


supabase_stub = types.ModuleType("supabase")
supabase_stub.create_async_client = _dummy_create_async_client
supabase_stub.AsyncClient = _DummyAsyncClient
sys.modules.setdefault("supabase", supabase_stub)

langfuse_module = types.ModuleType("langfuse")
langfuse_client_module = types.ModuleType("langfuse.client")


class _DummyLangfuseClient:
    def __init__(self, *args, **kwargs):
        pass

    def trace(self, *args, **kwargs):
        return self

    def event(self, *args, **kwargs):
        return None

    def update(self, *args, **kwargs):
        return None


langfuse_client_module.StatefulTraceClient = _DummyLangfuseClient
langfuse_client_module.StatefulGenerationClient = _DummyLangfuseClient
langfuse_module.client = langfuse_client_module
langfuse_module.Langfuse = _DummyLangfuseClient
sys.modules.setdefault("langfuse", langfuse_module)
sys.modules.setdefault("langfuse.client", langfuse_client_module)

dramatiq_stub = types.ModuleType("dramatiq")
sys.modules.setdefault("dramatiq", dramatiq_stub)

sentry_dramatiq_stub = types.ModuleType("sentry_sdk.integrations.dramatiq")


class _DummyDramatiqIntegration:
    def __init__(self, *args, **kwargs):
        pass


sentry_dramatiq_stub.DramatiqIntegration = _DummyDramatiqIntegration
sys.modules.setdefault("sentry_sdk.integrations.dramatiq", sentry_dramatiq_stub)
from core.services.memory_store_local import get_memory_store
from core.agentpress.thread_manager import ThreadManager
from core.agentpress.context_manager import ContextManager
from core.tools.memory_fetch_tool import MemoryFetchTool


@pytest.mark.asyncio
async def test_memory_store_local_roundtrip():
    store = get_memory_store()
    text = "\n".join(f"line-{i}" for i in range(1, 101))
    info = store.put_text(text, type="TOOL_OUTPUT", subtype="test", title="unit-test")

    fetched = store.get_slice(info["memory_id"], 10, 40)
    expected = "\n".join(f"line-{i}" for i in range(10, 41))
    assert fetched == expected


@pytest.mark.asyncio
async def test_pointer_message_shape():
    tm = ThreadManager()
    large_payload = {"role": "tool", "content": "DATA\n" * 2000}

    processed = await tm._offload_if_large("thread-test", "tool", large_payload, metadata=None)

    assert "memory_refs" in processed
    assert processed["memory_refs"][0]["id"]
    assert processed["content"].endswith("[see memory_refs]")
    assert processed["tokens_saved"] > 0


@pytest.mark.asyncio
async def test_context_manager_no_hydrate():
    context_manager = ContextManager()
    message = {
        "role": "tool",
        "content": {
            "content": "Summary snippet",
            "memory_refs": [{"id": "abc123", "title": "fixture", "mime": "text/plain"}],
        },
    }
    compressed, _report = await context_manager.compress_messages(
        [message],
        llm_model="gpt-5",
        pointer_mode=True,
        return_report=True,
    )

    assert compressed[0]["content"]["memory_refs"][0]["id"] == "abc123"
    assert "Summary snippet" in compressed[0]["content"]["content"]


@pytest.mark.asyncio
async def test_memory_fetch_tool_range_limits():
    tm = ThreadManager()
    tool = MemoryFetchTool(thread_manager=tm)
    store = get_memory_store()

    text = "\n".join(f"line-{i}" for i in range(1, 501))
    info = store.put_text(text, type="TOOL_OUTPUT", subtype="fixture", title="fixture-text")

    result = await tool.memory_fetch(memory_id=info["memory_id"], line_start=5, line_end=15)
    payload = json.loads(result.output)
    assert payload["pointer"].startswith("mem://")
    assert payload["memory_refs"][0]["id"] == info["memory_id"]

    too_many_lines = await tool.memory_fetch(memory_id=info["memory_id"], line_start=1, line_end=500)
    assert not too_many_lines.success

    bytes_info = store.put_bytes(
        b"x" * 1024,
        type="TOOL_OUTPUT",
        subtype="fixture-bytes",
        title="fixture-bytes",
        compress=False,
    )
    too_many_bytes = await tool.memory_fetch(memory_id=bytes_info["memory_id"], byte_offset=0, byte_len=70000)
    assert not too_many_bytes.success


def test_token_governor_paths():
    tm = ThreadManager()
    system_prompt = {"role": "system", "content": "You are a helpful agent."}

    short_messages = [{"role": "user", "content": "hello"}]
    governed_short = tm._apply_token_governor(system_prompt, short_messages, "gpt-5")
    assert governed_short == short_messages

    large_text = "word " * 25000  # ~25k tokens
    large_messages = [{"role": "user", "content": large_text}]
    governed_large = tm._apply_token_governor(system_prompt, large_messages, "gpt-5")
    assert governed_large[-1].get("token_governor")
    assert "Context budget high" in governed_large[-1]["content"]

    huge_text = "token " * 50000  # ~50k tokens
    huge_messages = [{"role": "user", "content": huge_text}]
    governed_huge = tm._apply_token_governor(system_prompt, huge_messages, "gpt-5")
    assert governed_huge[-1].get("token_governor")
    assert "Context budget critical" in governed_huge[-1]["content"]

# KV Cache Wiring Gap Analysis

## User's Discovery

> "in .iris folder i saw only the kvcache/instructions folder. is there nothing else thats being passed on and saved in the files like context of the chat tool outputs etc etc all the various things"

## Root Cause Found

### What's Working ✅
- Instruction seeding happens on sandbox init
- `/workspace/.iris/kv-cache/instructions/` gets populated with MD files

### What's NOT Working ❌

**1. Conversation Summaries NOT Cached**
- Location: Should be in `/workspace/.iris/kv-cache/task/summary_*`
- Status: ❌ Never created
- Reason: ContextManager not receiving kv_store parameter

**2. Tool Outputs NOT Cached**
- Location: Should be in `/workspace/.iris/kv-cache/artifacts/`
- Status: ❌ Never created
- Reason: Tools not configured to use KV cache for outputs

**3. Project Context NOT Cached**
- Location: Should be in `/workspace/.iris/kv-cache/project/`
- Status: ❌ Never created
- Reason: No project summary being stored

## The Wiring Gap

### Current Code (thread_manager.py line 376)
```python
context_manager = ContextManager()  # ❌ No kv_store!
```

### What I Added to ContextManager
```python
def __init__(self, token_threshold: int = DEFAULT_TOKEN_THRESHOLD, 
             kv_store: Optional[SandboxKVStore] = None):
    self.kv_store = kv_store
    self._cache_enabled = kv_store is not None  # ❌ Always False!
```

### The Problem
Since `kv_store` is never passed, `_cache_enabled = False`, so:
- `_get_cached_summary()` always returns None
- `_store_summary_cache()` does nothing
- Conversation summaries never cached

## What Needs to Be Wired

### 1. ThreadManager → ContextManager Connection
**File:** `backend/core/agentpress/thread_manager.py`
**Change Needed:**
```python
# Current (line 376):
context_manager = ContextManager()

# Should be:
if hasattr(self, 'kv_store') and self.kv_store:
    context_manager = ContextManager(kv_store=self.kv_store)
else:
    context_manager = ContextManager()  # Fallback
```

### 2. AgentRunner → ThreadManager Connection
**File:** `backend/core/run.py`
**Change Needed:**
```python
# Current (line 527):
self.thread_manager = ThreadManager(
    trace=self.config.trace,
    agent_config=self.config.agent_config
)

# Should be:
self.thread_manager = ThreadManager(
    trace=self.config.trace,
    agent_config=self.config.agent_config,
    project_id=self.config.project_id  # Add this!
)
```

### 3. ThreadManager Init
**File:** `backend/core/agentpress/thread_manager.py`
**Change Needed:**
```python
# Current (line 70):
def __init__(self, trace: Optional[StatefulTraceClient] = None, 
             agent_config: Optional[dict] = None):
    self.db = DBConnection()
    self.tool_registry = ToolRegistry()
    self.trace = trace
    self.agent_config = agent_config

# Should be:
def __init__(self, trace: Optional[StatefulTraceClient] = None,
             agent_config: Optional[dict] = None,
             project_id: Optional[str] = None):
    self.db = DBConnection()
    self.tool_registry = ToolRegistry()
    self.trace = trace
    self.agent_config = agent_config
    self.project_id = project_id
    
    # Initialize KV store if project_id available
    self.kv_store = None
    if project_id:
        try:
            from core.sandbox.sandbox import get_sandbox_for_project
            sandbox = await get_sandbox_for_project(project_id)
            from core.sandbox.kv_store import SandboxKVStore
            self.kv_store = SandboxKVStore(sandbox)
            logger.info(f"✅ KV cache enabled for project {project_id}")
        except Exception as e:
            logger.warning(f"KV cache unavailable: {e}")
```

## Additional Missing Wiring

### 4. Tool Outputs → KV Cache
**Current:** Tool outputs stored in database only
**Should:** Also cache in `/workspace/.iris/kv-cache/artifacts/`

### 5. Project Summaries → KV Cache
**Current:** Not implemented
**Should:** Store in `/workspace/.iris/kv-cache/project/summary.md`

### 6. Web Search Results → KV Cache
**Current:** Not cached
**Should:** Cache in `/workspace/.iris/kv-cache/artifacts/search_*`

## Impact of Missing Wiring

| Feature | Infrastructure | Wiring | Functional |
|---------|---------------|--------|------------|
| Instruction seeding | ✅ | ✅ | ✅ |
| Conversation summaries | ✅ | ❌ | ❌ |
| Tool outputs | ✅ | ❌ | ❌ |
| Project context | ✅ | ❌ | ❌ |
| Artifacts | ✅ | ❌ | ❌ |

**Summary:** Infrastructure is 100% complete, but only 20% wired up and functional!

## What User Should See (But Doesn't)

```
/workspace/.iris/kv-cache/
├── instructions/          ✅ EXISTS (seeded on init)
│   ├── presentation__abc.md
│   ├── research__def.md
│   └── .index.json
├── task/                  ❌ MISSING (not wired)
│   ├── summary_msg123.json
│   ├── summary_msg124.json
│   └── .index.json
├── project/               ❌ MISSING (not wired)
│   ├── summary.md
│   └── .index.json
├── artifacts/             ❌ MISSING (not wired)
│   ├── search_result_xyz.json
│   ├── generated_code_abc.py
│   └── .index.json
└── system/                ❌ MISSING (not wired)
    └── .index.json
```

## Summary

**Infrastructure:** ✅ 100% Complete  
**Wiring:** ❌ 20% Complete (only instructions)  
**Functional:** ❌ 20% Working

The KV cache system is built but not connected. It's like having a fully functional car with the engine not bolted to the chassis!

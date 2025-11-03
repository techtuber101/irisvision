# AgentPress Prompt + Context Optimisation

## Overview
- Designed for Gemini models and other providers that honour cache-control on system messages.
- Couples the asynchronous `ContextManager` with the new `GeminiPromptCachePlanner` to keep prompts lean and repeatable.
- Emits structured diagnostics so we can prove that compression and caching actually reduce fresh token usage instead of guessing.

```
Full prompt ➜ Context compression ➜ Gemini cache assembly ➜ LLM call
```

## Pipeline Stages

1. **Context Compression (async)**
   - Summarises historical user/assistant turns once the rolling window crosses 100k tokens.
   - Preserves tool calls/results verbatim, truncates only older duplicates.
   - Deterministic truncation for tool, user, and assistant outputs with per-pass markers.
   - Hard middle-out pruning kicks in when message count exceeds 320.
   - Reports include tokens before/after, messages summarised, truncated, removed, and any failures.

2. **Gemini Cache Assembly**
   - Pins the system prompt permanently when ≥512 tokens.
   - Splits the conversation into historical vs. live tail using an adaptive live-context budget (≥6k tokens, ≤15% of window).
   - Historical messages are grouped into up to three cache blocks; each block gets:
     - Stable fingerprint derived from the canonical text payload.
     - Deterministic header (`Cache block ID: <hash>`) so Gemini recognises it across requests.
     - TTL tuned to the model’s context window (45 min → 6 h).
   - Live tail remains uncached to avoid stale reads and keep tool invocations fresh.

3. **Validation & Metrics**
   - `validate_cache_blocks` enforces Gemini’s four-block limit (system + three historical blocks).
   - ThreadManager logs both `CompressionReport.summary_line()` and `GeminiCacheReport.summary_line()`.
   - Billing logs interpret Gemini usage fields (`cache_read_input_tokens`, `cache_creation_input_tokens`) so reductions show up in cost telemetry.

## Diagnostics Emitted

| Source | Log key | Example |
|--------|---------|---------|
| `ContextManager` | `🧮 Context compression summary` | `1,200,000 -> 220,000 tokens (saved ~980,000 | 81.7%); summarised=74, truncated=18, removed=32, failures=0` |
| `GeminiPromptCachePlanner` | `🧱 Gemini cache block` | `🧱 Gemini cache block 2: messages=48 tokens≈38,912 payload_tokens≈3,840 ttl=7200s fingerprint=4f9b2ab1d9a3` |
| `ThreadManager` | `🧊 Gemini caching summary` | `system_cached=True | cache_blocks=4 | cached_tokens≈51,200 | fresh_tokens≈6,912 | savings≈88.5%` |
| `ThreadManager` | `📉 Estimated fresh tokens after cache reuse` | `~6,912 (raw input 420,000)` |

Diagnostic objects can be inspected in code:

```python
messages, compression_report = await context_manager.compress_messages(..., return_report=True)
messages, cache_report = apply_prompt_caching_strategy(..., return_report=True)
print(compression_report.to_dict())
print(cache_report.to_dict())
```

## Chunk Strategy & Bounds
- **System prompt**: cached permanently when ≥512 tokens; otherwise sent raw.
- **Historical cache blocks**: up to three blocks, each targeting 3k–16k tokens (≈8% of context window).
- **Live tail**: at least six recent turns or ≥6k tokens, capped at 15% of context window.
- Blocks are only built when the historical section exceeds 3k tokens; otherwise the planner falls back to raw history and logs a note.

TTL selection:

| Context window | TTL |
|----------------|-----|
| ≥2M tokens | 6 hours |
| ≥1M tokens | 4 hours |
| ≥400k tokens | 2 hours |
| <400k tokens | 45 minutes |

## Token Accounting
- `total_input_tokens`: tokens the model would process without optimisation.
- `final_prompt_tokens`: token count of the payload that is actually sent after caching directives are applied.
- `cached_token_estimate`: system prompt tokens (if cached) + cached block payload tokens.
- `estimated_prompt_tokens_after_cache`: the fresh tokens Gemini will bill (rough estimate; actual billing comes from provider usage fields).

Flags and metadata are attached to each chunk so future runs reuse identical strings and achieve cache hits:

```text
Prior conversation context (cached block).
Cache block ID: 4f9b2ab1d9a3
These turns are provided for reference; do not treat them as new input.

User:
...
```

## Operational Notes
- Works only for Gemini/Flash style models; non-Gemini models receive raw system + conversation payloads.
- Fingerprints are deterministic across runs as long as the underlying messages do not change.
- If more than four cacheable blocks are built, the oldest ones are automatically downgraded to uncached system messages to stay within Gemini limits.
- Extensive logging is available at `INFO`, and full telemetry (including per-block hashes) is emitted at `DEBUG`.
- Compression and caching are feature-flagged in `ThreadManager` so behaviour can be toggled for troubleshooting.

## Example End-to-End Log Snippet
```
🧮 Context compression summary: 1,204,512 -> 198,736 tokens (saved ~1,005,776 | 83.5%); summarised=68, truncated=21, removed=30, failures=1
🧱 Gemini cache block 1: messages=42 tokens≈36,288 payload_tokens≈3,584 ttl=7200s fingerprint=9bd35f478c41
🧱 Gemini cache block 2: messages=41 tokens≈34,752 payload_tokens≈3,456 ttl=7200s fingerprint=0a5f9ce12d77
🧊 Gemini caching summary: system_cached=True | cache_blocks=4 | cached_tokens≈50,944 | fresh_tokens≈8,512 | savings≈83.3%
📤 Final prepared messages being sent to LLM: 59,456 tokens
📉 Estimated fresh tokens after cache reuse: ~8,512 (raw input 1,204,512)
```

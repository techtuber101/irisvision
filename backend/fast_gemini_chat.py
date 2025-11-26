"""
Fast Gemini 2.5 Flash Chat Endpoint
Super simple, super fast streaming chat with Gemini
"""
import os
import json
import re
import time
from enum import Enum
from typing import AsyncGenerator, Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import google.generativeai as genai
from core.utils.config import config
from core.utils.logger import logger
from core.utils.auth_utils import verify_and_get_user_id_from_jwt, get_optional_user_id
from core.agentpress.thread_manager import ThreadManager
from core.agentpress.context_manager import ContextManager
from litellm.utils import token_counter

router = APIRouter()

# Configure Gemini
genai.configure(api_key=config.GEMINI_API_KEY)

class Attachment(BaseModel):
    mime_type: str
    data: str
    name: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    model: str = "gemini-2.5-flash"  # Default to stable Gemini model
    system_instructions: Optional[str] = None
    chat_context: Optional[List[Dict[str, str]]] = None
    attachments: Optional[List[Attachment]] = None
    thread_id: Optional[str] = None  # Thread ID to load messages from for context

class ChatResponse(BaseModel):
    response: str
    time_ms: float


class AdaptiveDecisionState(str, Enum):
    AGENT_NEEDED = "agent_needed"
    AGENT_NOT_NEEDED = "agent_not_needed"
    ASK_USER = "ask_user"


class AdaptiveAskUserPrompt(BaseModel):
    prompt: str = "Would you like me to continue in Iris Intelligence mode?"
    yes_label: str = "Yes"
    no_label: str = "No, I'm fine"


class AdaptiveDecision(BaseModel):
    state: AdaptiveDecisionState
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    reason: str
    agent_preface: Optional[str] = None
    ask_user: Optional[AdaptiveAskUserPrompt] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AdaptiveChatResponse(BaseModel):
    response: str
    decision: AdaptiveDecision
    time_ms: float


QUICK_CHAT_SYSTEM_PROMPT = """You are Iris Quick Chat.
- Provide concise, beautifully formatted answers with markdown tables/lists as needed.
- NEVER mention internal routing, agent modes, or tool usage.
- Do not promise that you will escalate, call tools, or trigger workflows.
- If the user asks for Iris Intelligence mode, politely suggest switching modes but stay lightweight.
- Keep tone confident, friendly, and focused on the key information the user needs right now."""

ADAPTIVE_ROUTER_PROMPT = """You are Iris Adaptive Mode Router. Your PRIMARY role is to answer the user's question concisely FIRST, then make a routing decision.

STEP 1: ANSWER THE QUESTION BRILLIANTLY
Your PRIMARY responsibility is to provide a BRILLIANT, comprehensive answer that fully addresses the user's question. When NOT choosing agent_needed, you MUST give an exceptional answer that leaves the user satisfied.

=== ANSWER QUALITY REQUIREMENTS ===

**CRITICAL: Excellence in Every Answer**
- **Directness**: Answer the question directly and completely - don't leave gaps
- **Accuracy**: Be 100% accurate - verify facts, use correct data, cite sources when relevant
- **Completeness**: Cover all aspects of the question - be thorough, not superficial
- **Helpfulness**: Go above and beyond - anticipate follow-up questions, provide context
- **Facts & Figures**: Include specific data, statistics, numbers, dates when relevant and available
- **Correctness**: Double-check information - accuracy is paramount

**When NOT choosing agent_needed (agent_not_needed or ask_user):**
- The answer MUST be so good that the user feels their question is fully answered
- Include specific facts, figures, statistics, dates, numbers when relevant
- Provide comprehensive information that addresses all aspects of the question
- Use rich formatting to make information digestible and engaging
- Be accurate and factually correct - verify information before including it
- Aim to be as helpful as possible - anticipate what else the user might want to know

=== FORMATTING REQUIREMENTS ===
Use ALL markdown formatting options extensively to create a brilliant, well-structured answer:

- **Tables**: **MANDATORY whenever genuinely useful** - For comparisons, data, lists, structured information
  - **MUST use tables for**:
    * Comparing multiple items (products, options, features, methods)
    * Presenting structured data (statistics, metrics, rankings)
    * Showing relationships between data points
    * Organizing information with multiple attributes
    * Lists that have multiple columns of related information
    * Any data that would be clearer in tabular format
  - Example: | Feature | Option A | Option B | Option C |
  - **CRITICAL**: If you're listing 3+ items with multiple attributes, USE A TABLE
  - **CRITICAL**: If you're comparing options/features/methods, USE A TABLE
  - **CRITICAL**: If structured data would be clearer in table format, USE A TABLE
  - Don't use bullet lists when a table would be more useful and clearer

- **Headings**: Use ## for main sections, ### for subsections (organize content clearly)
- **Lists**: 
  - Bullet points (- or *) for unordered lists (when NOT suitable for tables)
  - Numbered lists (1. 2. 3.) for sequential information
  - Nested lists for hierarchical information
- **Emphasis**: 
  - **Bold** for key terms, important points
  - *Italics* for emphasis, foreign terms, titles
  - `Code` for technical terms, commands, code snippets
- **Code blocks**: ```language for code examples, commands, technical snippets
- **Blockquotes**: > for quotes, important notes, callouts
- **Links**: [text](url) when referencing external sources
- **Horizontal rules**: --- to separate major sections

**Formatting Philosophy:**
- Use formatting to enhance readability and comprehension
- Make complex information easy to scan and understand
- Structure content logically with headings and sections
- **TABLES ARE MANDATORY** for comparative data, structured information, multi-attribute lists
- Use lists for step-by-step or simple categorized information (when tables aren't suitable)
- Use code blocks for technical content

**Table Usage Examples (MANDATORY when applicable):**
- Comparing stocks: | Stock | Price | Market Cap | P/E Ratio | Growth % |
- Listing top items: | Rank | Item | Key Metric | Details |
- Feature comparison: | Feature | Product A | Product B | Product C |
- Method comparison: | Method | Pros | Cons | Best For |
- Data presentation: | Category | Value | Change | Trend |

=== ANSWER STRUCTURE ===

**For Information Queries (agent_not_needed):**
1. Brief greeting (1 line max) or direct answer
2. Main answer with comprehensive information
3. Supporting details with facts & figures
4. Additional context or related information
5. Examples or use cases when relevant

**For Ambiguous Requests (ask_user):**
1. Provide an excellent instant answer first
2. Include facts, figures, specific information
3. Make it comprehensive enough to satisfy immediate need
4. Then suggest deeper work via ask_user prompt

**Example of Brilliant Answer Format:**

## [Main Topic/Answer]

[Comprehensive explanation with **key terms** in bold, *important concepts* in italics]

### Key Facts & Figures

| Metric | Value | Source/Context |
|--------|-------|---------------|
| Statistic 1 | [Specific number/data] | [Context] |
| Statistic 2 | [Specific number/data] | [Context] |
| Date/Timeframe | [When relevant] | [Context] |

### Detailed Comparison/Analysis

| Item/Feature | Attribute 1 | Attribute 2 | Attribute 3 |
|--------------|-------------|-------------|-------------|
| Option A | Value | Value | Value |
| Option B | Value | Value | Value |
| Option C | Value | Value | Value |

### Rankings/List (when applicable)

| Rank | Item | Key Metric | Details |
|------|------|------------|---------|
| 1 | Item | Value | Description |
| 2 | Item | Value | Description |
| 3 | Item | Value | Description |

### Additional Context
- Important point 1
- Important point 2
- Important point 3

**Note**: [Any important caveats, warnings, or additional context]

[Use code blocks for technical examples when relevant]

**CRITICAL**: If you're presenting multiple items with attributes, comparisons, rankings, or structured data → **USE TABLES**. Don't default to bullet lists when tables would be clearer and more useful.

STEP 2: INTELLIGENT ROUTING DECISION
After providing the answer, analyze the request and make a routing decision. Be intelligent - don't ask when the answer is clear.

=== CRITICAL: AUTO-TRIGGER AGENT MODE (agent_needed, confidence 0.9+) ===
These requests MUST automatically trigger agent mode - DO NOT ask the user:

**Clear Deliverables** (ALWAYS agent_needed):
- "create a website" / "make a website" / "build a website" / "create me a website"
- "create an app" / "make an app" / "build an app" / "develop software"
- "create a report" / "make a report" / "generate a report" / "create slides" / "make slides"
- "create intense research report" / "create research report" / "make research report"
- "do deep research" / "deep research on X" / "comprehensive research"
- ANY request with "create", "build", "make", "develop", "generate" + concrete deliverable
- ANY request explicitly asking for "deep", "intense", "comprehensive", "full", "complete" research/analysis

**File/Code Operations** (ALWAYS agent_needed):
- File operations: "create file", "edit file", "process files"
- Code execution: "write code", "run script", "execute program"
- Data processing: "process data", "analyze dataset", "generate report from data"

**Multi-Step Tasks** (ALWAYS agent_needed):
- "and then" / "also" / "next" / "after that" (multiple actions)
- "do X, Y, and Z" (multiple deliverables)

Examples that MUST be agent_needed (confidence 0.95+):
- "create a website" → agent_needed (0.95)
- "create intense research report" → agent_needed (0.95)
- "do deep research on AI" → agent_needed (0.95)
- "make slides about X" → agent_needed (0.95)
- "create a comprehensive report" → agent_needed (0.95)

=== SIMPLE Q&A (agent_not_needed, confidence 0.8+) ===
These should stay in chat mode, but MUST provide BRILLIANT answers:

- Information queries: "what is X?", "how does Y work?", "explain Z"
  → Provide comprehensive, accurate answers with facts & figures, well-formatted
  → **USE TABLES** when comparing options, showing rankings, or presenting structured data
- Clarifications: "What do you mean?", "Can you elaborate?"
  → Give clear, detailed explanations with examples
  → **USE TABLES** if comparing different approaches or methods
- Simple follow-ups: Questions about previous answers
  → Answer directly and completely with relevant details
  → **USE TABLES** for structured information
- Definitions, explanations, comparisons
  → **MANDATORY: USE TABLES** for comparisons (features, methods, options, etc.)
  → Include specific data in table format, be thorough
- Single-answer questions that don't require tools
  → Make the answer exceptional - comprehensive, accurate, helpful
  → **USE TABLES** whenever they would make information clearer

**CRITICAL**: Even for simple Q&A, the answer quality must be BRILLIANT:
- Include facts, figures, statistics when relevant
- **MANDATORY: USE TABLES** for comparisons, rankings, structured data, multi-attribute lists
- Use rich markdown formatting (tables are MANDATORY when useful, headings, lists, emphasis)
- Be accurate and factually correct
- Answer completely - don't leave gaps
- Be as helpful as possible

=== TRULY AMBIGUOUS (ask_user, confidence 0.5-0.7) ===
**WHAT IS AMBIGUOUS MODE?**
Ambiguous mode is for the "grey area" where a user's request could be satisfied in TWO equally valid ways:
1. **Instant Answer**: Quick, direct response that fully answers the question (satisfies immediate need)
2. **Agentic Work**: Deep research, comprehensive analysis, or extensive work that goes beyond a simple answer

**THE KEY INSIGHT:**
When a user asks something like "give me top 5 stocks in each sector", they might want:
- **Option A**: Just the list right now (instant answer) - they're browsing, exploring, or need quick info
- **Option B**: A full research report with analysis, trends, recommendations (agentic work) - they're making decisions, need depth

**WHEN TO USE ask_user:**
Use ask_user ONLY when ALL of these are true:
1. **The request is genuinely ambiguous** - it could reasonably be either:
   - A quick informational query (user wants instant answer)
   - A request for deep work (user wants comprehensive research/analysis/implementation)
2. **No explicit deliverable keywords** - NO "create", "build", "make", "deep", "intense", "comprehensive", "full"
3. **No clear deliverable requested** - User hasn't asked for a website, report, slides, app, etc.
4. **The answer you provide is genuinely complete** - Your instant answer fully satisfies the question, but agentic work could add significant value

**THE INTELLIGENT APPROACH:**
1. **First**: Provide a BRILLIANT, complete instant answer that fully addresses the question
   - Include facts, figures, tables, comprehensive information
   - Make it so good that if the user only wanted an answer, they're satisfied
2. **Then**: Recognize that the same question could benefit from agentic work
   - Deep research, comprehensive analysis, extensive data gathering
   - Multiple tools, file operations, code generation, etc.
3. **Finally**: Offer the choice via ask_user prompt

**Examples that SHOULD be ask_user:**
- "give me top 5 stocks in each sector of economy"
  → **Why ambiguous**: Could be quick list (browsing) OR full research report (decision-making)
  → **Action**: Give instant answer with top 5 per sector in tables, then ask: "Continue with deep research in Iris Intelligence mode?"
  
- "what are the best practices for X?"
  → **Why ambiguous**: Could be quick summary (learning) OR comprehensive guide with examples (implementation)
  → **Action**: Give excellent answer with best practices, then offer deeper work
  
- "help me understand Y"
  → **Why ambiguous**: Could be quick explanation (concept) OR deep dive with examples and code (mastery)
  → **Action**: Give clear explanation, then offer comprehensive guide

- "what are the trends in AI?"
  → **Why ambiguous**: Could be quick overview (curiosity) OR comprehensive research report (business decision)
  → **Action**: Give excellent answer with current trends, then offer deep research

**Examples that should NOT be ask_user (should be agent_needed):**
- "create a website" → agent_needed (clear deliverable - no ambiguity)
- "create intense research report" → agent_needed (explicitly says "intense" - no ambiguity)
- "do deep research on stocks" → agent_needed (explicitly says "deep" - no ambiguity)
- "make slides about X" → agent_needed (clear deliverable - no ambiguity)
- "build me an app" → agent_needed (clear deliverable - no ambiguity)

**Examples that should NOT be ask_user (should be agent_not_needed):**
- "what is machine learning?" → agent_not_needed (simple informational query - no ambiguity)
- "how does X work?" → agent_not_needed (explanation request - no ambiguity)
- "explain Y to me" → agent_not_needed (clarification - no ambiguity)

**THE DECISION TEST:**
Ask yourself: "Could this request be satisfied by EITHER a quick answer OR extensive agentic work, and both would be equally valid?"
- **YES** → ask_user (provide answer first, then offer agent mode)
- **NO, clearly needs agentic work** → agent_needed
- **NO, clearly just needs an answer** → agent_not_needed

=== DECISION LOGIC ===

1. **Check for clear deliverables first (agent_needed):**
   - "create", "build", "make" + website/app/report/slides → agent_needed (0.95+)
   - "create intense research report" / "do deep research" → agent_needed (0.95+)
   - "deep", "intense", "comprehensive" + research/analysis → agent_needed (0.95+)
   - Multi-step indicators ("and then", "also", "next") → agent_needed (0.9+)

2. **Check for simple Q&A (agent_not_needed):**
   - "what", "how", "why", "explain", "describe" → agent_not_needed (0.9+)
   - Clarifications → agent_not_needed (0.95+)

3. **Only if neither applies, consider ask_user:**
   - Request could be quick answer OR full agentic research/analysis
   - NO explicit "create", "build", "make", "deep", "intense" keywords
   - User hasn't asked for a specific deliverable

=== CONFIDENCE LEVELS ===
- **0.95-1.0**: Crystal clear (e.g., "create full website" = agent_needed)
- **0.9-0.95**: Very clear (e.g., "build app" = agent_needed)
- **0.8-0.9**: Clear (e.g., "what is X?" = agent_not_needed)
- **0.5-0.7**: Ambiguous (use ask_user only in this range)

For `ask_user` state:
- `prompt` field: MUST be short and snappy. Format: "Continue [2-3 word context] in Iris Intelligence mode?"
  Examples: "Continue with deep analysis in Iris Intelligence mode?", "Continue researching stocks in Iris Intelligence mode?"
  Keep it under 10 words. Extract the key task/context from the user's request.
  
- `reason` field: User-facing bullet points (no justification, no "I'll" language). List what WILL be done in short, action-oriented phrases.
  Format: "• Research stocks\n• Analyze trends\n• Generate report" or "• Deep analysis\n• Create visualizations\n• Build recommendations"
  Each bullet should be 2-5 words max. Focus on concrete actions, not explanations.

CRITICAL: When state is "ask_user", you MUST include the "ask_user" object with "prompt", "yes_label", and "no_label" fields.

CRITICAL: Do NOT use ask_user for clear creation/building/deep research tasks - these MUST be agent_needed with high confidence.

CRITICAL JSON FORMAT REQUIREMENTS:
- You MUST return ONLY valid JSON, nothing else
- NO markdown code fences (no ```json or ```)
- NO explanatory text before or after the JSON
- NO code examples outside the JSON
- Start your response with { and end with }
- The "answer" field should contain your markdown-formatted answer as a JSON string (properly escaped)

JSON structure (strict JSON, no markdown fences, no extra text):
{"answer": "<beautifully formatted markdown answer with tables/headings/lists>", "decision": {"state": "agent_needed|agent_not_needed|ask_user", "confidence": 0.0-1.0, "reason": "<bullet points>", "agent_preface": "I'll continue in Iris Intelligence mode.", "ask_user": {"prompt": "<short snappy question>", "yes_label": "Yes, continue", "no_label": "No, I'm fine"}, "metadata": {"suggested_tools": [], "urgency": "low|medium|high"}}}

Example of correct response (this is the ONLY format):
{"answer": "# My Answer\n\nHere is the information...", "decision": {"state": "agent_not_needed", "confidence": 0.9, "reason": "Simple information query"}}

Rules: 
1. **BRILLIANT ANSWERS FIRST**: ALWAYS provide a comprehensive, accurate, brilliantly formatted answer FIRST (inside the "answer" JSON field)
   - When NOT choosing agent_needed, the answer MUST be exceptional - comprehensive, accurate, with facts & figures
   - Include specific data, statistics, numbers, dates when relevant
   - Be 100% accurate - verify facts before including them
   - Answer the question directly and completely in every way possible
   - Use ALL markdown formatting options extensively (tables, headings, lists, code blocks, emphasis, etc.)
   - Aim to be as helpful as possible - anticipate what else the user might want to know

2. THEN make the routing decision (inside the "decision" JSON field)

3. **FORMATTING EXCELLENCE**: Use markdown extensively in the answer field:
   - **TABLES ARE MANDATORY** whenever genuinely useful:
     * Comparing multiple items (products, options, features, methods) → USE TABLE
     * Presenting structured data (statistics, metrics, rankings) → USE TABLE
     * Lists with multiple attributes/columns → USE TABLE
     * Any data that would be clearer in tabular format → USE TABLE
     * Don't use bullet lists when a table would be more useful
   - Headings (##, ###) for organization
   - Lists (bullets, numbered) for step-by-step or simple categorized info (when tables aren't suitable)
   - **Bold** for key terms, *italics* for emphasis, `code` for technical terms
   - Code blocks for examples and technical content
   - Blockquotes for important notes
   - All formatting should enhance readability and comprehension

4. **ACCURACY & COMPLETENESS**: 
   - Be 100% accurate - double-check facts, figures, statistics
   - Include specific numbers, dates, data when available and relevant
   - Cover all aspects of the question - be thorough, not superficial
   - Provide context and related information when helpful

5. If state is ask_user, MUST include ask_user object

6. Default agent_not_needed for follow-up questions

7. AUTO-TRIGGER agent_needed for clear creation/building/deep research tasks (don't ask!)

8. ONLY use ask_user for truly ambiguous cases where both quick answer AND deep work make sense

9. RETURN ONLY THE JSON OBJECT - NO OTHER TEXT

=== DECISION EXAMPLES ===

✅ CORRECT: "create a full website" 
→ Answer: Provide overview of website creation process
→ Decision: agent_needed (confidence: 0.95, reason: "Clear creation task requiring multi-step implementation")

✅ CORRECT: "deep research on AI trends"
→ Answer: Provide initial insights on AI trends
→ Decision: agent_needed (confidence: 0.95, reason: "Explicit deep research request requiring comprehensive analysis")

✅ CORRECT: "tell me the top 5 stocks to purchase in India"
→ Answer: Provide BRILLIANT answer with:
  - **MANDATORY TABLE** showing:
    | Rank | Stock | Current Price | Market Cap | P/E Ratio | Growth % | Key Rationale |
    |------|-------|--------------|------------|----------|----------|--------------|
    | 1 | Company A | ₹X | ₹Y | Z | W% | Brief reason |
    | 2 | Company B | ₹X | ₹Y | Z | W% | Brief reason |
    | ... (all 5 stocks in table format) |
  - Additional context with facts & figures
  - Market trends and analysis
  - Formatted with tables (MANDATORY), headings, lists
  - Accurate, comprehensive, helpful
→ Decision: ask_user (confidence: 0.6, reason: "• Deep market analysis\n• Risk assessment\n• Portfolio recommendations", ask_user: {"prompt": "Continue with deep analysis in Iris Intelligence mode?", "yes_label": "Yes, continue", "no_label": "No, I'm fine"})

❌ WRONG: "create a full website" → ask_user (should be agent_needed!)
❌ WRONG: "deep research on X" → ask_user (should be agent_needed!)
❌ WRONG: "build me an app" → ask_user (should be agent_needed!)e
"""


def _clean_base64_data(data: str) -> str:
    """Remove data URL prefixes and whitespace from base64 payloads."""
    if not data:
        return data
    cleaned = data.strip()
    if cleaned.startswith("data:") and "," in cleaned:
        _, cleaned = cleaned.split(",", 1)
    return cleaned.strip()


def _build_user_parts(message: str, attachments: Optional[List[Attachment]]) -> List[Dict]:
    """Create Gemini-friendly parts list that includes text plus any inline attachments."""
    parts: List[Dict] = []

    if message:
        parts.append({"text": message})

    if attachments:
        for attachment in attachments:
            if not attachment.data:
                continue
            parts.append({
                "inline_data": {
                    "mime_type": attachment.mime_type,
                    "data": _clean_base64_data(attachment.data)
                }
            })

    # Gemini expects at least one part in the message.
    if not parts:
        parts.append({"text": ""})

    return parts


async def _load_and_compress_thread_messages(
    thread_id: Optional[str],
    model: str,
    user_id: Optional[str] = None,
    system_instructions: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Load messages from thread and apply context compression using ContextManager."""
    if not thread_id:
        return []
    
    try:
        # Verify thread ownership if user_id is provided
        if user_id:
            from core.services.supabase import DBConnection
            db = DBConnection()
            client = await db.client
            thread_result = await client.table('threads').select('account_id').eq('thread_id', thread_id).execute()
            
            if not thread_result.data:
                logger.warning(f"Thread {thread_id} not found")
                return []
            
            thread_account_id = thread_result.data[0].get('account_id')
            if thread_account_id != user_id:
                logger.warning(f"User {user_id} does not have access to thread {thread_id}")
                return []
        
        thread_manager = ThreadManager()
        all_messages = await thread_manager.get_llm_messages(thread_id)
        
        if not all_messages:
            return []
        
        # Convert messages to format expected by ContextManager
        # ContextManager expects messages with 'role' and 'content' fields
        formatted_messages = []
        for msg in all_messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            
            # Handle different content formats
            if isinstance(content, dict):
                # Extract text from nested content
                text_content = content.get('content', '') or str(content)
            else:
                text_content = str(content)
            
            formatted_messages.append({
                'role': role,
                'content': text_content,
                'message_id': msg.get('message_id')
            })
        
        # Apply context compression using ContextManager (same as agent mode)
        context_manager = ContextManager()
        
        # Create system prompt dict if we have instructions
        system_prompt = None
        if system_instructions:
            system_prompt = {
                "role": "system",
                "content": system_instructions
            }
        
        # Compress messages using the same strategy as agent mode
        compressed_messages, compression_report = await context_manager.compress_messages(
            formatted_messages,
            model,
            max_tokens=None,  # Will be calculated based on context window
            actual_total_tokens=None,
            system_prompt=system_prompt,
            return_report=True,
        )
        
        if compression_report:
            logger.info(f"🧮 Fast chat context compression: {compression_report.summary_line()}")
        
        return compressed_messages
        
    except Exception as e:
        logger.error(f"Failed to load/compress thread messages: {e}", exc_info=True)
        return []


async def _build_history(
    request: ChatRequest, 
    system_instructions: Optional[str] = None,
    user_id: Optional[str] = None
) -> List[Dict]:
    """Build the conversation history excluding the current user message.
    
    If thread_id is provided, loads and compresses messages from the thread.
    Otherwise, uses chat_context if provided.
    """
    conversation_history: List[Dict] = []

    resolved_instructions = system_instructions or request.system_instructions

    if resolved_instructions:
        conversation_history.append({
            "role": "user",
            "parts": [{"text": f"System Instructions: {resolved_instructions}"}]
        })
        conversation_history.append({
            "role": "model",
            "parts": [{"text": "Understood. I will follow these instructions."}]
        })

    # Priority: thread_id > chat_context
    if request.thread_id:
        # Load and compress messages from thread (same strategy as agent mode)
        compressed_messages = await _load_and_compress_thread_messages(
            request.thread_id,
            request.model,
            user_id=user_id,
            system_instructions=resolved_instructions
        )
        
        for msg in compressed_messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            
            if role == "user":
                conversation_history.append({
                    "role": "user",
                    "parts": [{"text": content}]
                })
            elif role == "assistant":
                conversation_history.append({
                    "role": "model",
                    "parts": [{"text": content}]
                })
    elif request.chat_context:
        # Fallback to chat_context if no thread_id
        for msg in request.chat_context:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "user":
                conversation_history.append({
                    "role": "user",
                    "parts": [{"text": content}]
                })
            elif role == "assistant":
                conversation_history.append({
                    "role": "model",
                    "parts": [{"text": content}]
                })

    return conversation_history


def _chunk_text(value: str, size: int = 50) -> List[str]:
    """Yield reasonably sized chunks for smooth streaming."""
    if not value:
        return []
    return [value[i : i + size] for i in range(0, len(value), size)]

def _decode_simple_escapes(s: str) -> str:
    """Decode common JSON escape sequences: \\n, \\t, \\r, \\", \\\\"""
    if not s:
        return s
    result = []
    i = 0
    while i < len(s):
        if s[i] == '\\' and i + 1 < len(s):
            next_char = s[i + 1]
            if next_char == 'n':
                result.append('\n')
                i += 2
            elif next_char == 't':
                result.append('\t')
                i += 2
            elif next_char == 'r':
                result.append('\r')
                i += 2
            elif next_char == '"':
                result.append('"')
                i += 2
            elif next_char == '\\':
                result.append('\\')
                i += 2
            else:
                # Unknown escape, keep as-is
                result.append(s[i])
                i += 1
        else:
            result.append(s[i])
            i += 1
    return ''.join(result)

@router.post("/fast-gemini-chat")
async def fast_gemini_chat_non_streaming(
    request: ChatRequest,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    Non-streaming endpoint for quick testing
    """
    try:
        start_time = time.time()

        conversation_history = await _build_history(
            request, 
            system_instructions=QUICK_CHAT_SYSTEM_PROMPT,
            user_id=user_id
        )
        user_parts = _build_user_parts(request.message, request.attachments)

        # Create model and generate response
        model = genai.GenerativeModel(request.model)
        chat = model.start_chat(history=conversation_history)
        response = chat.send_message({
            "role": "user",
            "parts": user_parts
        })
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        return ChatResponse(
            response=response.text,
            time_ms=elapsed_ms
        )
    except Exception as e:
        logger.error(f"Fast Gemini chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/fast-gemini-chat/stream")
async def fast_gemini_chat_streaming(
    request: ChatRequest,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    Streaming endpoint - real-time character-by-character streaming from Gemini
    """
    
    async def generate_stream() -> AsyncGenerator[str, None]:
        try:
            start_time = time.time()
            
            # Send metadata first
            yield f"data: {json.dumps({'type': 'start', 'time': start_time})}\n\n"
            
            conversation_history = await _build_history(
                request, 
                system_instructions=QUICK_CHAT_SYSTEM_PROMPT,
                user_id=user_id
            )
            user_parts = _build_user_parts(request.message, request.attachments)

            model = genai.GenerativeModel(request.model)
            chat = model.start_chat(history=conversation_history)
            
            # Stream response
            response = chat.send_message({
                "role": "user",
                "parts": user_parts
            }, stream=True)
            
            # Stream each token chunk as it arrives from Gemini
            # This gives the true letter-by-letter typewriter effect
            # For very large chunks, split them character-by-character for smooth streaming
            for chunk in response:
                if chunk.text:
                    # If chunk is large, stream it character-by-character for smooth effect
                    if len(chunk.text) > 50:
                        # Stream each character individually for smooth letter-by-letter effect
                        for char in chunk.text:
                            chunk_data = {
                                'type': 'chunk',
                                'content': char
                            }
                            yield f"data: {json.dumps(chunk_data)}\n\n"
                    else:
                        # Send small chunks immediately as they arrive (already smooth)
                        chunk_data = {
                            'type': 'chunk',
                            'content': chunk.text
                        }
                        yield f"data: {json.dumps(chunk_data)}\n\n"
            
            # Send completion
            elapsed_ms = (time.time() - start_time) * 1000
            completion_data = {
                'type': 'done',
                'time_ms': elapsed_ms
            }
            yield f"data: {json.dumps(completion_data)}\n\n"
            
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            error_data = {
                'type': 'error',
                'error': str(e)
            }
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )

@router.get("/fast-gemini-chat/health")
async def health_check():
    """Quick health check"""
    return {
        "status": "ok",
        "model": "gemini-2.5-flash",
        "api_key_configured": bool(config.GEMINI_API_KEY)
    }


def _strip_json_wrappers(raw_text: str) -> str:
    """Remove Markdown fences or stray commentary from Gemini output."""
    if not raw_text:
        return ""
    
    cleaned = raw_text.strip()
    
    # First, try to extract JSON from markdown code fences (```json ... ``` or ``` ... ```)
    # This handles cases where there's text before/after the code block
    json_pattern = r'```(?:json)?\s*\n?(.*?)\n?```'
    match = re.search(json_pattern, cleaned, re.DOTALL)
    if match:
        cleaned = match.group(1).strip()
    elif cleaned.startswith("```"):
        # Fallback: simple split if it starts with ```
        parts = cleaned.split("```")
        if len(parts) >= 3:
            # Get content between first and second ```
            cleaned = parts[1]
            # Remove language identifier if present (json, python, etc.)
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].lstrip()
            elif cleaned.startswith("python"):
                cleaned = cleaned[6:].lstrip()
            elif cleaned.startswith("javascript"):
                cleaned = cleaned[10:].lstrip()
    
    # Remove any leading/trailing non-JSON text
    # Find the first { which indicates start of JSON object
    first_brace = cleaned.find('{')
    if first_brace == -1:
        # No JSON found - return empty to trigger error
        return ""
    
    # Check if the { is likely part of a code block (like C code) vs JSON
    # JSON should have "answer" or "decision" nearby
    preview = cleaned[first_brace:first_brace+50].lower()
    if '"answer"' not in preview and '"decision"' not in preview:
        # Might be code, look for actual JSON further
        # Try to find JSON-like structure with "answer" or "decision"
        json_like = re.search(r'\{[^{]*"(?:answer|decision)"', cleaned, re.IGNORECASE)
        if json_like:
            first_brace = json_like.start()
            cleaned = cleaned[first_brace:]
        else:
            # No valid JSON found
            return ""
    else:
        # Extract from first { to matching }
        cleaned = cleaned[first_brace:]
    
    # Find the matching closing brace (handle nested objects and strings)
    brace_count = 0
    in_string = False
    escape_next = False
    
    for i, char in enumerate(cleaned):
        if escape_next:
            escape_next = False
            continue
        
        if char == '\\':
            escape_next = True
            continue
        
        if char == '"' and not escape_next:
            in_string = not in_string
            continue
        
        if not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    cleaned = cleaned[:i+1]
                    break
    
    return cleaned.strip()


def _fix_json_control_chars(json_str: str) -> str:
    """Fix unescaped control characters in JSON strings by properly escaping them."""
    result = []
    i = 0
    in_string = False
    escape_next = False
    
    while i < len(json_str):
        char = json_str[i]
        
        if escape_next:
            # After backslash, just copy the next char (already escaped)
            result.append(char)
            escape_next = False
            i += 1
            continue
        
        if char == '\\':
            result.append(char)
            escape_next = True
            i += 1
            continue
        
        if char == '"':
            in_string = not in_string
            result.append(char)
            i += 1
            continue
        
        if in_string:
            # Inside a string, escape control characters that aren't already escaped
            if char == '\n':
                result.append('\\n')
            elif char == '\r':
                result.append('\\r')
            elif char == '\t':
                result.append('\\t')
            elif ord(char) < 32:
                # Other control characters - replace with space to avoid breaking JSON
                result.append(' ')
            else:
                result.append(char)
        else:
            result.append(char)
        
        i += 1
    
    return ''.join(result)


def _parse_adaptive_decision(raw_text: str) -> AdaptiveChatResponse:
    """Parse the adaptive router output into a strongly typed payload."""
    if not raw_text or not raw_text.strip():
        logger.error("Adaptive router returned empty response")
        raise HTTPException(status_code=500, detail="Adaptive router returned empty response")
    
    cleaned = _strip_json_wrappers(raw_text)
    
    if not cleaned:
        # Log the raw response to help debug
        logger.error(f"Could not extract JSON from adaptive router response")
        logger.error(f"Raw response (first 1000 chars): {raw_text[:1000]}")
        # Try one more time with a more aggressive search
        # Look for any JSON-like structure
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', raw_text, re.DOTALL)
        if json_match:
            cleaned = json_match.group(0)
            logger.info("Found JSON using aggressive regex search")
        else:
            raise HTTPException(status_code=500, detail="Adaptive router returned empty or invalid response. Expected JSON format with 'answer' and 'decision' fields.")
    
    # Always fix control characters before parsing (LLM often returns unescaped newlines)
    fixed_json = _fix_json_control_chars(cleaned)
    
    # Try to parse JSON with better error handling
    try:
        payload = json.loads(fixed_json)
    except json.JSONDecodeError as exc:
        logger.error(f"Adaptive router JSON parse error: {exc}")
        logger.error(f"Fixed JSON (first 500 chars): {fixed_json[:500]}")
        logger.error(f"Cleaned text (first 500 chars): {cleaned[:500]}")
        logger.error(f"Raw text (first 500 chars): {raw_text[:500]}")
        # Try to extract JSON more aggressively
        try:
            # Look for JSON object in the text
            json_start = fixed_json.find('{')
            json_end = fixed_json.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                extracted = fixed_json[json_start:json_end]
                # Fix control chars again on extracted portion
                extracted = _fix_json_control_chars(extracted)
                payload = json.loads(extracted)
                logger.info("Successfully extracted and fixed JSON after retry")
            else:
                raise HTTPException(status_code=500, detail=f"Adaptive router returned invalid JSON: {str(exc)}")
        except (json.JSONDecodeError, HTTPException) as retry_exc:
            raise HTTPException(status_code=500, detail=f"Adaptive router returned invalid JSON: {str(exc)}")

    if not isinstance(payload, dict):
        logger.error(f"Payload is not a dict: {type(payload)}")
        raise HTTPException(status_code=500, detail="Adaptive router response is not a valid object")
    
    if "answer" not in payload:
        logger.error(f"Missing 'answer' field. Payload keys: {payload.keys()}")
        raise HTTPException(status_code=500, detail="Adaptive router response missing 'answer' field")
    
    if "decision" not in payload:
        logger.error(f"Missing 'decision' field. Payload keys: {payload.keys()}")
        raise HTTPException(status_code=500, detail="Adaptive router response missing 'decision' field")

    decision_payload = payload.get("decision") or {}
    if not isinstance(decision_payload, dict):
        logger.error(f"Decision is not a dict: {type(decision_payload)}")
        decision_payload = {}

    ask_user_payload = decision_payload.get("ask_user")

    raw_state = decision_payload.get("state")
    logger.info(f"[Adaptive] Raw state from payload: {raw_state} (type: {type(raw_state)})")
    try:
        state = AdaptiveDecisionState(raw_state)
        logger.info(f"[Adaptive] Parsed state: {state} (type: {type(state)})")
    except Exception as e:
        logger.warning(f"Invalid state '{raw_state}', defaulting to AGENT_NOT_NEEDED: {e}")
        state = AdaptiveDecisionState.AGENT_NOT_NEEDED

    confidence = float(decision_payload.get("confidence", 0.5))
    if confidence < 0:
        confidence = 0.0
    if confidence > 1:
        confidence = 1.0

    # Validate ask_user payload if state is ask_user
    ask_user_obj = None
    if state == AdaptiveDecisionState.ASK_USER:
        if ask_user_payload and isinstance(ask_user_payload, dict):
            try:
                # Extract fields with defaults
                prompt = ask_user_payload.get("prompt") or "Would you like me to continue in Iris Intelligence mode?"
                yes_label = ask_user_payload.get("yes_label") or "Yes, continue"
                no_label = ask_user_payload.get("no_label") or "No, I'm fine"
                
                ask_user_obj = AdaptiveAskUserPrompt(
                    prompt=str(prompt),
                    yes_label=str(yes_label),
                    no_label=str(no_label)
                )
            except Exception as e:
                logger.error(f"Invalid ask_user payload: {e}, payload: {ask_user_payload}")
                # Fallback to default
                ask_user_obj = AdaptiveAskUserPrompt(
                    prompt="Would you like me to continue in Iris Intelligence mode?",
                    yes_label="Yes, continue",
                    no_label="No, I'm fine"
                )
        else:
            logger.warning(f"ask_user state but no/invalid ask_user payload (type: {type(ask_user_payload)}), creating default")
            ask_user_obj = AdaptiveAskUserPrompt(
                prompt="Would you like me to continue in Iris Intelligence mode?",
                yes_label="Yes, continue",
                no_label="No, I'm fine"
            )

    # Handle reason field - convert list to string if needed
    reason_value = decision_payload.get("reason") or "No reason provided"
    if isinstance(reason_value, list):
        # Convert list to bullet point string format
        reason_str = "\n".join([f"• {item}" if not item.startswith("•") else item for item in reason_value])
    else:
        reason_str = str(reason_value)
    
    decision = AdaptiveDecision(
        state=state,
        confidence=confidence,
        reason=reason_str,
        agent_preface=decision_payload.get("agent_preface"),
        ask_user=ask_user_obj,
        metadata=decision_payload.get("metadata") or {},
    )

    logger.info(f"[Adaptive] Final decision object: state={decision.state}, confidence={decision.confidence}, reason={decision.reason[:100] if decision.reason else 'None'}")
    logger.info(f"[Adaptive] Decision dict(): {decision.dict()}")

    return AdaptiveChatResponse(
        response=payload.get("answer", "").strip(),
        decision=decision,
        time_ms=0.0,
    )


async def run_adaptive_router(
    request: ChatRequest,
    user_id: Optional[str] = None
) -> AdaptiveChatResponse:
    """Shared adaptive router executor that returns parsed decisions."""
    start_time = time.time()
    conversation_history = await _build_history(
        request, 
        system_instructions=ADAPTIVE_ROUTER_PROMPT,
        user_id=user_id
    )
    user_parts = _build_user_parts(request.message, request.attachments)

    # Force JSON output by using response_mime_type
    model = genai.GenerativeModel(
        request.model,
        generation_config={
            "temperature": 0.35,
            "top_p": 0.9,
            "response_mime_type": "application/json",
        },
    )
    chat = model.start_chat(history=conversation_history)
    response = chat.send_message({
        "role": "user",
        "parts": user_parts
    })

    response_text = response.text or ""
    if not response_text:
        logger.error("LLM returned empty response")
        raise HTTPException(status_code=500, detail="LLM returned empty response")
    
    # Log the raw response for debugging (first 500 chars)
    logger.debug(f"LLM raw response (first 500 chars): {response_text[:500]}")
    
    parsed = _parse_adaptive_decision(response_text)
    parsed.time_ms = (time.time() - start_time) * 1000
    return parsed


@router.post("/adaptive", response_model=AdaptiveChatResponse)
async def adaptive_chat_router(
    request: ChatRequest,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    Adaptive chat endpoint that produces a lightweight answer +
    routing recommendation for Iris Intelligence mode.
    """
    try:
        return await run_adaptive_router(request, user_id=user_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Adaptive chat error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/adaptive/stream")
async def adaptive_chat_stream(
    request: ChatRequest,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """Streaming variant that streams answer content character-by-character as tokens arrive from Gemini."""

    async def generate_stream():
        try:
            start_time = time.time()
            yield f"data: {json.dumps({'type': 'metadata', 'time': start_time})}\n\n"
            
            conversation_history = await _build_history(
                request, 
                system_instructions=ADAPTIVE_ROUTER_PROMPT,
                user_id=user_id
            )
            user_parts = _build_user_parts(request.message, request.attachments)

            # Stream directly from Gemini with JSON mode
            model = genai.GenerativeModel(
                request.model,
                generation_config={
                    "temperature": 0.35,
                    "top_p": 0.9,
                    "response_mime_type": "application/json",
                },
            )
            chat = model.start_chat(history=conversation_history)
            
            # Stream response tokens as they arrive
            response = chat.send_message({
                "role": "user",
                "parts": user_parts
            }, stream=True)
            
            # Accumulate full response for parsing
            full_response = ""
            streamed_answer_raw = ""  # Raw JSON string (with escape sequences)
            streamed_answer_decoded = ""  # Decoded string (for comparison)
            in_answer_field = False
            answer_start_idx = None
            
            # Stream tokens and extract answer content in real-time
            for chunk in response:
                if chunk.text:
                    chunk_text = chunk.text
                    full_response += chunk_text
                    
                    # Look for answer field
                    if not in_answer_field and '"answer"' in full_response.lower():
                        answer_key_pos = full_response.lower().rfind('"answer"')
                        after_key = full_response[answer_key_pos + 7:]
                        colon_pos = after_key.find(':')
                        if colon_pos != -1:
                            after_colon = after_key[colon_pos + 1:].lstrip()
                            if after_colon.startswith('"'):
                                in_answer_field = True
                                answer_start_idx = answer_key_pos + 7 + colon_pos + 2  # After opening quote
                    
                    # Stream answer content as it arrives
                    if in_answer_field and answer_start_idx is not None:
                        # Extract content from answer start to current position
                        if len(full_response) > answer_start_idx:
                            current_extract = full_response[answer_start_idx:]
                            
                            # Stop when we see decision field
                            if '"decision"' not in current_extract.lower():
                                # Find where we left off
                                if len(current_extract) > len(streamed_answer_raw):
                                    new_content_raw = current_extract[len(streamed_answer_raw):]
                                    # Decode escape sequences before streaming
                                    new_content = _decode_simple_escapes(new_content_raw)
                                    # Stream character by character
                                    for char in new_content:
                                        yield f"data: {json.dumps({'type': 'content', 'content': char})}\n\n"
                                    streamed_answer_raw = current_extract
                                    streamed_answer_decoded += new_content
            
            # Parse full response to get decision and ensure we streamed everything
            try:
                parsed = _parse_adaptive_decision(full_response)
                actual_answer = parsed.response
                
                # If we didn't stream everything, stream the remainder
                if len(streamed_answer_decoded) < len(actual_answer):
                    remaining = actual_answer[len(streamed_answer_decoded):]
                    for char in remaining:
                        yield f"data: {json.dumps({'type': 'content', 'content': char})}\n\n"
                elif not in_answer_field:
                    # Never found answer field, stream full answer
                    for char in actual_answer:
                        yield f"data: {json.dumps({'type': 'content', 'content': char})}\n\n"
                
                # Send the decision and completion
                # Use model_dump with mode='json' to ensure enum values are serialized as strings
                decision_dict = parsed.decision.model_dump(mode='json') if hasattr(parsed.decision, 'model_dump') else parsed.decision.dict()
                logger.info(f"[Adaptive Stream] Sending decision: {decision_dict}")
                yield f"data: {json.dumps({'type': 'decision', 'decision': decision_dict})}\n\n"
                elapsed_ms = (time.time() - start_time) * 1000
                yield f"data: {json.dumps({'type': 'done', 'time_ms': elapsed_ms})}\n\n"
            except Exception as parse_error:
                logger.error(f"Failed to parse adaptive response: {parse_error}")
                logger.error(f"Full response (first 1000 chars): {full_response[:1000]}")
                # Fallback: use non-streaming method
                result = await run_adaptive_router(request, user_id=user_id)
                # Stream answer character by character
                for char in result.response:
                    yield f"data: {json.dumps({'type': 'content', 'content': char})}\n\n"
                # Use model_dump with mode='json' to ensure enum values are serialized as strings
                decision_dict = result.decision.model_dump(mode='json') if hasattr(result.decision, 'model_dump') else result.decision.dict()
                logger.info(f"[Adaptive Stream Fallback] Sending decision: {decision_dict}")
                yield f"data: {json.dumps({'type': 'decision', 'decision': decision_dict})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'time_ms': result.time_ms})}\n\n"
                
        except HTTPException as exc:
            yield f"data: {json.dumps({'type': 'error', 'error': exc.detail})}\n\n"
        except Exception as exc:  # pragma: no cover - defensive
            logger.error(f"Adaptive streaming error: {exc}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(exc)})}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

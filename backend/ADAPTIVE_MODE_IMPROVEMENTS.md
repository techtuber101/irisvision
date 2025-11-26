# Adaptive Mode Intelligence Improvements

## Overview
This document outlines strategies to make adaptive mode more intelligent in detecting when to continue in agent mode vs. staying in quick chat mode.

## ✅ Recent Fixes (Implemented)

### Auto-Trigger for Clear Agentic Tasks
**Problem**: Router was asking users even for clear agentic tasks like "create a full website" or "deep research"

**Solution**: Implemented strict auto-trigger rules:
- **Creation/Building Tasks**: "create", "build", "make", "develop" + object → Always `agent_needed` (0.95+ confidence)
- **Deep Research**: "deep", "comprehensive", "full" + research/analysis → Always `agent_needed` (0.95+ confidence)
- **Multi-Step Tasks**: Multiple actions or deliverables → Always `agent_needed` (0.9+ confidence)

**Examples**:
- ✅ "create a full website" → `agent_needed` (auto-trigger, don't ask)
- ✅ "deep research on AI trends" → `agent_needed` (auto-trigger, don't ask)
- ✅ "build me a todo app" → `agent_needed` (auto-trigger, don't ask)

### Truly Ambiguous Cases Only
**Problem**: Router was using `ask_user` too frequently

**Solution**: Only use `ask_user` when BOTH quick answer AND deep work make equal sense:
- User could reasonably want either instant answer OR comprehensive work
- No explicit creation/building/deep keywords
- Request doesn't specify clear scope

**Examples**:
- ✅ "tell me the top 5 stocks to purchase in India" → `ask_user` (can be quick list OR deep analysis)
- ✅ "what are the best practices for X?" → `ask_user` (can be quick summary OR comprehensive guide)
- ❌ "create a full website" → Should NOT be `ask_user` (clear creation task)

### Brilliant Answer Quality Requirements
**Problem**: Answers when NOT choosing agent_needed needed to be more comprehensive and helpful

**Solution**: Emphasized that answers must be BRILLIANT when not using agent mode:
- **Accuracy**: 100% accurate - verify facts, use correct data
- **Completeness**: Cover all aspects - be thorough, not superficial
- **Facts & Figures**: Include specific data, statistics, numbers, dates when relevant
- **Formatting**: Use ALL markdown options extensively (tables, headings, lists, code blocks, emphasis)
- **Helpfulness**: Go above and beyond - anticipate follow-up questions, provide context
- **Directness**: Answer the question directly and completely in every way possible

**Requirements**:
- When `agent_not_needed`: Answer must be so good the user feels fully satisfied
- When `ask_user`: Provide excellent instant answer first, then suggest deeper work
- Always include facts & figures when relevant and available
- Use rich formatting to make information digestible and engaging
- Be accurate and factually correct - verify information before including it

## Current Implementation
- Adaptive router analyzes each message independently
- Makes binary decisions: `agent_needed`, `agent_not_needed`, or `ask_user`
- Limited context awareness (only current message + basic chat history)

## Proposed Improvements

### 1. Enhanced Context Awareness

#### A. Conversation Flow Analysis
**Current Issue**: Router doesn't understand conversation patterns or user intent evolution.

**Solution**: Analyze conversation patterns:
- **Follow-up patterns**: If user asks clarifying questions after an answer, likely wants more info (stay in chat)
- **Task progression**: If user builds on previous answers with action verbs ("now build", "create", "implement"), escalate to agent
- **Question complexity**: Simple questions → chat, complex multi-part → agent

**Implementation**:
```python
# In ADAPTIVE_ROUTER_PROMPT, add:
CONVERSATION_CONTEXT_ANALYSIS:
- Analyze the LAST 3-5 messages for patterns:
  * If user asks follow-up questions ("what about X?", "how does Y work?") → likely chat mode
  * If user builds on previous answer with action verbs ("now create", "build this", "implement") → agent mode
  * If user asks for clarification or explanation → chat mode
  * If user requests concrete deliverables (files, code, reports) → agent mode
- First message in thread: More likely to be exploratory → consider ask_user
- Mid-conversation: Use previous decisions as signal (if agent was needed before, similar requests likely need agent)
```

#### B. Message Intent Classification
**Current Issue**: Simple keyword matching isn't sophisticated enough.

**Solution**: Classify message intent more granularly:
- **Information seeking**: "What is X?", "Explain Y", "How does Z work?" → `agent_not_needed`
- **Task initiation**: "Build X", "Create Y", "Analyze Z" → `agent_needed`
- **Clarification**: "What do you mean?", "Can you elaborate?" → `agent_not_needed`
- **Follow-up actions**: "Now do X", "Also create Y" → `agent_needed`
- **Exploratory**: "What can you do with X?", "Show me Y" → `ask_user` or `agent_not_needed`

**Implementation**:
```python
INTENT_CLASSIFICATION_RULES:
1. **Information Queries** (agent_not_needed, confidence: 0.9+):
   - Questions starting with: "what", "how", "why", "when", "where", "explain", "describe"
   - Requests for definitions, explanations, comparisons
   - "Tell me about X", "What's the difference between X and Y"
   
2. **Task Requests** (agent_needed, confidence: 0.8+):
   - Action verbs: "build", "create", "generate", "write", "analyze", "process", "automate"
   - Deliverable-focused: "make a file", "create a report", "build a website"
   - Multi-step indicators: "and then", "also", "next", "after that"
   
3. **Clarifications** (agent_not_needed, confidence: 0.95+):
   - "What do you mean?", "Can you explain?", "I don't understand"
   - Follow-ups to previous answers
   
4. **Ambiguous Requests** (ask_user, confidence: 0.5-0.7):
   - Vague action words: "help with", "work on", "do something with"
   - Exploratory: "what can you do", "show me possibilities"
   - First-time complex requests where scope is unclear
```

### 2. Conversation History Intelligence

#### A. Previous Decision Learning
**Current Issue**: Router doesn't learn from previous decisions in the same conversation.

**Solution**: Track and learn from previous routing decisions:
- If user accepted agent mode before, similar requests likely need agent
- If user declined agent mode, prefer chat for similar requests
- If user asked follow-ups after agent work, they might want more agent work

**Implementation**:
```python
# Add to prompt:
PREVIOUS_DECISION_CONTEXT:
- Check conversation history for previous adaptive decisions
- If user previously accepted agent mode for similar tasks → higher confidence for agent_needed
- If user previously declined agent mode → prefer chat mode unless clearly agentic
- If this is a continuation of a previous agent task → agent_needed with high confidence
```

#### B. Conversation State Tracking
**Current Issue**: Router doesn't understand if we're in the middle of a task or starting fresh.

**Solution**: Detect conversation state:
- **Fresh conversation**: First message, exploratory → consider `ask_user`
- **Active task**: Recent agent work, user providing input → `agent_needed`
- **Post-task Q&A**: Agent completed work, user asking questions → `agent_not_needed`
- **Task continuation**: User building on previous work → `agent_needed`

**Implementation**:
```python
CONVERSATION_STATE_DETECTION:
1. **Fresh Start** (first 1-2 messages):
   - More likely to use ask_user for ambiguous requests
   - User exploring capabilities
   
2. **Active Task** (recent agent activity):
   - User providing feedback, corrections, additions → agent_needed
   - "Also do X", "Change Y to Z", "Add W" → agent_needed
   
3. **Post-Task** (agent completed work):
   - User asking about results → agent_not_needed
   - "What did you do?", "Explain this", "How does this work?" → agent_not_needed
   
4. **Task Continuation**:
   - User building on previous answer → agent_needed
   - "Now create X", "Build Y based on that" → agent_needed
```

### 3. Enhanced Decision Criteria

#### A. Task Complexity Scoring
**Current Issue**: Binary decision doesn't capture task complexity nuances.

**Solution**: Score tasks on multiple dimensions:
- **Scope**: Single action (1) vs. multi-step (5)
- **Tools needed**: None (0) vs. multiple tools (3+)
- **Time estimate**: Quick answer (<1 min) vs. extended work (>5 min)
- **Deliverables**: None vs. files/code/reports

**Implementation**:
```python
COMPLEXITY_SCORING:
Score each dimension 0-5, then calculate total:
- Scope: Single question (1) → Multi-step project (5)
- Tools: No tools (0) → Multiple tools needed (3+)
- Time: Quick answer (1) → Extended work (5)
- Deliverables: None (0) → Multiple files (5)

Decision thresholds:
- Score 0-5: agent_not_needed (simple Q&A)
- Score 6-10: ask_user (moderate complexity, ambiguous)
- Score 11+: agent_needed (clear multi-step task)
```

#### B. User Behavior Patterns
**Current Issue**: Doesn't adapt to individual user preferences.

**Solution**: Learn from user interaction patterns:
- Track user's acceptance/decline rate for agent mode
- Adapt confidence thresholds based on user behavior
- Prefer chat for users who frequently decline agent mode

**Implementation**:
```python
# Add metadata tracking:
USER_BEHAVIOR_SIGNALS:
- Track in metadata: {"user_agent_acceptance_rate": 0.0-1.0}
- If acceptance_rate > 0.7: Lower threshold for agent_needed
- If acceptance_rate < 0.3: Prefer chat mode, only escalate clear cases
- Default: Balanced approach
```

### 4. Improved Prompt Engineering

#### Enhanced ADAPTIVE_ROUTER_PROMPT Structure

```python
ADAPTIVE_ROUTER_PROMPT = """You are Iris Adaptive Mode Router. Your role is to provide an excellent answer FIRST, then intelligently route to the appropriate mode.

=== CONTEXT ANALYSIS ===
Analyze the conversation context:
1. **Message Intent**: Classify as Information Query / Task Request / Clarification / Exploratory
2. **Conversation State**: Fresh Start / Active Task / Post-Task / Task Continuation
3. **Previous Decisions**: Check if user accepted/declined agent mode before for similar requests
4. **Task Complexity**: Score scope, tools needed, time estimate, deliverables (0-5 each)

=== DECISION FRAMEWORK ===

**agent_not_needed** (confidence 0.8+):
- Information queries: "what", "how", "explain", "describe"
- Clarifications: "What do you mean?", "Can you elaborate?"
- Simple follow-ups after answers
- Post-task questions about completed work
- Single-answer questions that don't require tools

**agent_needed** (confidence 0.8+):
- Action verbs: "build", "create", "generate", "write", "analyze", "automate"
- Multi-step tasks: "and then", "also", "next"
- Deliverable-focused: files, code, reports, websites
- Task continuation: "now do X", "also create Y"
- Active task feedback: corrections, additions during agent work
- Clear tool usage needed: file ops, code execution, web search

**ask_user** (confidence 0.5-0.7):
- Ambiguous first requests: "help with X", "work on Y"
- Exploratory: "what can you do", "show me possibilities"
- Moderate complexity where both quick answer and deep work make sense
- Scope unclear: "build website" (template vs. full custom?)

=== CONFIDENCE CALIBRATION ===
- High confidence (0.9+): Clear intent, strong signals, consistent patterns
- Medium confidence (0.7-0.9): Good signals but some ambiguity
- Low confidence (0.5-0.7): Ambiguous, use ask_user

=== CONVERSATION PATTERNS ===
- **Follow-up questions** → Usually chat mode (user wants more info)
- **Action verbs after answers** → Usually agent mode (user wants execution)
- **Clarifications** → Always chat mode
- **Task building** → Always agent mode

[Rest of prompt continues with formatting rules, JSON structure, etc.]
"""
```

### 5. Implementation Strategy

#### Phase 1: Enhanced Prompt (Immediate)
- Update `ADAPTIVE_ROUTER_PROMPT` with better decision criteria
- Add conversation context analysis
- Improve intent classification

#### Phase 2: Context Enrichment (Short-term)
- Pass more conversation history to router
- Include previous decision metadata
- Track conversation state

#### Phase 3: Learning System (Medium-term)
- Track user acceptance/decline patterns
- Adjust confidence thresholds per user
- Learn from successful routing decisions

#### Phase 4: Advanced Intelligence (Long-term)
- ML model for intent classification
- Predictive routing based on user patterns
- Real-time adaptation based on conversation flow

### 6. Specific Code Changes

#### A. Enhanced Context Building
```python
def _build_history(request: ChatRequest, system_instructions: Optional[str] = None) -> List[Dict]:
    """Enhanced to include decision metadata and conversation state."""
    # Current implementation...
    # ADD: Include previous adaptive decisions in context
    # ADD: Detect conversation state (fresh/active/post-task)
    # ADD: Include user behavior signals if available
```

#### B. Decision Metadata Tracking
```python
# In agent_runs.py, when handling adaptive mode:
metadata_payload = {
    "chat_mode": "adaptive",
    "decision": adaptive_response.decision.dict(),
    "decision_source": "server_initial",
    "original_message": message_content,
    # ADD:
    "conversation_state": detected_state,  # fresh/active/post-task
    "intent_classification": classified_intent,  # info/task/clarification
    "complexity_score": calculated_score,
}
```

#### C. Frontend Decision Learning
```typescript
// In ThreadComponent.tsx, track user decisions:
interface AdaptiveDecisionHistory {
  message: string;
  decision: AdaptiveDecision;
  userResponse?: 'accepted' | 'declined';
  timestamp: number;
}

// Store in component state or localStorage
// Pass to backend in future requests for learning
```

### 7. Testing & Validation

#### Test Cases for Improved Intelligence

1. **Information Query → Chat Mode**
   - "What is React?"
   - "How does authentication work?"
   - "Explain the difference between X and Y"

2. **Task Request → Agent Mode**
   - "Build a todo app"
   - "Create a report analyzing sales data"
   - "Write a Python script to process files"

3. **Follow-up Questions → Chat Mode**
   - After answer: "What about edge cases?"
   - After answer: "How does this compare to X?"

4. **Task Continuation → Agent Mode**
   - After answer: "Now implement this"
   - After answer: "Also add authentication"

5. **Ambiguous Request → Ask User**
   - "Help me with my project" (first message)
   - "What can you do with data analysis?"

6. **Clarification → Chat Mode**
   - "What do you mean?"
   - "Can you explain that differently?"

### 8. Metrics to Track

- **Routing Accuracy**: % of correct mode selections
- **User Satisfaction**: Acceptance rate of agent mode suggestions
- **False Positives**: Agent mode when chat would suffice
- **False Negatives**: Chat mode when agent was needed
- **Ask User Rate**: How often ask_user is used (should be <20%)

## Next Steps

1. **Immediate**: Update `ADAPTIVE_ROUTER_PROMPT` with enhanced decision criteria
2. **Short-term**: Add conversation context analysis to router
3. **Medium-term**: Implement decision tracking and learning
4. **Long-term**: Build ML-based intent classification

## Files to Modify

1. `backend/fast_gemini_chat.py` - Update `ADAPTIVE_ROUTER_PROMPT`
2. `backend/fast_gemini_chat.py` - Enhance `_build_history()` for better context
3. `backend/core/agent_runs.py` - Add decision metadata tracking
4. `frontend/src/components/thread/ThreadComponent.tsx` - Track user decisions
5. `frontend/src/lib/fast-gemini-chat.ts` - Pass additional context to router


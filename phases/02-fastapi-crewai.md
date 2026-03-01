# Phase 2: FastAPI Backend + CrewAI Agent Crew

## Goal
Build the agent brain with the updated three-agent crew. Key changes from V1:
- Uses **Groq Llama 3.1-70b** — free, fast, open source
- **Calendar is fetched before the crew runs** — agents know what you should be doing
- **5-action output** instead of 2 (allow/monitor/ask/nudge/block)
- **Escalation scheduler** — asyncio timers execute future steps without re-running agents
- New `/intent_response` endpoint handles user's yes/no from the ASK dialog

**Depends on**: Phase 1 (extension sending events)

---

## 2.1 Install Packages

```bash
pip install fastapi uvicorn crewai crewai-tools \
            langchain-groq groq \
            langchain-openai \
            python-dotenv pydantic
```

---

## 2.2 New File: `backend/llm.py`

Two LLMs, two purposes:

```python
from langchain_groq import ChatGroq
import os

def get_llm():
    """
    Primary: Groq Llama 3.1-70b
    - Free tier at console.groq.com
    - ~500 tokens/sec — fast enough for real-time decisions
    - Llama model fits the Llama Lounge hackathon theme

    Fallback: OpenAI GPT-4o-mini (if OPENAI_API_KEY is set)
    """
    if os.getenv("GROQ_API_KEY"):
        return ChatGroq(
            model="llama-3.1-70b-versatile",
            api_key=os.getenv("GROQ_API_KEY"),
            temperature=0.1,
            max_tokens=1024,
            timeout=8,
        )
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model="gpt-4o-mini",
        api_key=os.getenv("OPENAI_API_KEY"),
        temperature=0.1,
    )

def cortex_complete(prompt: str, model: str = "llama3.1-8b") -> str:
    """
    Snowflake Cortex — runs Llama INSIDE Snowflake on your data.
    Used for insights/analytics only, NOT real-time agent decisions.
    """
    from db.snowflake_client import execute
    safe_prompt = prompt.replace("'", "''")
    rows = execute(f"""
        SELECT SNOWFLAKE.CORTEX.COMPLETE('{model}', '{safe_prompt}') AS response
    """)
    return rows[0]["RESPONSE"] if rows else ""
```

**Get your free Groq key**: [console.groq.com](https://console.groq.com) — 2 minute signup, no credit card.

---

## 2.3 Updated File: `backend/models.py`

New fields added for V2:

```python
class TabEvent(BaseModel):
    event: str
    # Browser fields
    url: Optional[str] = None
    title: Optional[str] = None
    domain: Optional[str] = None
    tabHistory: Optional[List[dict]] = []
    sessionDurationSeconds: Optional[int] = 0
    referrer: Optional[str] = None           # NEW: where user came from
    navigation_type: Optional[str] = None    # NEW: direct_type | search_referrer | link_click
    dwell_seconds: Optional[int] = 0         # NEW: time spent on current domain
    # Mac system fields
    app: Optional[str] = None
    window_title: Optional[str] = None
    inferred_task: Optional[str] = None
    category: Optional[str] = None
    idle_seconds: Optional[int] = 0
    # Shared
    is_distraction: Optional[bool] = None
    is_work: Optional[bool] = None
    source: Optional[str] = "browser"
    timestamp: Optional[int] = None
    durationSeconds: Optional[int] = None

class ActionType(str, Enum):
    NONE       = "none"
    MONITOR    = "monitor"        # NEW: silent monitoring with timer
    ASK        = "ask"            # NEW: show intent dialog
    SHOW_NUDGE = "show_nudge"
    BLOCK_TAB  = "block_tab"

class EscalationStep(BaseModel):         # NEW
    delay_seconds: int
    action: str
    notification_message: Optional[str] = None
    slack_message: Optional[str] = None

class AgentResponse(BaseModel):
    action: ActionType = ActionType.NONE
    message: Optional[str] = None
    slack_message: Optional[str] = None
    ask_question: Optional[str] = None         # NEW: for ASK action
    escalation_schedule: Optional[List[EscalationStep]] = []  # NEW
    reasoning: Optional[str] = None
    task: Optional[str] = None
```

---

## 2.4 Updated File: `backend/agents/observer.py`

**What changed**: Observer now reasons about *intent*, not just activity.

Key additions:
- Pre-computes grace period status before calling LLM (faster)
- Classifies URL specificity (specific video vs. homepage/feed)
- Detects referrer chain (came from Google = purposeful)
- Incorporates calendar context (what *should* user be doing?)
- Outputs `intent`, `intent_confidence`, `calendar_alignment`, `grace_period_status`

**Whitelist built into Observer** (grace periods in minutes):

| Domain | Base Grace | Specific URL Bonus |
|---|---|---|
| `youtube.com` | 5 min | +7 min if specific video |
| `slack.com` | 20 min | 0 (watch channel name instead) |
| `medium.com` | Never block | — |
| `stackoverflow.com` | Never block | — |
| `github.com` | Never block | — |
| `chatgpt.com` | Never block | — |
| `twitter.com` | 0 | — |

---

## 2.5 Updated File: `backend/agents/analyzer.py`

**What changed**: Analyzer runs 5 explicit factors and returns escalation rules.

**Five factors weighed:**

```
Factor 1 — INTENT
  High confidence work intent → lean allow
  Low confidence or aimless   → lean intervene

Factor 2 — GRACE PERIOD
  Within grace period         → allow or monitor
  Grace period exceeded       → nudge or block
  Not whitelisted + distraction → immediate

Factor 3 — SESSION HEALTH
  Strong session (high focus score, few prior distractions)
    → be lenient, one visit won't derail it
  Weak session (low score, multiple distractions)
    → be strict, this is a pattern

Factor 4 — TIME PRESSURE
  Plenty of time left         → allow grace period
  <15 mins in block           → escalate faster
  Next meeting <10 mins       → nudge regardless

Factor 5 — HISTORICAL PATTERN (from Snowflake)
  User regularly watches tutorials → extend YouTube grace
  User always spirals after Twitter → block immediately
  High nudge return rate      → prefer nudge over block
```

**Output now includes escalation rules:**
```json
{
  "verdict": "monitor",
  "escalation": {
    "check_again_seconds": 540,
    "escalation_trigger": "dwell > 12 mins",
    "if_still_there_verdict": "nudge",
    "further_escalation_seconds": 180,
    "final_verdict": "block"
  }
}
```

---

## 2.6 Updated File: `backend/agents/intervener.py`

**What changed**: Outputs 5 actions + full escalation schedule.

**Message rules:**
- Notification (macOS): MAX 12 words, always references specific task
- Slack: 1–2 sentences, warmer tone, references task + time remaining
- Never says: "stay focused", "optimize", "get back on track"
- Always specific: *"applyPlan() has 35 mins left"* not *"you were working"*

**Output structure:**
```json
{
  "action": "monitor",
  "notification_message": null,
  "slack_message": null,
  "escalation_schedule": [
    {
      "delay_seconds": 540,
      "action": "show_nudge",
      "notification_message": "12 mins on YouTube. Still the tutorial?",
      "slack_message": "12 mins on YouTube during your applyPlan() block. Still the tutorial? ✅ yes / ❌ no"
    },
    {
      "delay_seconds": 720,
      "action": "block_tab",
      "notification_message": "applyPlan() has 35 mins left.",
      "slack_message": "35 minutes left in your coding block. Time to wrap up."
    }
  ]
}
```

---

## 2.7 Updated File: `backend/crew.py`

**What changed**: Calendar fetch before crew + escalation scheduler.

```python
def run_crew(event: dict, history: dict) -> AgentResponse:
    # 1. Fetch calendar context FIRST
    calendar_context = fetch_calendar_context()
    event["calendar"] = calendar_context   # Observer gets this

    # 2. Run three agents sequentially (Groq LLM)
    # observer → analyzer → intervener
    # ...

# Escalation scheduler — asyncio timers
async def schedule_escalations(session_key, escalation_schedule, ...):
    """
    Stores escalation steps as asyncio tasks.
    Fires show_nudge or block_tab at scheduled delays.
    Cancelled immediately if user returns to work.
    """

def cancel_escalations(session_key: str):
    """Called when user returns to work — kills pending timers."""
```

---

## 2.8 Updated File: `backend/main.py`

**New endpoints added:**

```python
@app.post("/intent_response")
async def handle_intent_response(data: dict):
    """
    Called by extension when user answers the ASK dialog.
    intent = "work_related" → cancel escalations
    intent = "distraction"  → trigger immediate block
    """

@app.post("/event")
async def handle_event(event: TabEvent):
    # ...
    # After crew returns response with escalation_schedule:
    if response.escalation_schedule:
        key = get_escalation_key(event.domain, event.app)
        await schedule_escalations(key, response.escalation_schedule, ...)

    # Cancel escalations when user returns to work
    if event.is_work and not event.is_distraction:
        cancel_escalations(get_escalation_key(...))
```

---

## 2.9 Run the Backend

```bash
cd backend
cp .env.example .env
# Set GROQ_API_KEY (get free at console.groq.com)

uvicorn main:app --reload --port 8000
```

Test the full crew:
```bash
# Simulate YouTube visit during coding session
curl -X POST http://localhost:8000/event \
  -H "Content-Type: application/json" \
  -d '{
    "event": "tab_change",
    "url": "https://www.youtube.com/watch?v=abc123",
    "domain": "youtube.com",
    "title": "FastAPI Tutorial",
    "navigation_type": "search_referrer",
    "referrer": "google.com",
    "dwell_seconds": 45,
    "is_distraction": false,
    "source": "browser"
  }'

# Expected: action="monitor" (specific video via search = allow with timer)

# Simulate homepage visit
curl -X POST http://localhost:8000/event \
  -H "Content-Type: application/json" \
  -d '{
    "event": "tab_change",
    "url": "https://www.youtube.com",
    "domain": "youtube.com",
    "title": "YouTube",
    "navigation_type": "direct_type",
    "dwell_seconds": 0,
    "is_distraction": true,
    "source": "browser"
  }'

# Expected: action="ask" (intent unclear on homepage → ask user)
```

---

## 2.10 Verification Checklist

- [ ] `GET /health` returns ok
- [ ] Groq LLM responds (check with `python -c "from llm import get_llm; get_llm().invoke('ping')"`)
- [ ] YouTube specific video → `monitor` response with escalation schedule
- [ ] YouTube homepage → `ask` response with question
- [ ] twitter.com → `block_tab` response immediately
- [ ] medium.com → `none` response (never block)
- [ ] `/intent_response` with `work_related` cancels pending escalations
- [ ] `/intent_response` with `distraction` triggers block
- [ ] Calendar context appears in agent reasoning (check logs)
- [ ] Escalation timers fire after correct delays
- [ ] Returning to work cancels pending timers

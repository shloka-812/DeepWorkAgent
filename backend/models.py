from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


# ─────────────────────────────────────────────────────────────
# INBOUND — what the extension and mac_monitor send to /event
# ─────────────────────────────────────────────────────────────

class TabEvent(BaseModel):

    # --- core event type ---
    event: str
    # values:
    #   "session_start"   — user clicked Start Focus
    #   "session_end"     — user clicked Stop Focus
    #   "tab_change"      — new tab activated or URL changed
    #   "work_return"     — user switched back to a work app/tab

    # --- browser fields (Chrome extension) ---
    url: Optional[str] = None               # full URL e.g. "https://youtube.com/watch?v=abc"
    title: Optional[str] = None             # page title e.g. "FastAPI Tutorial"
    domain: Optional[str] = None            # e.g. "youtube.com"
    tabHistory: Optional[List[dict]] = []   # last 5 tabs visited
    sessionDurationSeconds: Optional[int] = 0

    # V2 fields — critical for intent reasoning
    navigation_type: Optional[str] = None
    # values:
    #   "direct_type"      — user typed URL directly into address bar
    #   "search_referrer"  — user came from Google/Bing/DuckDuckGo
    #   "link_click"       — user clicked a link from another page

    referrer: Optional[str] = None          # domain they came from e.g. "google.com"
    dwell_seconds: Optional[int] = 0        # seconds spent on the PREVIOUS domain

    # --- mac system fields (mac_monitor.py) ---
    app: Optional[str] = None               # active app e.g. "Code", "YouTube"
    window_title: Optional[str] = None      # e.g. "planner.py — deep-work-agent"
    inferred_task: Optional[str] = None     # pre-classified by mac_monitor
    # e.g. "Editing planner.py in deep-work-agent"
    category: Optional[str] = None         # "coding" | "design" | "communication" etc
    idle_seconds: Optional[int] = 0         # seconds since last keyboard/mouse input

    # --- classification flags ---
    is_distraction: Optional[bool] = None
    is_work: Optional[bool] = None

    # --- shared ---
    source: Optional[str] = "browser"       # "browser" | "mac_system"
    timestamp: Optional[int] = None         # unix ms
    durationSeconds: Optional[int] = None   # used by session_end


# ─────────────────────────────────────────────────────────────
# OUTBOUND — what the backend sends back to the extension
# ─────────────────────────────────────────────────────────────

class ActionType(str, Enum):
    NONE       = "none"        # do nothing, visit is fine
    MONITOR    = "monitor"     # silent — backend starts escalation timer
    ASK        = "ask"         # show intent dialog (yes it's work / no it's not)
    SHOW_NUDGE = "show_nudge"  # fire macOS notification
    BLOCK_TAB  = "block_tab"   # inject block overlay on current tab


class EscalationStep(BaseModel):
    delay_seconds: int                              # how long from NOW to wait
    action: str                                     # ActionType value
    notification_message: Optional[str] = None      # macOS notification text (max 12 words)
    slack_message: Optional[str] = None             # Slack DM text (1-2 sentences)


class AgentResponse(BaseModel):
    action: ActionType = ActionType.NONE

    message: Optional[str] = None
    # used when action = "block_tab" or "show_nudge"
    # e.g. "applyPlan() has 35 mins left."

    slack_message: Optional[str] = None
    # sent to Slack simultaneously with action
    # e.g. "12 mins on YouTube during your applyPlan() block. Still the tutorial?"

    ask_question: Optional[str] = None
    # used when action = "ask"
    # e.g. "Is this YouTube visit related to your FastAPI work?"

    escalation_schedule: Optional[List[EscalationStep]] = []
    # used when action = "monitor"
    # example:
    # [
    #   { delay_seconds: 720,  action: "show_nudge", notification_message: "12 mins on YouTube. Still the tutorial?" },
    #   { delay_seconds: 900,  action: "block_tab",  notification_message: "applyPlan() has 35 mins left." }
    # ]

    reasoning: Optional[str] = None
    # one sentence from the agent explaining the decision
    # e.g. "Specific video arrived via Google search during coding session — likely tutorial"
    # used for Snowflake logging and debug, never shown to user

    task: Optional[str] = None
    # current task inferred from calendar + context
    # e.g. "Write applyPlan() + unit tests"
    # used by extension to personalize overlay messages


# ─────────────────────────────────────────────────────────────
# INTENT RESPONSE — user answered the ASK dialog
# POST /intent_response
# ─────────────────────────────────────────────────────────────

class IntentResponse(BaseModel):
    intent: str
    # "work_related"  — user clicked Yes → cancel escalations, let them continue
    # "distraction"   — user clicked No  → trigger block immediately
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import TabEvent, AgentResponse, ActionType
from crew import run_crew, get_escalation_key, schedule_escalations, cancel_escalations
from actions.calendar_action import get_current_and_next_event, check_meeting_approaching
from actions.slack_action import send_slack_nudge
from db.logger import start_session, end_session, log_tab_event, log_agent_decision, get_session_context
from llm import quick_decision

# Global context to share state across requests
agent_context = {
    "calendar": None,
    "focus_active": False,
    "history": {},
    "current_app": None,
    "current_window": None,
    "inferred_task_mac": None
}

async def meeting_check_loop():
    """Checks every 5 minutes if a meeting is approaching."""
    while True:
        await asyncio.sleep(300)
        if not agent_context.get("focus_active"):
            continue
        try:
            meeting = check_meeting_approaching(threshold_minutes=10)
            if meeting:
                msg = (
                    f"🚀 {meeting['meeting_name']} starts in "
                    f"{meeting['starts_in_mins']} minutes. "
                    f"Good stopping point?"
                )
                await asyncio.to_thread(send_slack_nudge, msg)
        except Exception as e:
            print(f"[MeetingCheck Error] {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(meeting_check_loop())
    yield

app = FastAPI(title="Deep Work Agent Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from insights.cortex_analyst import get_full_insights

@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}

@app.get("/insights")
async def handle_get_insights():
    try:
        insights = await asyncio.to_thread(get_full_insights)
        return insights
    except Exception as e:
        print(f"[Insights Error] {e}")
        return {"error": str(e)}

@app.post("/intent_response")
async def handle_intent_response(data: dict):
    intent = data.get("intent")
    key = data.get("key")
    print(f"Received intent response: {intent} for key: {key}")
    if intent == "work_related":
        cancel_escalations(key)
        return {"status": "cancelled", "message": "Escalations stopped."}
    elif intent == "distraction":
        return {"status": "blocked", "message": "Triggering immediate block."}
    return {"status": "ignored"}

@app.post("/event", response_model=AgentResponse)
async def handle_event(event: TabEvent):
    print(f"Received event: {event.event} from {event.source}")

    # 1. Update context caches for cross-sensor triangulation
    if event.source == "mac_system":
        agent_context["current_app"] = event.app
        agent_context["current_window"] = event.window_title
        agent_context["inferred_task_mac"] = event.inferred_task

    # 2. Enrich browser events with Mac context
    if event.source == "browser":
        if not event.app:
            event.app = agent_context.get("current_app") or "Chrome"
        if not event.window_title:
            event.window_title = agent_context.get("current_window")

    # 3. Handle session events
    if event.event == "session_start":
        agent_context["focus_active"] = True
        try:
            await asyncio.to_thread(start_session, calendar_task="Focus Session")
            calendar = await asyncio.to_thread(get_current_and_next_event)
            agent_context["calendar"] = calendar
            history = await asyncio.to_thread(get_session_context)
            agent_context["history"] = history
            return AgentResponse(action="none", reasoning=f"Session started. Task: {calendar.get('current_event')}")
        except Exception as e:
            print(f"[Session Start Error] {e}")
            return AgentResponse(action="none", reasoning=f"Session started with error: {str(e)}")

    if event.event == "session_end":
        agent_context["focus_active"] = False
        await asyncio.to_thread(end_session)
        return AgentResponse(action="none", reasoning="Session ended.")

    # 4. Handle Return-to-Work (Cancels Escalations)
    if event.event in ["work_return", "focus_return"]:
        key = get_escalation_key(event.domain, event.app)
        cancel_escalations(key)
        return AgentResponse(action="none", reasoning="User returned to work. Escalations cancelled.")

    # 5. Log activity to Snowflake
    if event.event != "heartbeat":
        await asyncio.to_thread(
            log_tab_event,
            url=event.url,
            title=event.title,
            domain=event.domain,
            is_distraction=event.is_distraction,
            inferred_task=event.inferred_task,
            navigation_type=event.navigation_type,
            referrer=event.referrer,
            source=event.source
        )

    # ════════════════════════════════════════════════════════
    # 6. QUICK DECISION — skip LLM for obvious sites
    # ════════════════════════════════════════════════════════
    if event.event == "tab_change" and event.domain:
        quick = quick_decision(event.domain)
        if quick:
            print(f"[Quick Decision] {event.domain} → {quick['action']} (0 tokens used)")

            # Log the quick decision to Snowflake
            decision_data = {
                "domain": event.domain,
                "app": event.app,
                "url_type": "known",
                "navigation_type": event.navigation_type,
                "intent": "distraction" if quick["action"] == "block_tab" else "work_related",
                "intent_confidence": 1.0,
                "verdict": quick["action"],
                "primary_reason": quick["reasoning"],
                "dwell_seconds": event.dwell_seconds or 0,
                "grace_period_total": 0
            }
            await asyncio.to_thread(log_agent_decision, decision_data)

            # Send Slack nudge for blocks
            if quick["action"] == "block_tab":
                slack_msg = f"🎯 Blocked {event.domain} during your focus session."
                await asyncio.to_thread(send_slack_nudge, slack_msg)

            return AgentResponse(
                action=quick["action"],
                message=quick["message"],
                reasoning=quick["reasoning"]
            )

    # ════════════════════════════════════════════════════════
    # 7. CREW DECISION — LLM for ambiguous sites only
    # ════════════════════════════════════════════════════════
    try:
        response = run_crew(
            event,
            calendar_context=agent_context.get("calendar"),
            history_context=agent_context.get("history")
        )

        # Log decision
        decision_data = {
            "domain": event.domain,
            "app": event.app,
            "url_type": "unknown",
            "navigation_type": event.navigation_type,
            "intent": "unknown",
            "intent_confidence": 0,
            "verdict": response.action.value if hasattr(response.action, 'value') else response.action,
            "primary_reason": response.reasoning,
            "dwell_seconds": event.dwell_seconds or 0,
            "grace_period_total": 0
        }
        await asyncio.to_thread(log_agent_decision, decision_data)

        # Execute immediate actions
        if response.slack_message:
            await asyncio.to_thread(send_slack_nudge, response.slack_message)

        # Schedule future escalations
        if response.escalation_schedule:
            key = get_escalation_key(event.domain, event.app)
            await schedule_escalations(key, response.escalation_schedule)

        return response

    except Exception as e:
        print(f"[Crew Error] {e}")
        # Fallback — always return something so extension UI works
        return AgentResponse(
            action="block_tab",
            message="Agent busy — stay focused on your task.",
            reasoning=f"Fallback due to error: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
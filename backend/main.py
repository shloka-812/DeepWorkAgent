import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import TabEvent, AgentResponse, ActionType
from crew import run_crew, get_escalation_key, schedule_escalations, cancel_escalations
from actions.calendar_action import get_current_and_next_event, check_meeting_approaching
from actions.slack_action import send_slack_nudge
from db.logger import start_session, end_session, log_tab_event, log_agent_decision, get_session_context

# Global context to share state across requests
agent_context = {
    "calendar": None,
    "focus_active": False,
    "history": {}
}

async def meeting_check_loop():
    """Checks every 5 minutes if a meeting is approaching."""
    while True:
        await asyncio.sleep(300)  # Every 5 mins
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
                # Run sync slack call in thread to avoid blocking loop
                await asyncio.to_thread(send_slack_nudge, msg)
        except Exception as e:
            print(f"[MeetingCheck Error] {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start meeting check loop
    asyncio.create_task(meeting_check_loop())
    yield
    # Shutdown: Clean up if needed

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
    """
    Returns AI-powered productivity insights from Snowflake + Cortex.
    """
    try:
        insights = await asyncio.to_thread(get_full_insights)
        return insights
    except Exception as e:
        print(f"[Insights Error] {e}")
        return {"error": str(e)}

@app.post("/intent_response")
async def handle_intent_response(data: dict):
    """
    Called by extension when user answers the ASK dialog.
    intent = "work_related" → cancel escalations
    intent = "distraction"  → trigger immediate block
    """
    intent = data.get("intent")
    key = data.get("key") # The escalation key
    
    print(f"Received intent response: {intent} for key: {key}")
    
    if intent == "work_related":
        cancel_escalations(key)
        return {"status": "cancelled", "message": "Escalations stopped."}
    
    elif intent == "distraction":
        # In a real app, this would trigger an immediate block command to the extension
        return {"status": "blocked", "message": "Triggering immediate block."}
    
    return {"status": "ignored"}

@app.post("/event", response_model=AgentResponse)
async def handle_event(event: TabEvent):
    print(f"Received event: {event.event} from {event.source}")
    
    # Handle session events
    if event.event == "session_start":
        agent_context["focus_active"] = True
        try:
            # 1. Start Snowflake Session
            await asyncio.to_thread(start_session, calendar_task="Focus Session")
            
            # 2. Fetch real calendar context
            calendar = await asyncio.to_thread(get_current_and_next_event)
            agent_context["calendar"] = calendar
            
            # 3. Fetch historical context from Snowflake
            history = await asyncio.to_thread(get_session_context)
            agent_context["history"] = history
            
            print(f"[Session Start] Active task: {calendar.get('current_event')}")
            return AgentResponse(action="none", reasoning=f"Session started. Task: {calendar.get('current_event')}")
        except Exception as e:
            print(f"[Session Start Error] {e}")
            return AgentResponse(action="none", reasoning=f"Session started with error: {str(e)}")

    if event.event == "session_end":
        agent_context["focus_active"] = False
        await asyncio.to_thread(end_session)
        return AgentResponse(action="none", reasoning="Session ended.")

    if event.event in ["work_return", "focus_return"]:
        # Cancel any pending escalations when user returns to work
        key = get_escalation_key(event.domain, event.app)
        cancel_escalations(key)
        return AgentResponse(action="none", reasoning="User returned to work. Escalations cancelled.")

    # Log the incoming tab event to Snowflake
    if event.event != "heartbeat":
        await asyncio.to_thread(log_tab_event, event.dict())

    # Run the Agent Brain for activity events
    try:
        # Pass calendar AND historical context to the crew run
        response = run_crew(
            event, 
            calendar_context=agent_context.get("calendar"),
            history_context=agent_context.get("history")
        )
        
        # Log the agent decision to Snowflake
        decision_data = event.dict()
        decision_data.update(response.dict())
        await asyncio.to_thread(log_agent_decision, decision_data)
        
        # 1. Start immediate Slack nudge if requested
        if response.slack_message:
            await asyncio.to_thread(send_slack_nudge, response.slack_message)

        # 2. If there is an escalation schedule, start the timers
        if response.escalation_schedule:
            key = get_escalation_key(event.domain, event.app)
            await schedule_escalations(key, response.escalation_schedule)

            
        return response
    except Exception as e:
        print(f"Crew error: {e}")
        return AgentResponse(action="none", reasoning=f"Agent Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

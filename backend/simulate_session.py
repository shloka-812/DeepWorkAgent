import asyncio
import os
import json
from dotenv import load_dotenv
from crew import run_crew
from models import TabEvent
from actions.calendar_action import get_current_and_next_event
from actions.slack_action import send_slack_nudge

load_dotenv(override=True)

async def simulate_agent_flow():
    print("--- Simulating Phase 2: Full Agent Brain Flow ---")
    
    # 1. Fetch real calendar context (Phase 4 integration)
    print("\n[1] Fetching real calendar data...")
    calendar = get_current_and_next_event()
    print(f"Calendar Context: {calendar.get('current_event')} until {calendar.get('end_time')}")

    # 2. Simulate a distraction event (Phase 2 logic)
    # Scenario: User is supposed to be doing 'Focus Session' but is on YouTube.
    print("\n[2] Simulating Distraction Event (YouTube)...")
    event = TabEvent(
        event="tab_active",
        source="chrome",
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        domain="youtube.com",
        title="Never Gonna Give You Up",
        dwell_seconds=600, # 10 minutes - should trigger a nudge/block
        navigation_type="direct",
        app="Chrome"
    )

    # 3. Run the Crew (Phase 2 Core)
    print("\n[3] Running the Crew (Observer -> Analyzer -> Intervener)...")
    try:
        response = run_crew(event, calendar_context=calendar)
        print("\n--- Agent Execution Result ---")
        print(f"Action: {response.action.upper()}")
        print(f"Reasoning: {response.reasoning}")
        
        if response.slack_message:
            print(f"Sending immediate Slack message: {response.slack_message}")
            await asyncio.to_thread(send_slack_nudge, response.slack_message)
            
        if response.message:
            print(f"Extension Message (Nudge): {response.message}")
        if response.escalation_schedule:
            print(f"Escalation: {len(response.escalation_schedule)} steps found.")
    except Exception as e:
        print(f"❌ Simulation failed: {e}")

if __name__ == "__main__":
    asyncio.run(simulate_agent_flow())

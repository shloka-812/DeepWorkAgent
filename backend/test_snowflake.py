import asyncio
import os
import json
from dotenv import load_dotenv
from db.logger import start_session, log_tab_event, log_agent_decision, get_session_context, end_session
from insights.cortex_analyst import get_full_insights

load_dotenv()

async def test_snowflake_full_flow():
    print("--- Testing Phase 3/5: Snowflake & Insights Flow ---")
    
    # 1. Start Session
    print("\n[1] Starting focus session...")
    session_id = start_session(calendar_task="Testing Snowflake Integration")
    print(f"Session ID created: {session_id}")

    # 2. Log Tab Event
    print("\n[2] Logging mock tab event...")
    log_tab_event({
        "url": "https://www.youtube.com/watch?v=mock",
        "domain": "youtube.com",
        "title": "Mock Video",
        "is_distraction": False,
        "navigation_type": "link_click",
        "dwell_seconds": 300,
        "source": "browser"
    })
    print("Logged.")

    # 3. Log Agent Decision
    print("\n[3] Logging mock agent decision...")
    log_agent_decision({
        "domain": "youtube.com",
        "intent": "work_related",
        "intent_confidence": 0.9,
        "verdict": "allow",
        "reasoning": "Mock reasoning for testing.",
        "navigation_type": "link_click",
        "dwell_seconds": 300
    })
    print("Logged.")

    # 4. Fetch History Context
    print("\n[4] Fetching session context (Analyzer's memory)...")
    context = get_session_context()
    print(f"Context: {json.dumps(context, indent=2)}")

    # 5. Fetch Cortex Insights
    print("\n[5] Fetching Cortex Insights (Dashboard)...")
    insights = get_full_insights()
    print(f"Insights Summary: {json.dumps(insights['summary'], indent=2)}")
    print(f"Cortex Tip: {insights['grace_period_tip']}")

    # 6. End Session
    print("\n[6] Ending session...")
    end_session()
    print("Done.")

if __name__ == "__main__":
    # Note: This will fail if Snowflake credentials aren't set in .env
    asyncio.run(test_snowflake_full_flow())

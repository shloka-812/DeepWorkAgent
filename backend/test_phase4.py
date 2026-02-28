import asyncio
import os
from dotenv import load_dotenv
from actions.calendar_action import get_current_and_next_event
from actions.slack_action import send_slack_nudge

load_dotenv(override=True)

async def test_composio_integrations():
    print("--- Testing Phase 4: Composio Integrations ---")
    
    # 1. Test Calendar Read
    print("\n[1] Testing Google Calendar Read...")
    try:
        calendar = get_current_and_next_event()
        print(f"Result: {calendar}")
        if calendar.get("current_event"):
            print("✅ Calendar read successful.")
        else:
            print("⚠️ Calendar returned no events (or check if connected).")
    except Exception as e:
        print(f"❌ Calendar test failed: {e}")

    # 2. Test Slack Nudge
    print("\n[2] Testing Slack Nudge...")
    from datetime import datetime
    ts = datetime.now().strftime("%H:%M:%S")
    msg = f"🚀 Testing DeepWorkAgent Phase 4 (at {ts}): Slack integration is LIVE!"
    success = await asyncio.to_thread(send_slack_nudge, msg)

    if success:
        print("✅ Slack message sent (Check your DM!).")
    else:
        print("❌ Slack message failed (Check SLACK_CHANNEL_ID and connection).")

if __name__ == "__main__":
    asyncio.run(test_composio_integrations())

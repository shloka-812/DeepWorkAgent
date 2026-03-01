import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from actions.slack_action import send_slack_nudge
from actions.calendar_action import get_current_and_next_event

async def main():
    print('--- Testing Calendar Action ---')
    try:
        events = get_current_and_next_event()
        print(f'Calendar Response: {events}')
    except Exception as e:
        print(f'Calendar Error: {e}')

    print('\n--- Testing Slack Action ---')
    try:
        success = send_slack_nudge('Hello from Deep Work Agent Phase 4 test!')
        print(f'Slack Success: {success}')
    except Exception as e:
        print(f'Slack Error: {e}')

if __name__ == '__main__':
    asyncio.run(main())

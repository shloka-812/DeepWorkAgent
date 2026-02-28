import os
from .composio_client import get_composio_client

def send_slack_message(channel_id: str, message: str) -> bool:
    """
    Sends a Slack message to a specific channel/DM using Composio v3 SDK.
    """
    if not message:
        return False

    client = get_composio_client()
    print(f"[Slack Debug] Attempting to send message to ID: {channel_id}")

    try:

        response = client.tools.execute(
            slug="SLACK_SEND_MESSAGE",
            arguments={
                "channel": channel_id,
                "text": message
            },
            user_id="default",
            dangerously_skip_version_check=True
        )
        
        # Determine success
        if isinstance(response, dict):
            success = response.get("successful", False)
            if not success:
                 print(f"[Slack Debug] Failure response: {response}")
            return success
            
        success = getattr(response, "successful", False)
        if not success:
            print(f"[Slack Debug] Failure response: {response}")
        return success

    except Exception as e:
        print(f"[Slack] Exception during execution: {e}")
        return False




def send_slack_nudge(message: str) -> bool:
    """
    Helper function to send a nudge to the default SLACK_CHANNEL_ID.
    """
    channel_id = os.getenv("SLACK_CHANNEL_ID")
    if not channel_id:
        print("Warning: SLACK_CHANNEL_ID not set in .env.")
        return False

    return send_slack_message(channel_id, message)
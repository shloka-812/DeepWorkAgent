import os
from datetime import datetime, timezone, timedelta
from .composio_client import get_composio_client

def get_current_and_next_event() -> dict:
    """
    Fetch what's on the calendar RIGHT NOW and what's coming next.
    Returns:
    {
      "current_event": str,
      "start_time": str,
      "end_time": str,
      "minutes_remaining": int,
      "next_event": str,
      "next_start_time": str,
      "minutes_until": int
    }
    """
    client = get_composio_client()

    now = datetime.now(timezone.utc)
    one_day_later = now + timedelta(days=1)

    try:
        response = client.tools.execute(
            slug="GOOGLECALENDAR_FIND_EVENT",
            arguments={
                "time_min": now.isoformat(),
                "time_max": one_day_later.isoformat(),
                "max_results": 5
            },
            user_id="default",
            dangerously_skip_version_check=True
        )

        # In Composio v3, response is a dictionary when evaluated, or has a .data dict
        resp_data = response.get("data", {}) if isinstance(response, dict) else getattr(response, "data", {})
        
        # Sometimes events are in resp_data["items"], sometimes in resp_data["event_data"]
        items = resp_data.get("items", [])
        if not items and "event_data" in resp_data:
            items = resp_data["event_data"].get("event_data", [])


        current_event = None
        next_event = None

        for event in items:
            start_str = event.get("start", {}).get("dateTime") or event.get("start", {}).get("date")
            end_str = event.get("end", {}).get("dateTime") or event.get("end", {}).get("date")

            if not start_str or not end_str:
                continue

            start = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_str.replace('Z', '+00:00'))

            if start <= now <= end:
                current_event = {"title": event.get("summary", "Untitled Event"), "start": start, "end": end}
            elif start > now and next_event is None:
                next_event = {"title": event.get("summary", "Untitled Event"), "start": start}

        result = {}
        if current_event:
            remaining = int((current_event["end"] - now).total_seconds() / 60)
            result.update({
                "current_event": current_event["title"],
                "start_time": current_event["start"].strftime("%I:%M %p"),
                "end_time": current_event["end"].strftime("%I:%M %p"),
                "minutes_remaining": remaining
            })
        else:
            result.update({"current_event": "Focus block (unscheduled)", "minutes_remaining": 0})

        if next_event:
            until = int((next_event["start"] - now).total_seconds() / 60)
            result.update({
                "next_event": next_event["title"],
                "next_start_time": next_event["start"].strftime("%I:%M %p"),
                "minutes_until": until
            })

        return result

    except Exception as e:
        print(f"[Calendar] Error fetching events: {e}")
        return {"current_event": "Focus session", "minutes_remaining": 0}


def check_meeting_approaching(threshold_minutes: int = 10) -> dict | None:
    """
    Returns meeting info if one starts within threshold_minutes.
    """
    data = get_current_and_next_event()
    if data.get("next_event") and data.get("minutes_until", 999) <= threshold_minutes:
        return {
            "meeting_name": data["next_event"],
            "starts_in_mins": data["minutes_until"]
        }
    return None

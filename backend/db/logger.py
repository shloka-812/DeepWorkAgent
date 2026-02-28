import os
from datetime import datetime, timezone
from uuid import uuid4
from .snowflake_client import execute, execute_write

_current_session_id = None

def start_session(calendar_task: str = None) -> str:
    """
    Starts a new focus session and returns the session_id.
    """
    global _current_session_id
    _current_session_id = str(uuid4())
    
    execute_write("""
        INSERT INTO FOCUS_SESSIONS (session_id, calendar_task, started_at)
        VALUES (%s, %s, %s)
    """, (_current_session_id, calendar_task, datetime.now(timezone.utc)))
    
    return _current_session_id

def end_session():
    """
    Ends the current focus session.
    """
    global _current_session_id
    if not _current_session_id:
        return
    
    now = datetime.now(timezone.utc)
    
    # Calculate duration
    session_data = execute("SELECT started_at FROM FOCUS_SESSIONS WHERE session_id = %s", (_current_session_id,))
    if session_data:
        started_at = session_data[0]["STARTED_AT"]
        # Ensure started_at is a datetime object or parse it
        # Snowflake connector usually handles this
        duration = int((now - started_at).total_seconds())
        
        execute_write("""
            UPDATE FOCUS_SESSIONS 
            SET ended_at = %s, duration_secs = %s
            WHERE session_id = %s
        """, (now, duration, _current_session_id))
    
    _current_session_id = None

def log_tab_event(event: dict):
    """
    Log a browser tab event.
    """
    if not _current_session_id:
        return
        
    execute_write("""
        INSERT INTO TAB_EVENTS (
            session_id, url, title, domain, is_distraction, 
            navigation_type, referrer, dwell_seconds, source
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        _current_session_id,
        event.get("url"),
        event.get("title"),
        event.get("domain"),
        event.get("is_distraction", False),
        event.get("navigation_type"),
        event.get("referrer"),
        event.get("dwell_seconds", 0),
        event.get("source", "browser")
    ))

def log_agent_decision(decision: dict):
    """
    Log every agent decision.
    """
    if not _current_session_id:
        return
        
    # url_type logic could be more complex, but for now we take what's passed
    execute_write("""
        INSERT INTO AGENT_DECISIONS (
            session_id, domain, app, url_type, navigation_type,
            intent, intent_confidence, verdict, primary_reason,
            dwell_seconds, decided_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        _current_session_id,
        decision.get("domain"),
        decision.get("app"),
        decision.get("url_type", "unknown"),
        decision.get("navigation_type"),
        decision.get("intent"),
        decision.get("intent_confidence", 0),
        decision.get("verdict"),
        decision.get("reasoning", "")[:500],
        decision.get("dwell_seconds", 0),
        datetime.now(timezone.utc)
    ))

def log_intervention(intervention: dict):
    """
    Log a user intervention (nudge/block).
    """
    if not _current_session_id:
        return
        
    execute_write("""
        INSERT INTO INTERVENTIONS (
            session_id, domain, action_type, message, hour_of_day
        ) VALUES (%s, %s, %s, %s, %s)
    """, (
        _current_session_id,
        intervention.get("domain"),
        intervention.get("action_type"),
        intervention.get("message"),
        datetime.now().hour
    ))
    
    # Increment intervention count in session
    execute_write("""
        UPDATE FOCUS_SESSIONS 
        SET intervention_count = intervention_count + 1
        WHERE session_id = %s
    """, (_current_session_id,))

def get_session_context() -> dict:
    """
    Fetch history and patterns for the Analyzer Agent.
    """
    # 1. YouTube & Slack average dwell times
    dwell_data = execute("""
        SELECT domain, avg_dwell_minutes 
        FROM V_DWELL_PATTERNS 
        WHERE domain IN ('youtube.com', 'slack.com')
    """)
    youtube_avg = next((d["AVG_DWELL_MINUTES"] for d in dwell_data if d["DOMAIN"] == "youtube.com"), None)
    slack_avg = next((d["AVG_DWELL_MINUTES"] for d in dwell_data if d["DOMAIN"] == "slack.com"), None)
    
    # 2. Nudge effectiveness
    nudge_eff = execute("""
        SELECT return_rate_pct FROM V_NUDGE_EFFECTIVENESS
        WHERE action_type = 'show_nudge'
    """)
    nudge_return_rate = nudge_eff[0]["RETURN_RATE_PCT"] if nudge_eff else None
    
    # 3. Today's summary
    today = execute("SELECT * FROM V_TODAY_SUMMARY")
    summary = today[0] if today else {}
    
    return {
        "youtube_avg_duration": youtube_avg,
        "slack_avg_duration": slack_avg,
        "nudge_return_rate": nudge_return_rate,
        "interventions_today": summary.get("TOTAL_INTERVENTIONS_TODAY", 0),
        "focus_minutes_today": summary.get("FOCUS_MINUTES_TODAY", 0)
    }

# Phase 3: Snowflake Memory Layer

## Goal
Persistent memory for the agent. Every tab event, app switch, focus session, intervention, and agent decision is logged to Snowflake. The Analyzer Agent queries this history to make smarter decisions — knowing your YouTube watching patterns, your Slack habits, your peak hours, and whether nudges actually work on you.

**New in V2:**
- `AGENT_DECISIONS` table — logs every allow/monitor/ask/nudge/block with reasoning
- `DWELL_PATTERNS` view — tracks avg dwell time per domain to calibrate grace periods
- `NUDGE_EFFECTIVENESS` view — tracks whether nudges actually return you to work
- Snowflake Cortex used for insights (Llama runs inside Snowflake)

**Depends on**: Phase 2 (backend calls logger functions)

---

## 3.1 Install Packages

```bash
pip install snowflake-connector-python
```

---

## 3.2 File: `backend/db/schema.sql`

Run this in the Snowflake SQL Worksheet:

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Deep Work Agent - Snowflake Memory Layer Schema
-- Run this in the Snowflake SQL Worksheet
-- ═══════════════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS DEEP_WORK;
USE DATABASE DEEP_WORK;
CREATE SCHEMA IF NOT EXISTS AGENT;
USE SCHEMA AGENT;

-- ═══════════════════════════════════════════════════════════════════════════
-- FOCUS SESSIONS
-- Tracks individual focus work sessions
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS FOCUS_SESSIONS (
    session_id         VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    started_at         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    ended_at           TIMESTAMP_NTZ,
    duration_secs      INTEGER,
    focus_score        FLOAT,
    intervention_count INTEGER DEFAULT 0,
    calendar_task      VARCHAR(500),    -- What calendar said user should be doing
    created_at         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TAB EVENTS
-- Every browser tab change and app switch
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS TAB_EVENTS (
    event_id           VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    session_id         VARCHAR(36),
    url                VARCHAR(2000),
    title              VARCHAR(500),
    domain             VARCHAR(200),
    is_distraction     BOOLEAN DEFAULT FALSE,
    inferred_task      VARCHAR(500),
    navigation_type    VARCHAR(50),     -- direct_type|search_referrer|link_click
    referrer           VARCHAR(200),    -- Where user came from
    dwell_seconds      INTEGER DEFAULT 0, -- Time spent on this domain
    source             VARCHAR(20) DEFAULT 'browser', -- browser|mac_system
    event_time         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- AGENT DECISIONS
-- Logs every decision the agent made including allows
-- This is what makes the agent smarter over time
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS AGENT_DECISIONS (
    decision_id        VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    session_id         VARCHAR(36),
    domain             VARCHAR(200),
    app                VARCHAR(100),
    url_type           VARCHAR(50),     -- specific_video|homepage|specific_page|feed
    navigation_type    VARCHAR(50),
    intent             VARCHAR(30),     -- work_related|ambiguous|distraction
    intent_confidence  FLOAT,
    verdict            VARCHAR(20),     -- allow|monitor|ask|nudge|block
    primary_reason     VARCHAR(500),
    dwell_seconds      INTEGER,
    grace_period_total INTEGER,
    escalation_fired   BOOLEAN DEFAULT FALSE,
    user_response      VARCHAR(20),     -- returned_to_work|ignored|confirmed_work
    decided_at         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INTERVENTIONS
-- When the agent actually intervened (nudge, block, etc.)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS INTERVENTIONS (
    intervention_id    VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    session_id         VARCHAR(36),
    domain             VARCHAR(200),
    action_type        VARCHAR(50),
    message            VARCHAR(500),
    hour_of_day        INTEGER,
    user_returned      BOOLEAN,         -- Did user go back to work?
    return_delay_secs  INTEGER,         -- How long before returning?
    intervened_at      TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- HOURLY FOCUS SCORES
-- Aggregated focus scores by hour for pattern detection
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS HOURLY_FOCUS_SCORES (
    score_id      VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    hour_of_day   INTEGER NOT NULL,
    focus_score   FLOAT NOT NULL,
    session_date  DATE DEFAULT CURRENT_DATE(),
    recorded_at   TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════════════════

-- Today's summary for dashboard
CREATE OR REPLACE VIEW V_TODAY_SUMMARY AS
SELECT
    COUNT(DISTINCT s.session_id)         AS sessions_today,
    SUM(s.duration_secs) / 60.0         AS focus_minutes_today,
    AVG(s.focus_score)                   AS avg_focus_score_today,
    SUM(s.intervention_count)            AS total_interventions_today,
    MAX(s.started_at)                    AS last_session_start
FROM FOCUS_SESSIONS s
WHERE DATE(s.started_at) = CURRENT_DATE();

-- Top distractions (last 7 days)
CREATE OR REPLACE VIEW V_TOP_DISTRACTIONS AS
SELECT domain, COUNT(*) AS visit_count
FROM TAB_EVENTS
WHERE is_distraction = TRUE
  AND event_time >= DATEADD('day', -7, CURRENT_TIMESTAMP())
GROUP BY domain ORDER BY visit_count DESC LIMIT 5;

-- Hourly focus pattern (last 14 days)
CREATE OR REPLACE VIEW V_HOURLY_FOCUS_PATTERN AS
SELECT hour_of_day, AVG(focus_score) AS avg_focus_score, COUNT(*) AS sample_count
FROM HOURLY_FOCUS_SCORES
WHERE session_date >= DATEADD('day', -14, CURRENT_DATE())
GROUP BY hour_of_day ORDER BY hour_of_day;

-- Dwell patterns by domain (helps calibrate grace periods)
CREATE OR REPLACE VIEW V_DWELL_PATTERNS AS
SELECT
    domain,
    AVG(dwell_seconds) / 60.0           AS avg_dwell_minutes,
    MAX(dwell_seconds) / 60.0           AS max_dwell_minutes,
    COUNT(*)                             AS visit_count,
    COUNT(CASE WHEN is_distraction = FALSE THEN 1 END) AS work_visits
FROM TAB_EVENTS
WHERE dwell_seconds > 0
  AND event_time >= DATEADD('day', -14, CURRENT_TIMESTAMP())
GROUP BY domain ORDER BY avg_dwell_minutes DESC;

-- Nudge effectiveness (did nudges actually work?)
CREATE OR REPLACE VIEW V_NUDGE_EFFECTIVENESS AS
SELECT
    action_type,
    COUNT(*)                                     AS total_interventions,
    SUM(CASE WHEN user_returned = TRUE THEN 1 ELSE 0 END) AS returned_count,
    AVG(CASE WHEN user_returned = TRUE THEN 1 ELSE 0 END) * 100 AS return_rate_pct,
    AVG(return_delay_secs) / 60.0                AS avg_return_minutes
FROM INTERVENTIONS
WHERE intervened_at >= DATEADD('day', -14, CURRENT_TIMESTAMP())
GROUP BY action_type;

-- Decision patterns (what verdicts are most common)
CREATE OR REPLACE VIEW V_DECISION_PATTERNS AS
SELECT
    domain,
    verdict,
    COUNT(*) AS decision_count,
    AVG(intent_confidence) AS avg_confidence,
    AVG(dwell_seconds) / 60.0 AS avg_dwell_minutes
FROM AGENT_DECISIONS
WHERE decided_at >= DATEADD('day', -14, CURRENT_TIMESTAMP())
GROUP BY domain, verdict
ORDER BY decision_count DESC;
```

---

## 3.3 File: `backend/db/snowflake_client.py`

Snowflake connection management and query execution helpers:

```python
"""
Snowflake client for Deep Work Agent.
Handles connection pooling and query execution.
"""

import os
from typing import Any, Optional
from contextlib import contextmanager
import logging

import snowflake.connector
from snowflake.connector import DictCursor
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════

SNOWFLAKE_CONFIG = {
    "account": os.getenv("SNOWFLAKE_ACCOUNT"),
    "user": os.getenv("SNOWFLAKE_USER"),
    "password": os.getenv("SNOWFLAKE_PASSWORD"),
    "database": os.getenv("SNOWFLAKE_DATABASE", "DEEP_WORK"),
    "schema": os.getenv("SNOWFLAKE_SCHEMA", "AGENT"),
    "warehouse": os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
    "role": os.getenv("SNOWFLAKE_ROLE", "SYSADMIN"),
}

# Connection pool (simple singleton for now)
_connection: Optional[snowflake.connector.SnowflakeConnection] = None


# ═══════════════════════════════════════════════════════════════════════════
# Connection Management
# ═══════════════════════════════════════════════════════════════════════════

def get_connection() -> snowflake.connector.SnowflakeConnection:
    """
    Get or create a Snowflake connection.
    Uses a simple singleton pattern for connection reuse.
    """
    global _connection
    
    if _connection is None or _connection.is_closed():
        try:
            _connection = snowflake.connector.connect(**SNOWFLAKE_CONFIG)
            logger.info("Snowflake connection established")
        except Exception as e:
            logger.error(f"Failed to connect to Snowflake: {e}")
            raise
    
    return _connection


def close_connection():
    """Close the Snowflake connection if open."""
    global _connection
    
    if _connection is not None and not _connection.is_closed():
        _connection.close()
        _connection = None
        logger.info("Snowflake connection closed")


@contextmanager
def get_cursor():
    """
    Context manager for getting a cursor.
    Returns a DictCursor for easier result handling.
    """
    conn = get_connection()
    cursor = conn.cursor(DictCursor)
    try:
        yield cursor
    finally:
        cursor.close()


# ═══════════════════════════════════════════════════════════════════════════
# Query Execution Helpers
# ═══════════════════════════════════════════════════════════════════════════

def execute(query: str, params: tuple = None) -> list[dict[str, Any]]:
    """
    Execute a SELECT query and return results as list of dicts.
    
    Args:
        query: SQL query string with %s placeholders
        params: Tuple of parameters to substitute
        
    Returns:
        List of dictionaries with column names as keys
    """
    with get_cursor() as cursor:
        try:
            cursor.execute(query, params or ())
            results = cursor.fetchall()
            return results if results else []
        except Exception as e:
            logger.error(f"Query execution failed: {e}\nQuery: {query}")
            raise


def execute_write(query: str, params: tuple = None) -> int:
    """
    Execute an INSERT/UPDATE/DELETE query.
    
    Args:
        query: SQL query string with %s placeholders
        params: Tuple of parameters to substitute
        
    Returns:
        Number of rows affected
    """
    conn = get_connection()
    with conn.cursor() as cursor:
        try:
            cursor.execute(query, params or ())
            conn.commit()
            return cursor.rowcount
        except Exception as e:
            logger.error(f"Write execution failed: {e}\nQuery: {query}")
            conn.rollback()
            raise


def execute_many(query: str, params_list: list[tuple]) -> int:
    """
    Execute a query with multiple parameter sets (batch insert).
    
    Args:
        query: SQL query string with %s placeholders
        params_list: List of tuples, each containing parameters for one row
        
    Returns:
        Total number of rows affected
    """
    if not params_list:
        return 0
        
    conn = get_connection()
    with conn.cursor() as cursor:
        try:
            cursor.executemany(query, params_list)
            conn.commit()
            return cursor.rowcount
        except Exception as e:
            logger.error(f"Batch execution failed: {e}\nQuery: {query}")
            conn.rollback()
            raise


def execute_scalar(query: str, params: tuple = None) -> Any:
    """
    Execute a query and return a single value.
    
    Args:
        query: SQL query that returns a single value
        params: Tuple of parameters to substitute
        
    Returns:
        The first column of the first row, or None
    """
    with get_cursor() as cursor:
        try:
            cursor.execute(query, params or ())
            row = cursor.fetchone()
            if row:
                # DictCursor returns dict, get first value
                return list(row.values())[0] if isinstance(row, dict) else row[0]
            return None
        except Exception as e:
            logger.error(f"Scalar execution failed: {e}\nQuery: {query}")
            raise


# ═══════════════════════════════════════════════════════════════════════════
# Health Check
# ═══════════════════════════════════════════════════════════════════════════

def health_check() -> bool:
    """
    Check if Snowflake connection is healthy.
    
    Returns:
        True if connection works, False otherwise
    """
    try:
        result = execute_scalar("SELECT 1")
        return result == 1
    except Exception as e:
        logger.error(f"Snowflake health check failed: {e}")
        return False


def is_configured() -> bool:
    """
    Check if Snowflake credentials are configured.
    
    Returns:
        True if all required env vars are set
    """
    required = ["SNOWFLAKE_ACCOUNT", "SNOWFLAKE_USER", "SNOWFLAKE_PASSWORD"]
    return all(os.getenv(var) for var in required)
```

---

## 3.4 File: `backend/db/logger.py`

High-level logging functions for the agent:

```python
"""
Deep Work Agent - Snowflake Logger

High-level logging functions for tracking:
- Focus sessions
- Tab/app events
- Agent decisions
- Interventions
- Focus scores

This module maintains session state and provides the interface
used by the backend API and agents.
"""

import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, Any

from .snowflake_client import execute, execute_write, execute_scalar, is_configured

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════
# Session State
# ═══════════════════════════════════════════════════════════════════════════

_current_session_id: Optional[str] = None
_session_start_time: Optional[datetime] = None
_last_domain: Optional[str] = None
_last_domain_start: Optional[datetime] = None


# ═══════════════════════════════════════════════════════════════════════════
# Session Management
# ═══════════════════════════════════════════════════════════════════════════

def start_session(calendar_task: str = None) -> str:
    """
    Start a new focus session.
    
    Args:
        calendar_task: Current task from calendar (if available)
        
    Returns:
        The new session_id
    """
    global _current_session_id, _session_start_time
    
    # End any existing session first
    if _current_session_id:
        end_session()
    
    _current_session_id = str(uuid.uuid4())
    _session_start_time = datetime.utcnow()
    
    if is_configured():
        try:
            execute_write("""
                INSERT INTO FOCUS_SESSIONS (session_id, started_at, calendar_task)
                VALUES (%s, %s, %s)
            """, (_current_session_id, _session_start_time, calendar_task))
            logger.info(f"Started session: {_current_session_id}")
        except Exception as e:
            logger.error(f"Failed to log session start: {e}")
    
    return _current_session_id


def end_session(focus_score: float = None) -> Optional[dict]:
    """
    End the current focus session.
    
    Args:
        focus_score: Final focus score for the session (0-100)
        
    Returns:
        Session summary dict or None
    """
    global _current_session_id, _session_start_time
    
    if not _current_session_id:
        return None
    
    ended_at = datetime.utcnow()
    duration_secs = int((ended_at - _session_start_time).total_seconds()) if _session_start_time else 0
    
    # Get intervention count for this session
    intervention_count = 0
    if is_configured():
        try:
            result = execute_scalar("""
                SELECT COUNT(*) FROM INTERVENTIONS WHERE session_id = %s
            """, (_current_session_id,))
            intervention_count = result or 0
        except Exception:
            pass
    
    summary = {
        "session_id": _current_session_id,
        "duration_secs": duration_secs,
        "duration_minutes": round(duration_secs / 60, 1),
        "intervention_count": intervention_count,
        "focus_score": focus_score,
    }
    
    if is_configured():
        try:
            execute_write("""
                UPDATE FOCUS_SESSIONS
                SET ended_at = %s, duration_secs = %s, focus_score = %s, intervention_count = %s
                WHERE session_id = %s
            """, (ended_at, duration_secs, focus_score, intervention_count, _current_session_id))
            logger.info(f"Ended session: {_current_session_id} ({duration_secs}s)")
        except Exception as e:
            logger.error(f"Failed to log session end: {e}")
    
    _current_session_id = None
    _session_start_time = None
    
    return summary


def get_current_session_id() -> Optional[str]:
    """Get the current active session ID."""
    return _current_session_id


def get_session_duration_minutes() -> float:
    """Get duration of current session in minutes."""
    if not _session_start_time:
        return 0
    return round((datetime.utcnow() - _session_start_time).total_seconds() / 60, 1)


# ═══════════════════════════════════════════════════════════════════════════
# Tab/App Event Logging
# ═══════════════════════════════════════════════════════════════════════════

def log_tab_event(
    url: str,
    title: str,
    domain: str,
    is_distraction: bool = False,
    inferred_task: str = None,
    navigation_type: str = None,
    referrer: str = None,
    source: str = "browser"
) -> str:
    """
    Log a tab change or app switch event.
    
    Args:
        url: Full URL or app identifier
        title: Page title or window title
        domain: Domain or app name
        is_distraction: Whether this was classified as a distraction
        inferred_task: What user appears to be working on
        navigation_type: How user got here (direct_type|search_referrer|link_click)
        referrer: Previous URL/app
        source: Event source (browser|mac_system)
        
    Returns:
        The event_id
    """
    global _last_domain, _last_domain_start
    
    event_id = str(uuid.uuid4())
    
    # Calculate dwell time on previous domain
    dwell_seconds = 0
    if _last_domain and _last_domain_start:
        dwell_seconds = int((datetime.utcnow() - _last_domain_start).total_seconds())
        
        # Update previous event with dwell time if we have it
        if is_configured() and dwell_seconds > 0:
            try:
                execute_write("""
                    UPDATE TAB_EVENTS
                    SET dwell_seconds = %s
                    WHERE session_id = %s AND domain = %s AND dwell_seconds = 0
                    ORDER BY event_time DESC LIMIT 1
                """, (dwell_seconds, _current_session_id, _last_domain))
            except Exception:
                pass  # Not critical if this fails
    
    # Update tracking for next event
    _last_domain = domain
    _last_domain_start = datetime.utcnow()
    
    if is_configured():
        try:
            execute_write("""
                INSERT INTO TAB_EVENTS (
                    event_id, session_id, url, title, domain, is_distraction,
                    inferred_task, navigation_type, referrer, source
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                event_id,
                _current_session_id,
                url[:2000] if url else None,  # Truncate to fit
                title[:500] if title else None,
                domain[:200] if domain else None,
                is_distraction,
                inferred_task[:500] if inferred_task else None,
                navigation_type,
                referrer[:200] if referrer else None,
                source,
            ))
        except Exception as e:
            logger.error(f"Failed to log tab event: {e}")
    
    return event_id


# ═══════════════════════════════════════════════════════════════════════════
# Agent Decision Logging
# ═══════════════════════════════════════════════════════════════════════════

def log_agent_decision(decision: dict) -> str:
    """
    Log every agent decision — including allows and monitors.
    This is what makes the agent smarter over time.
    
    Args:
        decision: Dict containing:
            - domain: Domain being evaluated
            - app: App name (for mac_system events)
            - url_type: specific_video|homepage|specific_page|feed
            - navigation_type: How user got here
            - intent: work_related|ambiguous|distraction
            - intent_confidence: 0.0-1.0
            - verdict: allow|monitor|ask|nudge|block
            - primary_reason: Explanation for the decision
            - dwell_seconds: Time on this domain
            - grace_period_total: Total grace period granted
            
    Returns:
        The decision_id
    """
    decision_id = str(uuid.uuid4())
    
    if is_configured():
        try:
            execute_write("""
                INSERT INTO AGENT_DECISIONS (
                    decision_id, session_id, domain, app, url_type, navigation_type,
                    intent, intent_confidence, verdict, primary_reason,
                    dwell_seconds, grace_period_total
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                decision_id,
                _current_session_id,
                decision.get("domain", "")[:200],
                decision.get("app", "")[:100] if decision.get("app") else None,
                decision.get("url_type", ""),
                decision.get("navigation_type", ""),
                decision.get("intent", ""),
                decision.get("intent_confidence", 0),
                decision.get("verdict", ""),
                decision.get("primary_reason", "")[:500],
                decision.get("dwell_seconds", 0),
                decision.get("grace_period_total", 0),
            ))
            logger.debug(f"Logged decision: {decision.get('verdict')} for {decision.get('domain')}")
        except Exception as e:
            logger.error(f"Failed to log agent decision: {e}")
    
    return decision_id


def update_decision_response(decision_id: str, user_response: str, escalation_fired: bool = False):
    """
    Update a decision with user response after the fact.
    
    Args:
        decision_id: The decision to update
        user_response: returned_to_work|ignored|confirmed_work
        escalation_fired: Whether escalation was triggered
    """
    if is_configured():
        try:
            execute_write("""
                UPDATE AGENT_DECISIONS
                SET user_response = %s, escalation_fired = %s
                WHERE decision_id = %s
            """, (user_response, escalation_fired, decision_id))
        except Exception as e:
            logger.error(f"Failed to update decision response: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# Intervention Logging
# ═══════════════════════════════════════════════════════════════════════════

def log_intervention(
    domain: str,
    action_type: str,
    message: str = None
) -> str:
    """
    Log when an intervention was triggered.
    
    Args:
        domain: Domain/app that triggered intervention
        action_type: show_nudge|show_block|send_slack|show_overlay
        message: The intervention message shown to user
        
    Returns:
        The intervention_id
    """
    intervention_id = str(uuid.uuid4())
    hour_of_day = datetime.utcnow().hour
    
    if is_configured():
        try:
            execute_write("""
                INSERT INTO INTERVENTIONS (
                    intervention_id, session_id, domain, action_type, message, hour_of_day
                )
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                intervention_id,
                _current_session_id,
                domain[:200] if domain else None,
                action_type,
                message[:500] if message else None,
                hour_of_day,
            ))
            logger.info(f"Logged intervention: {action_type} for {domain}")
        except Exception as e:
            logger.error(f"Failed to log intervention: {e}")
    
    return intervention_id


def update_intervention_response(intervention_id: str, user_returned: bool, return_delay_secs: int = None):
    """
    Update intervention with user response.
    
    Args:
        intervention_id: The intervention to update
        user_returned: Did user return to work?
        return_delay_secs: How long it took them to return
    """
    if is_configured():
        try:
            execute_write("""
                UPDATE INTERVENTIONS
                SET user_returned = %s, return_delay_secs = %s
                WHERE intervention_id = %s
            """, (user_returned, return_delay_secs, intervention_id))
        except Exception as e:
            logger.error(f"Failed to update intervention response: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# Focus Score Logging
# ═══════════════════════════════════════════════════════════════════════════

def log_hourly_focus_score(hour_of_day: int, focus_score: float):
    """
    Log focus score for a specific hour.
    
    Args:
        hour_of_day: 0-23
        focus_score: 0-100
    """
    if is_configured():
        try:
            execute_write("""
                INSERT INTO HOURLY_FOCUS_SCORES (hour_of_day, focus_score)
                VALUES (%s, %s)
            """, (hour_of_day, focus_score))
        except Exception as e:
            logger.error(f"Failed to log hourly focus score: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# Context Retrieval (for Agent Decision Making)
# ═══════════════════════════════════════════════════════════════════════════

def get_session_context() -> dict:
    """
    Get extended context for the Analyzer Agent.
    Includes behavioral patterns from history.
    
    Returns:
        Dict with session stats and behavioral patterns
    """
    context = {
        "session_id": _current_session_id,
        "session_minutes": get_session_duration_minutes(),
        "interventions_today": 0,
        "avg_focus_score": None,
        "top_distraction": None,
        "current_hour_score": None,
        "youtube_avg_duration": None,
        "slack_avg_duration": None,
        "nudge_return_rate": None,
    }
    
    if not is_configured():
        return context
    
    try:
        # Interventions today
        result = execute_scalar("""
            SELECT COUNT(*) FROM INTERVENTIONS
            WHERE DATE(intervened_at) = CURRENT_DATE()
        """)
        context["interventions_today"] = result or 0
        
        # Average focus score (last 7 days)
        result = execute_scalar("""
            SELECT AVG(focus_score) FROM FOCUS_SESSIONS
            WHERE focus_score IS NOT NULL
              AND started_at >= DATEADD('day', -7, CURRENT_TIMESTAMP())
        """)
        context["avg_focus_score"] = round(result, 1) if result else None
        
        # Top distraction
        top_distractions = execute("""
            SELECT domain FROM V_TOP_DISTRACTIONS LIMIT 1
        """)
        if top_distractions:
            context["top_distraction"] = top_distractions[0].get("DOMAIN")
        
        # Current hour's historical focus score
        current_hour = datetime.utcnow().hour
        result = execute_scalar("""
            SELECT AVG(focus_score) FROM HOURLY_FOCUS_SCORES
            WHERE hour_of_day = %s
              AND session_date >= DATEADD('day', -14, CURRENT_DATE())
        """, (current_hour,))
        context["current_hour_score"] = round(result, 1) if result else None
        
        # YouTube average dwell pattern
        yt_patterns = execute("""
            SELECT avg_dwell_minutes FROM V_DWELL_PATTERNS
            WHERE domain = 'youtube.com'
        """)
        if yt_patterns:
            context["youtube_avg_duration"] = round(yt_patterns[0].get("AVG_DWELL_MINUTES", 0), 1)
        
        # Slack average dwell pattern
        slack_patterns = execute("""
            SELECT avg_dwell_minutes FROM V_DWELL_PATTERNS
            WHERE domain LIKE '%slack%'
        """)
        if slack_patterns:
            context["slack_avg_duration"] = round(slack_patterns[0].get("AVG_DWELL_MINUTES", 0), 1)
        
        # Nudge effectiveness
        nudge_eff = execute("""
            SELECT return_rate_pct FROM V_NUDGE_EFFECTIVENESS
            WHERE action_type = 'show_nudge'
        """)
        if nudge_eff:
            context["nudge_return_rate"] = round(nudge_eff[0].get("RETURN_RATE_PCT", 0), 0)
        
    except Exception as e:
        logger.error(f"Failed to get session context: {e}")
    
    return context


def get_today_summary() -> dict:
    """
    Get today's focus summary for the dashboard.
    
    Returns:
        Dict with today's stats
    """
    summary = {
        "sessions_today": 0,
        "focus_minutes_today": 0,
        "avg_focus_score_today": None,
        "total_interventions_today": 0,
        "last_session_start": None,
    }
    
    if not is_configured():
        return summary
    
    try:
        results = execute("SELECT * FROM V_TODAY_SUMMARY")
        if results and results[0]:
            row = results[0]
            summary["sessions_today"] = row.get("SESSIONS_TODAY", 0)
            summary["focus_minutes_today"] = round(row.get("FOCUS_MINUTES_TODAY", 0) or 0, 1)
            summary["avg_focus_score_today"] = round(row.get("AVG_FOCUS_SCORE_TODAY", 0), 1) if row.get("AVG_FOCUS_SCORE_TODAY") else None
            summary["total_interventions_today"] = row.get("TOTAL_INTERVENTIONS_TODAY", 0)
            summary["last_session_start"] = row.get("LAST_SESSION_START")
    except Exception as e:
        logger.error(f"Failed to get today summary: {e}")
    
    return summary


def get_top_distractions(days: int = 7, limit: int = 5) -> list[dict]:
    """
    Get top distractions from the last N days.
    
    Args:
        days: Number of days to look back
        limit: Max number of results
        
    Returns:
        List of dicts with domain and visit_count
    """
    if not is_configured():
        return []
    
    try:
        results = execute("""
            SELECT domain, COUNT(*) as visit_count
            FROM TAB_EVENTS
            WHERE is_distraction = TRUE
              AND event_time >= DATEADD('day', -%s, CURRENT_TIMESTAMP())
            GROUP BY domain
            ORDER BY visit_count DESC
            LIMIT %s
        """, (days, limit))
        
        return [
            {"domain": r.get("DOMAIN"), "visit_count": r.get("VISIT_COUNT")}
            for r in results
        ]
    except Exception as e:
        logger.error(f"Failed to get top distractions: {e}")
        return []


def get_hourly_focus_pattern() -> list[dict]:
    """
    Get average focus score by hour of day.
    
    Returns:
        List of dicts with hour_of_day and avg_focus_score
    """
    if not is_configured():
        return []
    
    try:
        results = execute("SELECT * FROM V_HOURLY_FOCUS_PATTERN ORDER BY hour_of_day")
        return [
            {
                "hour_of_day": r.get("HOUR_OF_DAY"),
                "avg_focus_score": round(r.get("AVG_FOCUS_SCORE", 0), 1),
                "sample_count": r.get("SAMPLE_COUNT", 0),
            }
            for r in results
        ]
    except Exception as e:
        logger.error(f"Failed to get hourly focus pattern: {e}")
        return []


def get_domain_dwell_time(domain: str) -> Optional[float]:
    """
    Get average dwell time for a specific domain.
    
    Args:
        domain: Domain to look up
        
    Returns:
        Average dwell time in minutes, or None
    """
    if not is_configured():
        return None
    
    try:
        result = execute_scalar("""
            SELECT AVG(dwell_seconds) / 60.0
            FROM TAB_EVENTS
            WHERE domain = %s AND dwell_seconds > 0
              AND event_time >= DATEADD('day', -14, CURRENT_TIMESTAMP())
        """, (domain,))
        return round(result, 1) if result else None
    except Exception as e:
        logger.error(f"Failed to get domain dwell time: {e}")
        return None
```

---

## 3.5 File: `backend/db/__init__.py`

Module exports:

```python
"""
Deep Work Agent - Database Layer

Provides Snowflake connection management and logging functions
for tracking focus sessions, tab events, agent decisions, and interventions.
"""

from .snowflake_client import (
    get_connection,
    close_connection,
    execute,
    execute_write,
    execute_many,
    execute_scalar,
    health_check,
    is_configured,
)

from .logger import (
    # Session management
    start_session,
    end_session,
    get_current_session_id,
    get_session_duration_minutes,
    
    # Event logging
    log_tab_event,
    log_agent_decision,
    update_decision_response,
    log_intervention,
    update_intervention_response,
    log_hourly_focus_score,
    
    # Context retrieval
    get_session_context,
    get_today_summary,
    get_top_distractions,
    get_hourly_focus_pattern,
    get_domain_dwell_time,
)

__all__ = [
    # Snowflake client
    "get_connection",
    "close_connection",
    "execute",
    "execute_write",
    "execute_many",
    "execute_scalar",
    "health_check",
    "is_configured",
    
    # Session management
    "start_session",
    "end_session",
    "get_current_session_id",
    "get_session_duration_minutes",
    
    # Event logging
    "log_tab_event",
    "log_agent_decision",
    "update_decision_response",
    "log_intervention",
    "update_intervention_response",
    "log_hourly_focus_score",
    
    # Context retrieval
    "get_session_context",
    "get_today_summary",
    "get_top_distractions",
    "get_hourly_focus_pattern",
    "get_domain_dwell_time",
]
```

---

## 3.6 Usage Examples

### Starting a Session
```python
from backend.db import start_session, end_session

# Start session with calendar task
session_id = start_session(calendar_task="Implement Snowflake logging")

# ... do work ...

# End session with focus score
summary = end_session(focus_score=85.5)
print(f"Session lasted {summary['duration_minutes']} minutes")
```

### Logging Events
```python
from backend.db import log_tab_event, log_agent_decision, log_intervention

# Log a tab change
log_tab_event(
    url="https://youtube.com/watch?v=abc123",
    title="FastAPI Tutorial",
    domain="youtube.com",
    is_distraction=False,
    navigation_type="search_referrer",
    referrer="google.com"
)

# Log agent decision
log_agent_decision({
    "domain": "youtube.com",
    "url_type": "specific_video",
    "navigation_type": "search_referrer",
    "intent": "work_related",
    "intent_confidence": 0.85,
    "verdict": "allow",
    "primary_reason": "Specific video reached via search, likely tutorial",
    "grace_period_total": 720
})

# Log intervention
intervention_id = log_intervention(
    domain="twitter.com",
    action_type="show_nudge",
    message="You've been on Twitter for 5 minutes. Back to work?"
)
```

### Getting Context for Agent
```python
from backend.db import get_session_context

context = get_session_context()
print(f"Session: {context['session_minutes']} mins")
print(f"YouTube avg: {context['youtube_avg_duration']} mins")
print(f"Nudge return rate: {context['nudge_return_rate']}%")
```

---

## 3.7 Verification Checklist

- [ ] Schema runs without errors in Snowflake
- [ ] 5 tables created: `FOCUS_SESSIONS`, `TAB_EVENTS`, `AGENT_DECISIONS`, `INTERVENTIONS`, `HOURLY_FOCUS_SCORES`
- [ ] 6 views created including `V_DWELL_PATTERNS` and `V_NUDGE_EFFECTIVENESS`
- [ ] `is_configured()` returns True with valid env vars
- [ ] `health_check()` returns True when connected
- [ ] Start session → `FOCUS_SESSIONS` row inserted
- [ ] Tab change → `TAB_EVENTS` row with `navigation_type` and `dwell_seconds`
- [ ] Agent makes decision → `AGENT_DECISIONS` row logged (even for `allow`)
- [ ] Intervention fires → `INTERVENTIONS` row with `action_type`
- [ ] After 2+ sessions: `V_DWELL_PATTERNS` shows YouTube and Slack averages
- [ ] After interventions: `V_NUDGE_EFFECTIVENESS` shows return rate
- [ ] `get_session_context()` returns `youtube_avg_duration` and `nudge_return_rate`

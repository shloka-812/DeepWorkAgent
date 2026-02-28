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

## 3.2 Updated File: `backend/db/schema.sql`

Run this in the Snowflake SQL Worksheet:

```sql
CREATE DATABASE IF NOT EXISTS DEEP_WORK;
USE DATABASE DEEP_WORK;
CREATE SCHEMA IF NOT EXISTS AGENT;
USE SCHEMA AGENT;

-- ═══════════════════════════════════════════════════════════
-- FOCUS SESSIONS
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS FOCUS_SESSIONS (
    session_id         VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    started_at         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    ended_at           TIMESTAMP_NTZ,
    duration_secs      INTEGER,
    focus_score        FLOAT,
    intervention_count INTEGER DEFAULT 0,
    calendar_task      VARCHAR(500),    -- NEW: what calendar said to do
    created_at         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ═══════════════════════════════════════════════════════════
-- TAB EVENTS
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS TAB_EVENTS (
    event_id           VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    session_id         VARCHAR(36),
    url                VARCHAR(2000),
    title              VARCHAR(500),
    domain             VARCHAR(200),
    is_distraction     BOOLEAN DEFAULT FALSE,
    inferred_task      VARCHAR(500),
    navigation_type    VARCHAR(50),     -- NEW: direct_type|search_referrer|link_click
    referrer           VARCHAR(200),    -- NEW: where user came from
    dwell_seconds      INTEGER DEFAULT 0, -- NEW: time on this domain
    source             VARCHAR(20) DEFAULT 'browser', -- NEW: browser|mac_system
    event_time         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ═══════════════════════════════════════════════════════════
-- AGENT DECISIONS  ← NEW TABLE
-- Logs every decision the agent made including allows
-- ═══════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════
-- INTERVENTIONS
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS INTERVENTIONS (
    intervention_id    VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    session_id         VARCHAR(36),
    domain             VARCHAR(200),
    action_type        VARCHAR(50),
    message            VARCHAR(500),
    hour_of_day        INTEGER,
    user_returned      BOOLEAN,         -- NEW: did user go back to work?
    return_delay_secs  INTEGER,         -- NEW: how long before returning?
    intervened_at      TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ═══════════════════════════════════════════════════════════
-- HOURLY FOCUS SCORES
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS HOURLY_FOCUS_SCORES (
    score_id      VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    hour_of_day   INTEGER NOT NULL,
    focus_score   FLOAT NOT NULL,
    session_date  DATE DEFAULT CURRENT_DATE(),
    recorded_at   TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ═══════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════

-- Today's summary
CREATE OR REPLACE VIEW V_TODAY_SUMMARY AS
SELECT
    COUNT(DISTINCT s.session_id)         AS sessions_today,
    SUM(s.duration_secs) / 60.0         AS focus_minutes_today,
    AVG(s.focus_score)                   AS avg_focus_score_today,
    SUM(s.intervention_count)            AS total_interventions_today,
    MAX(s.started_at)                    AS last_session_start
FROM FOCUS_SESSIONS s
WHERE DATE(s.started_at) = CURRENT_DATE();

-- Top distractions
CREATE OR REPLACE VIEW V_TOP_DISTRACTIONS AS
SELECT domain, COUNT(*) AS visit_count
FROM TAB_EVENTS
WHERE is_distraction = TRUE
  AND event_time >= DATEADD('day', -7, CURRENT_TIMESTAMP())
GROUP BY domain ORDER BY visit_count DESC LIMIT 5;

-- Hourly focus pattern
CREATE OR REPLACE VIEW V_HOURLY_FOCUS_PATTERN AS
SELECT hour_of_day, AVG(focus_score) AS avg_focus_score, COUNT(*) AS sample_count
FROM HOURLY_FOCUS_SCORES
WHERE session_date >= DATEADD('day', -14, CURRENT_DATE())
GROUP BY hour_of_day ORDER BY hour_of_day;

-- NEW: Dwell patterns by domain (helps calibrate grace periods)
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

-- NEW: Nudge effectiveness (did nudges actually work?)
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
```

---

## 3.3 Updated File: `backend/db/logger.py`

New functions added:

```python
def log_agent_decision(decision: dict):
    """
    Log every agent decision — including allows and monitors.
    This is what makes the agent smarter over time.
    """
    execute_write("""
        INSERT INTO AGENT_DECISIONS (
            session_id, domain, app, url_type, navigation_type,
            intent, intent_confidence, verdict, primary_reason,
            dwell_seconds, grace_period_total
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        _current_session_id,
        decision.get("domain", ""),
        decision.get("app", ""),
        decision.get("url_type", ""),
        decision.get("navigation_type", ""),
        decision.get("intent", ""),
        decision.get("intent_confidence", 0),
        decision.get("verdict", ""),
        decision.get("primary_reason", "")[:500],
        decision.get("dwell_seconds", 0),
        decision.get("grace_period_total", 0),
    ))

def get_session_context() -> dict:
    """
    Extended context for Analyzer Agent — now includes
    YouTube and Slack behavioral patterns from history.
    """
    # ... existing queries ...

    # NEW: YouTube dwell pattern
    yt_patterns = execute("""
        SELECT avg_dwell_minutes FROM V_DWELL_PATTERNS
        WHERE domain = 'youtube.com'
    """)
    youtube_avg = round(yt_patterns[0]["AVG_DWELL_MINUTES"], 1) if yt_patterns else None

    # NEW: Slack dwell pattern
    slack_patterns = execute("""
        SELECT avg_dwell_minutes FROM V_DWELL_PATTERNS
        WHERE domain LIKE '%slack%'
    """)
    slack_avg = round(slack_patterns[0]["AVG_DWELL_MINUTES"], 1) if slack_patterns else None

    # NEW: Nudge effectiveness
    nudge_eff = execute("""
        SELECT return_rate_pct FROM V_NUDGE_EFFECTIVENESS
        WHERE action_type = 'show_nudge'
    """)
    nudge_return_rate = round(nudge_eff[0]["RETURN_RATE_PCT"], 0) if nudge_eff else None

    return {
        # Existing fields
        "interventions_today": ...,
        "avg_focus_score": ...,
        "top_distraction": ...,
        "current_hour_score": ...,
        "session_minutes": ...,
        # New fields
        "youtube_avg_duration": youtube_avg,     # mins user typically spends on YouTube
        "slack_avg_duration": slack_avg,          # mins user typically spends on Slack
        "nudge_return_rate": nudge_return_rate,   # % of nudges that worked
    }
```

---

## 3.4 Verification Checklist

- [ ] Schema runs without errors in Snowflake
- [ ] 4 tables created: `FOCUS_SESSIONS`, `TAB_EVENTS`, `AGENT_DECISIONS`, `INTERVENTIONS`
- [ ] 6 views created including `V_DWELL_PATTERNS` and `V_NUDGE_EFFECTIVENESS`
- [ ] Start session → `FOCUS_SESSIONS` row inserted
- [ ] Tab change → `TAB_EVENTS` row with `navigation_type` and `dwell_seconds`
- [ ] Agent makes decision → `AGENT_DECISIONS` row logged (even for `allow`)
- [ ] Intervention fires → `INTERVENTIONS` row with `action_type`
- [ ] After 2+ sessions: `V_DWELL_PATTERNS` shows YouTube and Slack averages
- [ ] After interventions: `V_NUDGE_EFFECTIVENESS` shows return rate
- [ ] `get_session_context()` returns `youtube_avg_duration` and `nudge_return_rate`

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

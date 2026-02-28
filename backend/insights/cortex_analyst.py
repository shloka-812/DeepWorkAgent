import json
from db.snowflake_client import execute
from llm import cortex_complete

def get_grace_period_recommendations() -> str:
    """
    Ask Cortex to recommend personalized grace period adjustments.
    """
    dwell_data = execute("SELECT * FROM V_DWELL_PATTERNS LIMIT 10")
    if not dwell_data:
        return "No dwell data yet to calibrate grace periods."

    return cortex_complete(f"""
        Based on this user's actual browsing dwell patterns:
        {json.dumps(dwell_data)}

        Suggest 1-2 specific grace period adjustments in plain English.
        Reference specific sites and actual numbers from the data.
        Keep it under 2 sentences. No jargon.
    """)

def get_nudge_effectiveness_summary() -> str:
    """
    Summarize how well the agent's interventions are working.
    """
    eff_data = execute("SELECT * FROM V_NUDGE_EFFECTIVENESS")
    if not eff_data:
        return "Nudges are working well so far."

    return cortex_complete(f"""
        Based on this intervention effectiveness data:
        {json.dumps(eff_data)}

        Write one sentence summarizing how well the agent's
        interventions are working for this user.
        Be specific — mention the return rate percentage if available.
    """)

def get_drift_pattern_analysis() -> str:
    """
    Analyze when within-work drift happens most.
    """
    decisions = execute("""
        SELECT verdict, COUNT(*) as count,
               AVG(intent_confidence) as avg_confidence,
               domain
        FROM AGENT_DECISIONS
        WHERE decided_at >= DATEADD('day', -7, CURRENT_TIMESTAMP())
        GROUP BY verdict, domain
        ORDER BY count DESC
        LIMIT 15
    """)
    if not decisions:
        return "Your focus patterns are stable this week."

    return cortex_complete(f"""
        Based on these agent decision patterns over the last 7 days:
        {json.dumps(decisions)}

        Identify the most interesting pattern — when does this user
        drift most? What does the agent allow vs. block most?
        One sentence, specific, no jargon.
    """)

def get_decision_breakdown() -> dict:
    """Counts of each verdict type this week."""
    rows = execute("""
        SELECT verdict, COUNT(*) as count
        FROM AGENT_DECISIONS
        WHERE decided_at >= DATEADD('day', -7, CURRENT_TIMESTAMP())
        GROUP BY verdict
    """)
    return {r["VERDICT"]: r["COUNT"] for r in rows}

def get_full_insights() -> dict:
    """
    Aggregates all insights for the dashboard.
    """
    today = execute("SELECT * FROM V_TODAY_SUMMARY")
    summary = today[0] if today else {}
    
    top_distractions = execute("SELECT * FROM V_TOP_DISTRACTIONS")
    
    return {
        "summary": {
            "sessions": summary.get("SESSIONS_TODAY", 0),
            "minutes": summary.get("FOCUS_MINUTES_TODAY", 0),
            "focus_score": summary.get("AVG_FOCUS_SCORE_TODAY", 0),
            "interventions": summary.get("TOTAL_INTERVENTIONS_TODAY", 0)
        },
        "top_distractions": top_distractions,
        "grace_period_tip": get_grace_period_recommendations(),
        "nudge_effectiveness": get_nudge_effectiveness_summary(),
        "drift_pattern": get_drift_pattern_analysis(),
        "decision_breakdown": get_decision_breakdown()
    }

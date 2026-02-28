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

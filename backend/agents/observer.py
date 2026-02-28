from crewai import Agent
from llm import get_llm

def get_observer_agent():
    return Agent(
        role="Digital Context Observer",
        goal="Objectively classify the user's current digital activity and detect intent markers.",
        backstory="""You are an expert at understanding digital behavior. You don't judge; 
        you simply observe and classify. You look at URLs, window titles, navigation history, 
        and calendar context to determine if a visit is purposeful, accidental, 
        or a known 'rabbit hole' distraction.""",
        llm=get_llm(),
        allow_delegation=False,
        verbose=True
    )

# Prompt template for the observer task
OBSERVER_TASK_PROMPT = """
Analyze the following telemetry from the user's device:

EVENT: {event_type}
URL: {url}
DOMAIN: {domain}
TITLE: {title}
NAV_TYPE: {navigation_type}
REFERRER: {referrer}
DWELL: {dwell_seconds}s
APP: {app}
WINDOW: {window_title}
CALENDAR: {calendar_context}

YOUR GOAL:
1. Classify the INTENT: Is it 'work_related', 'potential_distraction', or 'clear_rabbit_hole'?
2. Check GRACE PERIOD: 
   - YouTube: 5 min base, +7 if specific video title matches work (e.g. tutorial).
   - Slack/Teams: 10 min.
   - Social Media (X, Reddit, FB): 0 min.
   - Coding (GitHub, StackOverflow): Never block.
3. ALIGNMENT: Does this activity align with the current calendar event?

OUTPUT (JSON format):
{{
  "intent": "string",
  "intent_confidence": 0-1.0,
  "calendar_alignment": "low|medium|high",
  "grace_period_status": "active|exceeded|none",
  "classification_reason": "string"
}}
"""

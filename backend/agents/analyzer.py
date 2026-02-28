from crewai import Agent
from llm import get_llm

def get_analyzer_agent():
    return Agent(
        role="Deep Work Performance Analyst",
        goal="Weigh the observer's findings against session health and time pressure to decide if intervention is needed.",
        backstory="""You are the strategist. You decide when to be lenient and when to be 
        strict. You consider the 'cost' of an intervention (breaking flow) vs the 'cost' 
        of the distraction. You identify patterns—is this the first YouTube visit, 
        or the fifth in an hour?""",
        llm=get_llm(),
        allow_delegation=False,
        verbose=True
    )

ANALYZER_TASK_PROMPT = """
Review the Observer's findings:
{observer_output}

Consider these factors:
1. SESSION HEALTH: If this is a first-time minor distraction in a long focus block, be lenient ('monitor').
2. TIME PRESSURE: If a meeting is starting in <10 mins, be strict ('show_nudge').
3. GRACE PERIOD: If grace period is exceeded AND intent is low, escalate.
4. HISTORICAL PATTERNS: Use the user's past behavior to calibrate:
   {history_context}
   - If user typically spends 5 mins on YouTube tutorials (well within grace), be lenient.
   - If User typically spirals after a certain duration, intervene sooner.
   - If nudge return rate is low, prefer 'ask' or 'block' over repeated nudges.

VERDICT TYPES:
- 'none': Allow, no action.
- 'monitor': Silent monitoring, start a timer.
- 'ask': Show intent dialog (unclear intent).
- 'show_nudge': Notification.
- 'block_tab': Immediate block.

OUTPUT (JSON format):
{{
  "verdict": "none|monitor|ask|show_nudge|block_tab",
  "reasoning": "one sentence explaining how intent, timing, and history weighed into the decision",
  "escalation_strategy": {{
    "check_again_seconds": int,
    "next_action": "string"
  }}
}}
"""

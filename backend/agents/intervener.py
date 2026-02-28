from crewai import Agent
from llm import get_llm

def get_intervener_agent():
    return Agent(
        role="Assistant Interventionist",
        goal="Craft the perfect user-facing message and escalation schedule for the decided action.",
        backstory="""You are the voice of the agent. You are helpful, firm, but never 
        annoying. You don't use generic corporate speak like 'stay focused'. 
        You use specific context (e.g., 'You have 20 mins left in your Coding block') 
        to motivate the user to return to work.""",
        llm=get_llm(),
        allow_delegation=False,
        verbose=True
    )

INTERVENER_TASK_PROMPT = """
Based on the Analyzer's verdict:
{analyzer_output}

Current Task context: {current_task}

TASK:
1. Craft a 'notification_message' (max 12 words).
2. Craft a 'slack_message' (1-2 sentences, warmer tone).
3. If the verdict is 'monitor', create a 'escalation_schedule' (list of delays and future actions).

Rules:
- Refer to the specific task/calendar event if known.
- No 'optimize focus' or 'productivity' buzzwords.

OUTPUT (JSON format):
{{
  "action": "none|monitor|ask|show_nudge|block_tab",
  "message": "notification text",
  "slack_message": "slack text",
  "ask_question": "question if action=ask",
  "escalation_schedule": [
    {{ "delay_seconds": int, "action": "none|monitor|ask|show_nudge|block_tab", "notification_message": "string" }}
  ]
}}
"""

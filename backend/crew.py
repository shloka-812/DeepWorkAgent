from typing import Dict, List
from crewai import Crew, Task, Process
from agents.observer import get_observer_agent, OBSERVER_TASK_PROMPT
from agents.analyzer import get_analyzer_agent, ANALYZER_TASK_PROMPT
from agents.intervener import get_intervener_agent, INTERVENER_TASK_PROMPT
from models import AgentResponse, TabEvent, EscalationStep
import json
import asyncio

def run_crew(event: TabEvent, calendar_context: dict = None, history_context: dict = None) -> AgentResponse:
    # 1. Setup Agents
    observer = get_observer_agent()
    analyzer = get_analyzer_agent()
    intervener = get_intervener_agent()

    # 2. Define Tasks
    # Format the calendar context for the agents
    if calendar_context:
        calendar_ctx_str = (
            f"Current Event: '{calendar_context.get('current_event')}' "
            f"({calendar_context.get('start_time')} - {calendar_context.get('end_time')}, "
            f"{calendar_context.get('minutes_remaining')} mins remaining). "
            f"Next: '{calendar_context.get('next_event')}' at {calendar_context.get('next_start_time')}."
        )
    else:
        calendar_ctx_str = "No specific calendar event scheduled."
    
    # Format historical context
    if history_context:
        history_ctx_str = (
            f"User History: Avg YouTube dwell: {history_context.get('youtube_avg_duration')} mins. "
            f"Avg Slack dwell: {history_context.get('slack_avg_duration')} mins. "
            f"Nudge return rate: {history_context.get('nudge_return_rate')}%. "
            f"Interventions today: {history_context.get('interventions_today')}."
        )
    else:
        history_ctx_str = "No historical data available for this user yet."
    
    t1 = Task(
        description=OBSERVER_TASK_PROMPT.format(
            event_type=event.event,
            url=event.url or "N/A",
            domain=event.domain or "N/A",
            title=event.title or "N/A",
            navigation_type=event.navigation_type or "direct",
            referrer=event.referrer or "N/A",
            dwell_seconds=event.dwell_seconds or 0,
            app=event.app or "N/A",
            window_title=event.window_title or "N/A",
            calendar_context=calendar_ctx_str
        ),
        expected_output="JSON classification of intent and context.",
        agent=observer
    )

    t2 = Task(
        description=ANALYZER_TASK_PROMPT.format(
            observer_output="{t1_output}",
            history_context=history_ctx_str
        ),
        expected_output="JSON verdict and escalation strategy.",
        agent=analyzer,
        context=[t1]
    )

    t3 = Task(
        description=INTERVENER_TASK_PROMPT.format(
            analyzer_output="{t2_output}",
            current_task=calendar_ctx_str
        ),
        expected_output="Final JSON AgentResponse structure.",
        agent=intervener,
        context=[t2]
    )

    # 3. Assemble Crew
    crew = Crew(
        agents=[observer, analyzer, intervener],
        tasks=[t1, t2, t3],
        process=Process.sequential,
        verbose=True,
        embedder={
            "provider": "google",
            "config": {
                "model": "models/embedding-001",
                "task_type": "retrieval_document",
            }
        } if False else None # Disable for now to avoid complexity
    )

    # 4. Execute
    crew_output = crew.kickoff()
    
    # Try to parse the result as JSON
    try:
        # CrewAI 1.x returns a CrewOutput object. 
        # The result string is in .raw or can be accessed via str()
        result_str = str(crew_output).strip()
        
        # Some LLMs might wrap JSON in backticks
        if "```json" in result_str:
            result_str = result_str.split("```json")[1].split("```")[0].strip()
        elif "```" in result_str:
            result_str = result_str.split("```")[1].split("```")[0].strip()
            
        data = json.loads(result_str)
        return AgentResponse(**data)
    except Exception as e:
        print(f"Error parsing crew output: {e}")
        return AgentResponse(
            action="none",
            reasoning=f"Crew failed to parse: {str(e)}"
        )

# Global store for active escalation tasks { key: [asyncio.Task] }
active_escalations: Dict[str, List[asyncio.Task]] = {}

def get_escalation_key(domain: str = None, app: str = None) -> str:
    """Generate a unique key for the current distraction context."""
    return f"{domain or 'unknown'}_{app or 'unknown'}"

async def run_escalation_step(step: EscalationStep):
    """Executes a single escalation step after its delay."""
    await asyncio.sleep(step.delay_seconds)
    print(f"[Escalation] Firing action: {step.action}")
    
    if step.slack_message:
        await asyncio.to_thread(send_slack_nudge, step.slack_message)
    
    # In a real app, we might push a notification to the frontend here via WebSockets
    # For now, we log it. The extension will also receive the initial AgentResponse.

async def schedule_escalations(key: str, schedule: List[EscalationStep]):
    """Schedules a series of escalation steps."""
    # Cancel any existing escalations for this key first
    cancel_escalations(key)
    
    tasks = []
    for step in schedule:
        task = asyncio.create_task(run_escalation_step(step))
        tasks.append(task)
    
    active_escalations[key] = tasks
    print(f"[Escalation] Scheduled {len(tasks)} steps for {key}")

def cancel_escalations(key: str):
    """Cancels all pending escalation tasks for a given key."""
    if key in active_escalations:
        for task in active_escalations[key]:
            if not task.done():
                task.cancel()
        del active_escalations[key]
        print(f"[Escalation] Cancelled pending steps for {key}")

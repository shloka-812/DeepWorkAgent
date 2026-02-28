import os
import json
from dotenv import load_dotenv
from agents.intervener import get_intervener_agent, INTERVENER_TASK_PROMPT
from crewai import Task, Crew, Process

# 1. Setup
load_dotenv()

def test_intervener(analyzer_output, current_task):
    print(f"\n--- Testing Intervener with Analyzer Result ---")
    
    # 2. Setup Agent
    intervener = get_intervener_agent()
    
    # 3. Define Task
    task = Task(
        description=INTERVENER_TASK_PROMPT.format(
            analyzer_output=json.dumps(analyzer_output, indent=2),
            current_task=current_task
        ),
        expected_output="Final JSON AgentResponse structure.",
        agent=intervener
    )

    # 4. Run isolated
    crew = Crew(
        agents=[intervener],
        tasks=[task],
        process=Process.sequential
    )
    
    result = crew.kickoff()
    print("\nINTERVENER OUTPUT:")
    print(result)

if __name__ == "__main__":
    # Test Case 1: Monitor Verdict (Tutorial case)
    test_intervener({
        "verdict": "monitor",
        "reasoning": "User is on YouTube watching a tutorial. Grace period active.",
        "escalation_strategy": {
            "check_again_seconds": 300,
            "next_action": "show_nudge"
        }
    }, current_task="Backend Development: Implement FastAPI endpoints")

    # Test Case 2: Block Verdict (Distraction case)
    # test_intervener({
    #     "verdict": "block_tab",
    #     "reasoning": "User exceeded grace period on Reddit.",
    #     "escalation_strategy": {
    #         "check_again_seconds": 0,
    #         "next_action": "block_tab"
    #     }
    # }, current_task="Backend Development: Implement FastAPI endpoints")

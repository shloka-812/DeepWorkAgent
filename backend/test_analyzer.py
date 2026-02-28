import os
import json
from dotenv import load_dotenv
from agents.analyzer import get_analyzer_agent, ANALYZER_TASK_PROMPT
from crewai import Task, Crew, Process

# 1. Setup
load_dotenv()

def test_analyzer(observer_output):
    print(f"\n--- Testing Analyzer with Observer Result ---")
    
    # 2. Setup Agent
    analyzer = get_analyzer_agent()
    
    # 3. Define Task
    history_ctx_str = "No historical data available for this user yet."
    task = Task(
        description=ANALYZER_TASK_PROMPT.format(
            observer_output=json.dumps(observer_output, indent=2),
            history_context=history_ctx_str
        ),
        expected_output="JSON verdict and escalation strategy.",
        agent=analyzer
    )

    # 4. Run isolated
    crew = Crew(
        agents=[analyzer],
        tasks=[task],
        process=Process.sequential
    )
    
    result = crew.kickoff()
    print("\nANALYZER OUTPUT:")
    print(result)

if __name__ == "__main__":
    # Test Case 1: High Intent / Valid Work
    test_analyzer({
        "intent": "work_related",
        "intent_confidence": 0.95,
        "calendar_alignment": "high",
        "grace_period_status": "none",
        "classification_reason": "Viewing documentation on stackoverflow for an active coding task."
    })

    # Test Case 2: Potential Distraction / Grace Period Exceeded
    # test_analyzer({
    #     "intent": "potential_distraction",
    #     "intent_confidence": 0.7,
    #     "calendar_alignment": "medium",
    #     "grace_period_status": "exceeded",
    #     "classification_reason": "Watching YouTube. Title: 'Funny Cats', context: 'Backend Development'."
    # })

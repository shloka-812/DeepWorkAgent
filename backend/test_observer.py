import os
import json
from dotenv import load_dotenv
from agents.observer import get_observer_agent, OBSERVER_TASK_PROMPT
from crewai import Task, Crew, Process

# 1. Setup
load_dotenv()

def test_observer(payload):
    print(f"\n--- Testing Observer with: {payload['domain']} ---")
    
    # 2. Setup Agent
    observer = get_observer_agent()
    
    # 3. Define Task
    task = Task(
        description=OBSERVER_TASK_PROMPT.format(
            event_type=payload.get("event", "tab_change"),
            url=payload.get("url", "N/A"),
            domain=payload.get("domain", "N/A"),
            title=payload.get("title", "N/A"),
            navigation_type=payload.get("navigation_type", "direct"),
            referrer=payload.get("referrer", "N/A"),
            dwell_seconds=payload.get("dwell_seconds", 0),
            app=payload.get("app", "N/A"),
            window_title=payload.get("window_title", "N/A"),
            calendar_context="Current Task: 'Backend Development' (Focus Session)"
        ),
        expected_output="JSON classification of intent and context.",
        agent=observer
    )

    # 4. Run isolated
    crew = Crew(
        agents=[observer],
        tasks=[task],
        process=Process.sequential
    )
    
    result = crew.kickoff()
    print("\nOBSERVER OUTPUT:")
    print(result)

if __name__ == "__main__":
    # Test Case 1: Clear Work
    test_observer({
        "domain": "stackoverflow.com",
        "title": "FastAPI Pydantic validation error",
        "url": "https://stackoverflow.com/questions/123",
        "navigation_type": "link_click"
    })

    # Test Case 2: Potential Distraction (YouTube tutorial)
    # test_observer({
    #     "domain": "youtube.com",
    #     "title": "Python CrewAI Tutorial",
    #     "url": "https://youtube.com/watch?v=123",
    #     "navigation_type": "search_referrer"
    # })

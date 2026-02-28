from crewai import LLM
import os
from typing import Optional

def get_llm():
    """
    Primary: Groq Llama 3.3-70b
    Using crewai.LLM for native framework support.
    """
    if os.getenv("GROQ_API_KEY"):
        return LLM(
            model="groq/llama-3.3-70b-versatile",
            api_key=os.getenv("GROQ_API_KEY"),
            temperature=0.1,
            max_tokens=1024
        )
    
    # Fallback to OpenAI if GROQ_API_KEY is not set
    return LLM(
        model="gpt-4o-mini",
        api_key=os.getenv("OPENAI_API_KEY"),
        temperature=0.1,
    )

def cortex_complete(prompt: str, model: str = "llama3.1-8b") -> str:
    """
    Snowflake Cortex — runs Llama INSIDE Snowflake on your data.
    Used for insights/analytics only.
    """
    # Note: This requires a functional snowflake_client which is part of Phase 3/4
    try:
        from db.snowflake_client import execute
        safe_prompt = prompt.replace("'", "''")
        rows = execute(f"""
            SELECT SNOWFLAKE.CORTEX.COMPLETE('{model}', '{safe_prompt}') AS response
        """)
        return rows[0]["RESPONSE"] if rows else ""
    except ImportError:
        return "Snowflake client not found. Cortex integration pending Phase 3."

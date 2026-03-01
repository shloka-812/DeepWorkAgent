from crewai import LLM
import os
import time

# ─── Cache obvious decisions — no LLM needed ─────────────
ALWAYS_BLOCK = ["reddit.com", "twitter.com", "x.com", "tiktok.com",
                "instagram.com", "facebook.com", "twitch.tv", "netflix.com"]

NEVER_BLOCK = ["github.com", "stackoverflow.com", "docs.python.org",
               "developer.mozilla.org", "chatgpt.com", "claude.ai",
               "notion.so", "linear.app", "figma.com"]

def quick_decision(domain):
    """
    Skip the LLM entirely for obvious sites.
    Returns a dict if decision is obvious, None if LLM is needed.
    """
    clean = domain.replace("www.", "")
    if clean in ALWAYS_BLOCK:
        return {
            "action": "block_tab",
            "message": f"You're on {clean} during a focus session. Back to work.",
            "reasoning": "Known distraction site — no LLM needed"
        }
    if clean in NEVER_BLOCK:
        return {
            "action": "none",
            "message": None,
            "reasoning": "Known work site — allowed"
        }
    return None  # Ambiguous — needs LLM


# ─── LLM for ambiguous cases ─────────────────────────────
_last_call_time = 0

def get_llm():
    """
    Primary: Groq Llama 3.3-70b-versatile
    - Bigger model = higher rate limits on free tier
    - 3.3 is newer and smarter than 3.1
    """
    global _last_call_time

    # Rate limit protection — wait if last call was < 2 sec ago
    elapsed = time.time() - _last_call_time
    if elapsed < 2:
        time.sleep(2 - elapsed)
    _last_call_time = time.time()

    # if os.getenv("GROQ_API_KEY"):
    #     return LLM(
    #         model="groq/llama-3.3-70b-versatile",
    #         api_key=os.getenv("GROQ_API_KEY"),
    #         temperature=0.1,
    #         max_tokens=512  # Reduced from 1024 — saves tokens
    #     )

    if os.getenv("OPENAI_API_KEY"):
        return LLM(
            model="gpt-4o-mini",
            api_key=os.getenv("OPENAI_API_KEY"),
            temperature=0.1,
        )

    raise ValueError("No LLM API key found.")


def cortex_complete(prompt: str, model: str = "llama3.1-70b") -> str:
    """
    Snowflake Cortex — runs Llama INSIDE Snowflake.
    No rate limits. No external API calls.
    """
    try:
        from db.snowflake_client import execute
        safe_prompt = prompt.replace("'", "''")
        rows = execute(f"""
            SELECT SNOWFLAKE.CORTEX.COMPLETE('{model}', '{safe_prompt}') AS response
        """)
        return rows[0]["RESPONSE"] if rows else ""
    except Exception as e:
        return f"Cortex error: {e}"
import snowflake.connector
import os
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    """
    Returns a Snowflake connection using environment variables.
    """
    try:
        return snowflake.connector.connect(
            user=os.getenv("SNOWFLAKE_USER"),
            password=os.getenv("SNOWFLAKE_PASSWORD"),
            account=os.getenv("SNOWFLAKE_ACCOUNT"),
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
            database=os.getenv("SNOWFLAKE_DATABASE", "DEEP_WORK"),
            schema=os.getenv("SNOWFLAKE_SCHEMA", "AGENT")
        )
    except Exception as e:
        print(f"[Snowflake] Connection Error: {e}")
        return None

def execute(query: str, params: tuple = None) -> list[dict]:
    """
    Executes a SELECT query and returns results as a list of dicts.
    """
    conn = get_connection()
    if not conn:
        return []
    
    try:
        cur = conn.cursor()
        if params:
            cur.execute(query, params)
        else:
            cur.execute(query)
            
        columns = [col[0] for col in cur.description]
        results = [dict(zip(columns, row)) for row in cur.fetchall()]
        return results
    except Exception as e:
        print(f"[Snowflake] Query Error: {e}\nQuery: {query}")
        return []
    finally:
        conn.close()

def execute_write(query: str, params: tuple = None) -> bool:
    """
    Executes a DML query (INSERT, UPDATE, DELETE).
    """
    conn = get_connection()
    if not conn:
        return False
    
    try:
        cur = conn.cursor()
        if params:
            cur.execute(query, params)
        else:
            cur.execute(query)
        conn.commit()
        return True
    except Exception as e:
        print(f"[Snowflake] Write Error: {e}\nQuery: {query}")
        return False
    finally:
        conn.close()

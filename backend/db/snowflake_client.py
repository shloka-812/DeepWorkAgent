"""
Snowflake client for Deep Work Agent.
Handles connection pooling and query execution.
"""

import os
from typing import Any, Optional
from contextlib import contextmanager
import logging

import snowflake.connector
from snowflake.connector import DictCursor
from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════

SNOWFLAKE_CONFIG = {
    "account": os.getenv("SNOWFLAKE_ACCOUNT"),
    "user": os.getenv("SNOWFLAKE_USER"),
    "password": os.getenv("SNOWFLAKE_PASSWORD"),
    "database": os.getenv("SNOWFLAKE_DATABASE", "DEEP_WORK"),
    "schema": os.getenv("SNOWFLAKE_SCHEMA", "AGENT"),
    "warehouse": os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
    "role": os.getenv("SNOWFLAKE_ROLE", "SYSADMIN"),
}

# Connection pool (simple singleton for now)
_connection: Optional[snowflake.connector.SnowflakeConnection] = None


# ═══════════════════════════════════════════════════════════════════════════
# Connection Management
# ═══════════════════════════════════════════════════════════════════════════

def get_connection() -> snowflake.connector.SnowflakeConnection:
    """
    Get or create a Snowflake connection.
    Uses a simple singleton pattern for connection reuse.
    Also sets the active warehouse, database, and schema.
    """
    global _connection
    
    if _connection is None or _connection.is_closed():
        try:
            _connection = snowflake.connector.connect(**SNOWFLAKE_CONFIG)
            
            # Set active context (warehouse, database, schema)
            cursor = _connection.cursor()
            try:
                warehouse = SNOWFLAKE_CONFIG.get("warehouse", "COMPUTE_WH")
                database = SNOWFLAKE_CONFIG.get("database", "DEEP_WORK")
                schema = SNOWFLAKE_CONFIG.get("schema", "AGENT")
                
                cursor.execute(f"USE WAREHOUSE {warehouse}")
                cursor.execute(f"USE DATABASE {database}")
                cursor.execute(f"USE SCHEMA {schema}")
            finally:
                cursor.close()
            
            logger.info("Snowflake connection established")
        except Exception as e:
            logger.error(f"Failed to connect to Snowflake: {e}")
            raise
    
    return _connection


def close_connection():
    """Close the Snowflake connection if open."""
    global _connection
    
    if _connection is not None and not _connection.is_closed():
        _connection.close()
        _connection = None
        logger.info("Snowflake connection closed")


@contextmanager
def get_cursor():
    """
    Context manager for getting a cursor.
    Returns a DictCursor for easier result handling.
    """
    conn = get_connection()
    cursor = conn.cursor(DictCursor)
    try:
        yield cursor
    finally:
        cursor.close()


# ═══════════════════════════════════════════════════════════════════════════
# Query Execution Helpers
# ═══════════════════════════════════════════════════════════════════════════

def execute(query: str, params: tuple = None) -> list[dict[str, Any]]:
    """
    Execute a SELECT query and return results as list of dicts.
    
    Args:
        query: SQL query string with %s placeholders
        params: Tuple of parameters to substitute
        
    Returns:
        List of dictionaries with column names as keys
    """
    with get_cursor() as cursor:
        try:
            cursor.execute(query, params or ())
            results = cursor.fetchall()
            return results if results else []
        except Exception as e:
            logger.error(f"Query execution failed: {e}\nQuery: {query}")
            raise


def execute_write(query: str, params: tuple = None) -> int:
    """
    Execute an INSERT/UPDATE/DELETE query.
    
    Args:
        query: SQL query string with %s placeholders
        params: Tuple of parameters to substitute
        
    Returns:
        Number of rows affected
    """
    conn = get_connection()
    with conn.cursor() as cursor:
        try:
            cursor.execute(query, params or ())
            conn.commit()
            return cursor.rowcount
        except Exception as e:
            logger.error(f"Write execution failed: {e}\nQuery: {query}")
            conn.rollback()
            raise


def execute_many(query: str, params_list: list[tuple]) -> int:
    """
    Execute a query with multiple parameter sets (batch insert).
    
    Args:
        query: SQL query string with %s placeholders
        params_list: List of tuples, each containing parameters for one row
        
    Returns:
        Total number of rows affected
    """
    if not params_list:
        return 0
        
    conn = get_connection()
    with conn.cursor() as cursor:
        try:
            cursor.executemany(query, params_list)
            conn.commit()
            return cursor.rowcount
        except Exception as e:
            logger.error(f"Batch execution failed: {e}\nQuery: {query}")
            conn.rollback()
            raise


def execute_scalar(query: str, params: tuple = None) -> Any:
    """
    Execute a query and return a single value.
    
    Args:
        query: SQL query that returns a single value
        params: Tuple of parameters to substitute
        
    Returns:
        The first column of the first row, or None
    """
    with get_cursor() as cursor:
        try:
            cursor.execute(query, params or ())
            row = cursor.fetchone()
            if row:
                # DictCursor returns dict, get first value
                return list(row.values())[0] if isinstance(row, dict) else row[0]
            return None
        except Exception as e:
            logger.error(f"Scalar execution failed: {e}\nQuery: {query}")
            raise


# ═══════════════════════════════════════════════════════════════════════════
# Health Check
# ═══════════════════════════════════════════════════════════════════════════

def health_check() -> bool:
    """
    Check if Snowflake connection is healthy.
    
    Returns:
        True if connection works, False otherwise
    """
    try:
        result = execute_scalar("SELECT 1")
        return result == 1
    except Exception as e:
        logger.error(f"Snowflake health check failed: {e}")
        return False


def is_configured() -> bool:
    """
    Check if Snowflake credentials are configured.
    
    Returns:
        True if all required env vars are set
    """
    required = ["SNOWFLAKE_ACCOUNT", "SNOWFLAKE_USER", "SNOWFLAKE_PASSWORD"]
    return all(os.getenv(var) for var in required)

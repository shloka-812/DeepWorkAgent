import os
from composio.sdk import Composio

def get_composio_client() -> Composio:
    """
    Initialize and return the Composio v3 SDK client.
    Requires COMPOSIO_API_KEY in .env.
    """
    api_key = os.getenv("COMPOSIO_API_KEY")
    if not api_key:
        raise ValueError("COMPOSIO_API_KEY not set in environment.")
    return Composio(api_key=api_key)

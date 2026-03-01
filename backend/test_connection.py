import logging
from db.snowflake_client import health_check

logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    print("Testing Snowflake Connection...")
    success = health_check()
    if success:
        print("✅ Connection successful!")
    else:
        print("❌ Connection failed.")

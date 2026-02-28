import time
import requests
import subprocess
import os
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

WORK_APPS = {
    "Code": "coding",
    "Cursor": "coding",
    "Zed": "coding",
    "PyCharm": "coding",
    "Terminal": "coding",
    "iTerm2": "coding",
    "Warp": "coding",
    "Figma": "design",
    "Sketch": "design",
    "Notion": "writing",
    "Obsidian": "writing",
    "Linear": "project_management",
    "Slack": "communication",
}

DISTRACTION_APPS = {
    "YouTube": "entertainment",
    "Netflix": "entertainment",
    "Spotify": "entertainment",
    "Messages": "social",
    "Discord": "social",
    "TikTok": "social",
}

def get_active_window_info():
    """
    Uses AppleScript to get the active application name and window title.
    """
    script = '''
    global frontApp, frontAppName, windowTitle
    set windowTitle to ""
    tell application "System Events"
        set frontApp to first application process whose frontmost is true
        set frontAppName to name of frontApp
        tell frontApp
            if exists (1st window) then
                set windowTitle to name of 1st window
            end if
        end tell
    end tell
    return frontAppName & "|" & windowTitle
    '''
    try:
        output = subprocess.check_output(["osascript", "-e", script]).decode("utf-8").strip()
        if "|" in output:
            parts = output.split("|", 1)
            return parts[0], parts[1]
        return output, ""
    except Exception as e:
        print(f"Error getting window info: {e}")
        return None, None

def get_idle_time():
    """
    Optional: Get system idle time in seconds.
    Requires pyobjc-framework-Quartz.
    """
    try:
        from Quartz import CGEventSourceSecondsSinceLastEventType, kCGEventSourceStateCombinedSessionState, kCGAnyInputEventType
        return CGEventSourceSecondsSinceLastEventType(kCGEventSourceStateCombinedSessionState, kCGAnyInputEventType)
    except ImportError:
        return 0

def classify_app(app_name, window_title):
    category = "other"
    is_work = None
    is_distraction = None
    inferred_task = None

    if app_name in WORK_APPS:
        category = WORK_APPS[app_name]
        is_work = True
        is_distraction = False
        inferred_task = f"{category.capitalize()} in {app_name}"
        if window_title:
             inferred_task = f"{inferred_task}: {window_title}"
    elif app_name in DISTRACTION_APPS:
        category = DISTRACTION_APPS[app_name]
        is_work = False
        is_distraction = True
        inferred_task = f"Distraction: {app_name}"

    return category, is_work, is_distraction, inferred_task

def monitor_loop():
    last_app = None
    last_title = None
    
    print("🚀 DeepWorkAgent Mac Monitor started...")
    
    while True:
        app_name, window_title = get_active_window_info()
        
        if app_name and (app_name != last_app or window_title != last_title):
            category, is_work, is_distraction, inferred_task = classify_app(app_name, window_title)
            idle_seconds = int(get_idle_time())
            
            event_data = {
                "event": "app_switch",
                "source": "mac_system",
                "app": app_name,
                "window_title": window_title,
                "category": category,
                "is_work": is_work,
                "is_distraction": is_distraction,
                "inferred_task": inferred_task,
                "idle_seconds": idle_seconds,
                "timestamp": int(time.time() * 1000)
            }
            
            # Special event: work_return
            if is_work and last_app in DISTRACTION_APPS:
                 event_data["event"] = "work_return"
            
            try:
                print(f"[{event_data['event'].upper()}] {app_name} | {window_title}")
                requests.post(f"{BACKEND_URL}/event", json=event_data, timeout=30)
            except Exception as e:
                print(f"Error sending event to backend: {e}")
            
            last_app = app_name
            last_title = window_title
            
        time.sleep(3)

if __name__ == "__main__":
    monitor_loop()

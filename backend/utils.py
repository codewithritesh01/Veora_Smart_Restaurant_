from datetime import datetime, timezone, timedelta

def get_current_ist():
    """Returns the current date and time in Indian Standard Time (UTC + 5:30)."""
    return datetime.now(timezone(timedelta(hours=5, minutes=30)))

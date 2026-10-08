from langgraph.config import get_stream_writer

TOOL_LABELS = {
    "web_search": "Searching the web...",
    "search_workspace_documents": "Reading your documents...",
    "calculate_expression": "Calculating...",
    "create_task": "Creating a task...",
    "get_project_tasks": "Checking your tasks...",
}

def emit_status(action: str, label: str, **extra):
    try:
        get_stream_writer()({"kind": "status", "action": action, "label": label, **extra})
    except Exception:
        pass

def emit_text(delta: str):
    try:
        get_stream_writer()({"kind": "text", "delta": delta})
    except Exception:
        pass
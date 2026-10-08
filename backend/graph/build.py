import re
from langgraph.graph import StateGraph, START, END
from graph.state import State
from graph.planner import planner_node
from graph.worker import worker_node
from graph.auditor import auditor_node
from graph.synthesizer import synthesizer_node
from graph.events import emit_status

MAX_ATTEMPTS = 3
_COMPLEX_REQUEST = re.compile(
    r"\b(plan|compare|break down|split into|step by step|for each|research|investigate|roadmap|open questions)\b",
    re.IGNORECASE,
)

def route_request(state: dict) -> str:
    goal = state.get("goal", "")
    return "planner" if len(goal) > 240 or _COMPLEX_REQUEST.search(goal) else "direct"

async def direct_node(state: dict) -> dict:
    emit_status("node", "Handling your request directly...")
    return {
        "plan": [state["goal"]],
        "current_step": 0,
        "step_results": [],
        "attempts": 0,
        "critique": None,
    }

def route_after_audit(state: dict) -> str:
    if state.get("critique"):
        return "worker" if state.get("attempts", 0) < MAX_ATTEMPTS else "synthesizer"
    return "worker" if state["current_step"] < len(state["plan"]) else "synthesizer"

g = StateGraph(State)
g.add_node("planner", planner_node)
g.add_node("direct", direct_node)
g.add_node("worker", worker_node)
g.add_node("auditor", auditor_node)
g.add_node("synthesizer", synthesizer_node)

g.add_conditional_edges(START, route_request, ["planner", "direct"])
g.add_edge("direct", "worker")
g.add_edge("planner", "worker")
g.add_edge("worker", "auditor")
g.add_conditional_edges("auditor", route_after_audit, ["worker", "synthesizer"])
g.add_edge("synthesizer", END)

graph = g.compile()

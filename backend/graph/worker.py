from langchain_core.runnables import RunnableConfig
from services.agent import run_agent
from graph.events import emit_status

WORKER_SYSTEM = "You execute ONE step of a larger plan in NexTask AI using tools when needed. Be factual and cite sources."

async def worker_node(state: dict, config: RunnableConfig) -> dict:
    user = config["configurable"]["user"]
    i, plan = state["current_step"], state["plan"]
    emit_status("node", f"Working on step {i + 1} of {len(plan)}: {plan[i]}")

    prompt = (
        f"Overall goal: {state['goal']}\n"
        f"Current step {i + 1}/{len(plan)}: {plan[i]}\n\n"
        "Results of previous steps:\n" + "\n---\n".join(state.get("step_results", []))
    )
    if state.get("critique"):
        prompt += f"\n\nYour previous attempt was REJECTED by the auditor:\n{state['critique']}\nFix these issues."

    draft = await run_agent(prompt, WORKER_SYSTEM, user)
    return {"draft": draft}
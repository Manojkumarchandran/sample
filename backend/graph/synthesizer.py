from services.llm import llm
from graph.events import emit_status, emit_text

SYNTH_SYSTEM = "You are NexTask AI. Consolidate step results into a clear, cohesive final response for the user."

async def synthesizer_node(state: dict) -> dict:
    emit_status("node", "Writing the answer...")
    prompt = (
        f"Goal: {state['goal']}\n\n"
        "Completed Steps:\n" + "\n---\n".join(state.get("step_results", []))
    )
    final_text = ""
    async for chunk in llm.stream(prompt, system=SYNTH_SYSTEM):
        emit_text(chunk)
        final_text += chunk
    return {"draft": final_text}
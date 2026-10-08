from typing import Literal
from pydantic import BaseModel
from google.genai import types
from services.llm import llm
from graph.events import emit_status

class Verdict(BaseModel):
    verdict: Literal["PASS", "FAIL"]
    critique: str = ""

AUDITOR_PROMPT = """You are a strict reviewer in NexTask AI. Judge ONLY whether the draft fully and correctly completes the given step.
FAIL if incomplete, unsupported by sources, or off-task. Return JSON matching schema."""

async def auditor_node(state: dict) -> dict:
    emit_status("node", "Checking work...")
    step = state["plan"][state["current_step"]]
    resp = await llm.generate(
        contents=f"STEP: {step}\n\nDRAFT:\n{state['draft']}",
        config=types.GenerateContentConfig(
            system_instruction=AUDITOR_PROMPT,
            temperature=0.0,
            response_mime_type="application/json",
            response_schema=Verdict
        )
    )
    v = Verdict.model_validate_json(resp.text)
    if v.verdict == "PASS":
        return {
            "step_results": state["step_results"] + [state["draft"]],
            "current_step": state["current_step"] + 1,
            "critique": None,
            "attempts": 0
        }
    emit_status("retry", f"Fixing issue: {v.critique}")
    return {"critique": v.critique, "attempts": state.get("attempts", 0) + 1}

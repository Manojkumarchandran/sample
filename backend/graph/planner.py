from pydantic import BaseModel, Field
from google.genai import types
from services.llm import llm
from graph.events import emit_status

class Plan(BaseModel):
    steps: list[str] = Field(min_length=1, max_length=6)

PLANNER_PROMPT = """You are a planning agent for NexTask AI.
Break the user's goal into 1-6 sequential, concrete, independently checkable steps.
Tools available: search_workspace_documents, web_search, calculate_expression, get_project_tasks, create_task.
Do not perform the steps. Return only JSON matching the schema."""

async def planner_node(state: dict) -> dict:
    emit_status("node", "Planning...")
    resp = await llm.generate(
        contents=state["goal"],
        config=types.GenerateContentConfig(
            system_instruction=PLANNER_PROMPT,
            temperature=0.0,
            response_mime_type="application/json",
            response_schema=Plan
        )
    )
    plan = Plan.model_validate_json(resp.text)
    emit_status("plan", f"Plan ready: {len(plan.steps)} steps", steps=plan.steps)
    return {
        "plan": plan.steps,
        "current_step": 0,
        "step_results": [],
        "attempts": 0,
        "critique": None
    }

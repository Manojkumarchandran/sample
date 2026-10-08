from typing import Annotated, TypedDict
from langgraph.graph.message import add_messages

class State(TypedDict, total=False):
    messages: Annotated[list, add_messages]
    goal: str
    plan: list[str]
    current_step: int
    draft: str
    step_results: list[str]
    critique: str | None
    attempts: int
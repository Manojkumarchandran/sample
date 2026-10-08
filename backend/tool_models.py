from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

class CreateTaskInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    project_id: UUID
    title: str = Field(min_length=1, max_length=200)
    priority: Literal["low", "medium", "high"] = "medium"

class ProjectTasksInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project_id: UUID
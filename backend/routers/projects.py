from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
import os
from typing import Literal
import logging
from auth import get_current_user
from db import user_client
from supabase import create_client

router = APIRouter(prefix="/projects", tags=["projects"])
logger = logging.getLogger(__name__)

class ProjectIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = None

class SubtaskIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=180)
    description: str = Field(default="", max_length=500)

class ProjectTaskIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    milestone: str = Field(default="", max_length=120)
    story: str = Field(default="", max_length=160)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)
    priority: str = Field(default="medium", pattern="^(low|medium|high)$")
    depends_on: list[str] = Field(default_factory=list, max_length=30)
    source_pages: list[int] = Field(default_factory=list, max_length=100)
    source_document: str | None = Field(default=None, max_length=255)
    assignee: str | None = Field(default=None, max_length=255)
    subtasks: list[SubtaskIn] = Field(default_factory=list, max_length=12)

class ProjectTasksIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tasks: list[ProjectTaskIn] = Field(min_length=1, max_length=30)

class TaskUpdateIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    status: Literal["unassigned", "in_progress", "completed"] | None = None
    assignee: str | None = Field(default=None, max_length=255)
    assignee_id: UUID | None = None

class DeveloperIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)

def _admin_client():
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise HTTPException(503, "Add SUPABASE_SECRET_KEY to backend/.env to create developer accounts")
    return create_client(os.environ["SUPABASE_URL"], key)

def _owned_project(project_id: UUID, user: dict):
    client = user_client(user["token"])
    project = client.table("projects").select("id").eq("id", str(project_id)).maybe_single().execute().data
    if not project:
        raise HTTPException(404, "Project not found or you are not its owner")
    return client

@router.get("/{project_id}/developers")
def list_developers(project_id: UUID, user=Depends(get_current_user)):
    client = _owned_project(project_id, user)
    return client.table("project_members").select("user_id, profiles(username)").eq("project_id", str(project_id)).execute().data

@router.post("/{project_id}/developers", status_code=201)
def create_developer(project_id: UUID, body: DeveloperIn, user=Depends(get_current_user)):
    client = _owned_project(project_id, user)
    admin = _admin_client()
    username = body.username.lower()
    auth_user_id = None
    try:
        created = admin.auth.admin.create_user({
            "email": f"{username}@users.nextask.local",
            "password": body.password,
            "email_confirm": True,
            "user_metadata": {"username": username, "role": "developer"},
        })
        auth_user_id = created.user.id
        admin.table("profiles").upsert({"id": auth_user_id, "username": username}).execute()
        admin.table("project_members").insert({
            "project_id": str(project_id), "user_id": auth_user_id, "owner_id": user["id"],
        }).execute()
        return {"user_id": auth_user_id, "username": username}
    except Exception as error:
        if auth_user_id:
            try:
                admin.auth.admin.delete_user(str(auth_user_id))
            except Exception:
                pass
        raise HTTPException(400, "Could not add developer. Check that the username is unused and migration 0005 has been applied.") from error

@router.delete("/{project_id}/developers/{developer_id}", status_code=204)
def remove_developer(project_id: UUID, developer_id: UUID, user=Depends(get_current_user)):
    client = _owned_project(project_id, user)
    member = client.table("project_members").select("user_id").eq("project_id", str(project_id)).eq("user_id", str(developer_id)).maybe_single().execute().data
    if not member:
        raise HTTPException(404, "Developer is not part of this project")
    client.table("tasks").update({"assignee_id": None, "assignee": None, "status": "unassigned"}).eq("project_id", str(project_id)).eq("assignee_id", str(developer_id)).execute()
    client.table("project_members").delete().eq("project_id", str(project_id)).eq("user_id", str(developer_id)).execute()
    return None

@router.get("")
def list_projects(user=Depends(get_current_user)):
    return user_client(user["token"]).table("projects").select("*").order("created_at", desc=True).execute().data

@router.post("", status_code=201)
def create_project(body: ProjectIn, user=Depends(get_current_user)):
    try:
        return user_client(user["token"]).table("projects").insert(body.model_dump()).execute().data[0]
    except Exception as exc:
        logger.exception("Project creation failed for user %s", user["id"])
        message = getattr(exc, "message", None) or "Database rejected the project. Check the projects table and its RLS policy."
        raise HTTPException(400, str(message)) from exc

@router.post("/{project_id}/tasks", status_code=201)
def create_project_tasks(project_id: UUID, body: ProjectTasksIn, user=Depends(get_current_user)):
    rows = [
        {"project_id": str(project_id), "status": "unassigned", **task.model_dump()}
        for task in body.tasks
    ]
    try:
        return user_client(user["token"]).table("tasks").insert(rows).execute().data
    except Exception as exc:
        message = str(exc).lower()
        if "subtasks" in message and ("schema cache" in message or "could not find" in message):
            raise HTTPException(
                409,
                "Supabase is missing the subtasks column. Run supabase/migrations/0006_task_subtasks.sql in the Supabase SQL Editor, then retry.",
            ) from exc
        logger.exception("Could not save tasks for project %s", project_id)
        raise HTTPException(400, "Could not save tasks. Check the Supabase tasks table and its policies.") from exc

@router.patch("/{project_id}/tasks/{task_id}")
def update_project_task_status(
    project_id: UUID,
    task_id: UUID,
    body: TaskUpdateIn,
    user=Depends(get_current_user),
):
    updates = body.model_dump(exclude_unset=True)
    if "assignee_id" in updates:
        _owned_project(project_id, user)
        developer_id = updates["assignee_id"]
        if developer_id:
            developer_id = str(developer_id)
            member = user_client(user["token"]).table("project_members").select("user_id, profiles(username)").eq("project_id", str(project_id)).eq("user_id", developer_id).maybe_single().execute().data
            if not member:
                raise HTTPException(422, "Select a developer from this project")
            updates["assignee_id"] = developer_id
            updates["assignee"] = member["profiles"]["username"]
        else:
            updates["assignee_id"] = None
            updates["assignee"] = None
    if not updates:
        raise HTTPException(422, "Provide a task status or assignee to update")
    result = (
        user_client(user["token"])
        .table("tasks")
        .update(updates)
        .eq("project_id", str(project_id))
        .eq("id", str(task_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Task not found")
    return result.data[0]

@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: UUID, user=Depends(get_current_user)):
    res = user_client(user["token"]).table("projects").delete().eq("id", str(project_id)).execute()
    if not res.data:
        raise HTTPException(404, "Project not found")

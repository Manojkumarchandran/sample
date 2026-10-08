from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from auth import get_current_user
from services.agent import run_agent

router = APIRouter(prefix="/api", tags=["chat"])

SYSTEM = """You are NexTask AI, an intelligent workspace assistant.
Tool routing rules:
1. Questions about user's files, projects, or tasks -> search_workspace_documents / get_project_tasks.
2. Questions about world or recent facts -> web_search.
3. For calculations -> calculate_expression.
4. For action items/tasks -> create_task.
Always cite sources: [file_name] for docs, (URL) for web results."""

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    project_id: str | None = None

class ChatResponse(BaseModel):
    reply: str

@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, user=Depends(get_current_user)):
    try:
        reply = await run_agent(req.message, SYSTEM, user)
        return ChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(503, f"The AI service is busy: {str(e)}")
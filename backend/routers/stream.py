import json
import logging
import uuid
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from auth import get_current_user
from graph.build import graph

router = APIRouter(prefix="/api", tags=["stream"])
logger = logging.getLogger(__name__)

def sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"

def extract_last_user_text(req: dict) -> str:
    messages = req.get("messages", [])
    if not messages:
        return ""
    last = messages[-1]
    if isinstance(last.get("parts"), list):
        return " ".join([p.get("text", "") for p in last["parts"] if p.get("type") == "text"])
    return last.get("content", "")

@router.post("/chat/stream")
async def chat_stream(req: dict, user=Depends(get_current_user)):
    message = extract_last_user_text(req)

    async def gen():
        text_id = str(uuid.uuid4())
        yield sse({"type": "start"})
        yield sse({"type": "text-start", "id": text_id})

        try:
            async for event in graph.astream(
                {"goal": message, "messages": []},
                config={"configurable": {"user": user}, "recursion_limit": 40},
                stream_mode="custom"
            ):
                if event.get("kind") == "status":
                    yield sse({"type": "data-status", "data": event, "transient": True})
                elif event.get("kind") == "text":
                    yield sse({"type": "text-delta", "id": text_id, "delta": event["delta"]})
        except Exception as exc:
            logger.exception("Chat stream failed")
            error_message = (
                "Gemini is temporarily unavailable. Please retry in a minute."
                if getattr(exc, "code", None) == 503
                else "Gemini request limit reached. Wait a minute and retry. If this keeps happening, check your Gemini API quota or billing plan."
                if getattr(exc, "code", None) == 429
                else "The AI response failed. Check that the backend and Gemini configuration are available, then retry."
            )
            yield sse({"type": "error", "errorText": error_message})
            return

        yield sse({"type": "data-status", "data": {"action": "done"}, "transient": True})
        yield sse({"type": "text-end", "id": text_id})
        yield sse({"type": "finish"})
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "x-vercel-ai-ui-message-stream": "v1"
        }
    )

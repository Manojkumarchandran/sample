import os
from pathlib import Path
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).resolve().parent / ".env")

from services.mcp_client import mcp_client
from routers import projects, chat, documents, stream

@asynccontextmanager
async def lifespan(app: FastAPI):
    await mcp_client.start()
    yield
    await mcp_client.stop()

app = FastAPI(title="NexTask AI API", lifespan=lifespan)

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(stream.router)

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "app": "NexTask AI"}

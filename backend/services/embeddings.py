import math
import os
from google.genai import types
from services.llm import llm

EMBED_MODEL = os.getenv("EMBED_MODEL", "gemini-embedding-001")
DIM = 768

def _normalise(v: list[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]

async def embed(texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT") -> list[list[float]]:
    out: list[list[float]] = []
    for i in range(0, len(texts), 100):
        resp = await llm.embed(
            model=EMBED_MODEL,
            contents=texts[i:i + 100],
            config=types.EmbedContentConfig(task_type=task_type, output_dimensionality=DIM)
        )
        out.extend(_normalise(e.values) for e in resp.embeddings)
    return out

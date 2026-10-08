import os
from typing import AsyncIterator
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential

class LLMService:
    def __init__(self, model: str | None = None, temperature: float = 0.3, max_tokens: int = 2048):
        self.client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        self.model = model or os.getenv("LLM_MODEL", "gemini-flash-lite-latest")
        self.temperature = temperature
        self.max_tokens = max_tokens

    def _config(self, system: str | None = None, **extra) -> types.GenerateContentConfig:
        return types.GenerateContentConfig(
            temperature=self.temperature,
            max_output_tokens=self.max_tokens,
            system_instruction=system,
            **extra
        )

    async def generate(self, contents, config: types.GenerateContentConfig | None = None, model: str | None = None):
        return await self.client.aio.models.generate_content(
            model=model or self.model,
            contents=contents,
            config=config,
        )

    async def embed(self, contents, config: types.EmbedContentConfig, model: str):
        return await self.client.aio.models.embed_content(
            model=model,
            contents=contents,
            config=config,
        )

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
    async def complete(self, prompt: str, system: str | None = None) -> str:
        resp = await self.generate(prompt, config=self._config(system))
        return resp.text or ""

    async def stream(self, prompt: str, system: str | None = None) -> AsyncIterator[str]:
        stream = await self.client.aio.models.generate_content_stream(
            model=self.model, contents=prompt, config=self._config(system)
        )
        async for chunk in stream:
            if chunk.text:
                yield chunk.text

llm = LLMService()

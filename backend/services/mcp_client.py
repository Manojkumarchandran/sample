from contextlib import AsyncExitStack
from pathlib import Path
import sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

class MCPClient:
    def __init__(self):
        self._stack = AsyncExitStack()
        self.session: ClientSession | None = None

    async def start(self):
        server_path = Path(__file__).resolve().parents[1] / "mcp_server.py"
        params = StdioServerParameters(command=sys.executable, args=[str(server_path)])
        read, write = await self._stack.enter_async_context(stdio_client(params))
        self.session = await self._stack.enter_async_context(ClientSession(read, write))
        await self.session.initialize()

    async def stop(self):
        await self._stack.aclose()

mcp_client = MCPClient()

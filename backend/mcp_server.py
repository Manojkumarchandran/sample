import ast
import operator as op
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from mcp.server.fastmcp import FastMCP
from tavily import TavilyClient
from pydantic import ValidationError
from db import user_client
from tool_models import CreateTaskInput, ProjectTasksInput
from services.embeddings import embed

mcp = FastMCP("NexTaskAITools")

_OPS = {
    ast.Add: op.add, ast.Sub: op.sub, ast.Mult: op.mul, ast.Div: op.truediv,
    ast.FloorDiv: op.floordiv, ast.Mod: op.mod, ast.Pow: op.pow,
    ast.USub: op.neg, ast.UAdd: op.pos
}

def _eval(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        left, right = _eval(node.left), _eval(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > 100:
            raise ValueError("Exponent too large")
        return _OPS[type(node.op)](left, right)
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval(node.operand))
    raise ValueError("Only numbers and +-/*%**() are allowed")

@mcp.tool()
def calculate_expression(expression: str) -> str:
    """Evaluate an arithmetic expression exactly, e.g. '0.175 * 2340'."""
    if len(expression) > 200:
        raise ValueError("Expression too long")
    return str(_eval(ast.parse(expression, mode="eval").body))

@mcp.tool()
def web_search(query: str, max_results: int = 5) -> list[dict]:
    """Search the public internet for current events, facts, prices, documentation.
    Do NOT use this for questions about the user's own projects or documents."""
    client = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY", ""))
    res = client.search(query=query, max_results=min(max_results, 8))
    return [{"title": r["title"], "url": r["url"], "snippet": r["content"][:500]} for r in res.get("results", [])]

@mcp.tool()
def create_task(project_id: str, title: str, priority: str = "medium", auth_token: str = "") -> dict:
    """Create a task in one of the user's projects. priority must be low, medium, or high."""
    try:
        data = CreateTaskInput(project_id=project_id, title=title, priority=priority)
    except ValidationError as e:
        return {"error": "invalid_arguments", "details": e.errors(include_url=False)}
    
    rows = (user_client(auth_token).table("tasks")
            .insert({"project_id": str(data.project_id), "title": data.title, "priority": data.priority})
            .execute().data)
    task = rows[0]
    return {"id": task["id"], "title": task["title"], "priority": task["priority"]}

@mcp.tool()
def get_project_tasks(project_id: str, auth_token: str = "") -> list[dict]:
    """List the tasks in one of the user's projects, newest first."""
    data = ProjectTasksInput(project_id=project_id)
    return (user_client(auth_token).table("tasks")
            .select("id, title, priority, status, assignee, created_at")
            .eq("project_id", str(data.project_id))
            .order("created_at", desc=True).limit(50).execute().data)

@mcp.tool()
async def search_workspace_documents(query: str, project_id: str | None = None, top_k: int = 5, auth_token: str = "") -> list[dict]:
    """Search the USER'S OWN uploaded documents by meaning.
    Use this FIRST when user asks about specs, notes, reports, or uploaded files."""
    [vector] = await embed([query], task_type="RETRIEVAL_QUERY")
    rows = (user_client(auth_token)
            .rpc("match_documents", {
                "query_embedding": vector,
                "match_count": max(1, min(top_k, 10)),
                "filter_project": project_id
            }).execute().data)
    return [r for r in rows if r["similarity"] >= 0.55] or [{"note": "No relevant passages found."}]

if __name__ == "__main__":
    mcp.run()

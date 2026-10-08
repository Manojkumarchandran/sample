import copy
from google.genai import types
from services.llm import llm
from services.mcp_client import mcp_client
from graph.events import TOOL_LABELS, emit_status

MAX_ROUNDS = 6
HIDDEN_ARGS = {"auth_token"}

async def get_tool_params():
    tools = (await mcp_client.session.list_tools()).tools
    return {t.name: set(t.inputSchema.get("properties", {}).keys()) for t in tools}

async def tool_declarations() -> list[types.FunctionDeclaration]:
    tools = (await mcp_client.session.list_tools()).tools
    declarations = []
    for t in tools:
        schema = copy.deepcopy(t.inputSchema)
        for arg in HIDDEN_ARGS:
            schema.get("properties", {}).pop(arg, None)
        if "required" in schema:
            schema["required"] = [r for r in schema["required"] if r not in HIDDEN_ARGS]
        declarations.append(types.FunctionDeclaration(
            name=t.name,
            description=t.description,
            parameters_json_schema=schema
        ))
    return declarations

async def run_agent(prompt: str, system: str, user: dict) -> str:
    tool_params = await get_tool_params()
    declarations = await tool_declarations()
    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=0.0,
        tools=[types.Tool(function_declarations=declarations)]
    )
    contents = [types.Content(role="user", parts=[types.Part(text=prompt)])]

    for _ in range(MAX_ROUNDS):
        resp = await llm.generate(contents=contents, config=config)
        if not resp.function_calls:
            return resp.text or ""

        contents.append(resp.candidates[0].content)
        parts = []
        for call in resp.function_calls:
            args = {k: v for k, v in dict(call.args or {}).items() if k not in HIDDEN_ARGS}
            if "auth_token" in tool_params.get(call.name, set()):
                args["auth_token"] = user["token"]

            emit_status("tool", TOOL_LABELS.get(call.name, f"Using {call.name}..."), name=call.name)
            result = await mcp_client.session.call_tool(call.name, args)
            text = "\n".join(c.text for c in result.content if c.type == "text")
            parts.append(types.Part.from_function_response(
                name=call.name,
                response={"error": text} if result.isError else {"result": text}
            ))
        contents.append(types.Content(role="user", parts=parts))

    return "I could not finish this request within the tool-call limit."

"""
Mobile Coding Assistant - FastAPI Backend
Voice-controlled software development from your phone.

Endpoints:
  POST /session              - Create workspace session
  GET  /session/{id}/files   - List files
  POST /command              - Send voice/text command to AI
  POST /voice                - Upload audio for STT + AI processing
  POST /chat                 - Simple chat (no code actions)
  POST /execute              - Run shell command in workspace
  GET  /providers            - List available LLM providers
  WS   /ws/terminal/{id}     - Real-time terminal streaming
"""

import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from pathlib import Path

from config import settings
from ai_engine import ai_engine
from voice_processor import voice_processor
from workspace_manager import workspace_manager
from terminal_stream import terminal_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"🚀 Mobile Coding Assistant starting on {settings.HOST}:{settings.PORT}")
    print(f"📡 Default LLM: {settings.DEFAULT_LLM_PROVIDER}")
    yield
    # Shutdown
    await ai_engine.close()
    await voice_processor.close()


app = FastAPI(
    title="Mobile Coding Assistant",
    description="Voice-controlled AI coding from your phone",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ──────────────────────────────────────

class CreateSessionRequest(BaseModel):
    name: str | None = None

class CommandRequest(BaseModel):
    session_id: str
    message: str
    provider: str | None = None
    context: list[dict] | None = None

class ChatRequest(BaseModel):
    message: str
    provider: str | None = None
    context: list[dict] | None = None

class ExecuteRequest(BaseModel):
    session_id: str
    command: str


# ── Session Endpoints ──────────────────────────────────────────────

@app.post("/session")
async def create_session(req: CreateSessionRequest):
    session_id = workspace_manager.create_session(req.name)
    return {"session_id": session_id, "status": "created"}


@app.get("/session/{session_id}/files")
async def list_files(session_id: str, path: str = "."):
    try:
        files = await workspace_manager.list_files(session_id, path)
        return {"files": files}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/sessions")
async def list_sessions():
    return {"sessions": workspace_manager.list_sessions()}


# ── AI Command Endpoint ───────────────────────────────────────────

@app.post("/command")
async def process_command(req: CommandRequest):
    """Send a text command → AI interprets → executes actions in workspace."""
    try:
        # 1. Get structured actions from AI
        ai_result = await ai_engine.process(
            user_message=req.message,
            context=req.context,
            provider=req.provider,
        )

        # 2. Execute each action
        results = []
        for action in ai_result.get("actions", []):
            action_result = await _execute_action(req.session_id, action)
            results.append(action_result)

        preview_url = _build_preview_url(req.session_id, results)
        return {
            "intent": ai_result.get("intent"),
            "description": ai_result.get("description"),
            "results": results,
            "preview_url": preview_url,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _build_preview_url(session_id: str, results: list[dict]) -> str | None:
    """Find the best preview URL from action results (index.html, *.html, etc)."""
    html_files = []
    for r in results:
        path = r.get("path", "")
        if path.endswith(".html"):
            html_files.append(path)
    # Prefer index.html, then any .html
    for name in ["index.html", "index.htm"]:
        if name in html_files:
            return f"/preview/{session_id}/{name}"
    if html_files:
        return f"/preview/{session_id}/{html_files[0]}"
    return None


async def _execute_action(session_id: str, action: dict) -> dict:
    """Execute a single AI-generated action."""
    action_type = action.get("type")

    if action_type == "write_file":
        path = action.get("path", "untitled.txt")
        content = action.get("content", "")
        written = await workspace_manager.write_file(session_id, path, content)
        return {"type": "write_file", "path": path, "status": "written", "full_path": written}

    elif action_type == "patch_file":
        path = action.get("path", "")
        content = action.get("content", "")
        written = await workspace_manager.write_file(session_id, path, content)
        return {"type": "patch_file", "path": path, "status": "updated", "full_path": written}

    elif action_type == "run_shell":
        cmd = action.get("content", "")
        result = await workspace_manager.run_command(session_id, cmd)
        return {"type": "run_shell", "command": cmd, **result}

    elif action_type == "respond":
        return {"type": "respond", "content": action.get("content", "")}

    else:
        return {"type": "unknown", "raw": action}


# ── Voice Endpoint ────────────────────────────────────────────────

@app.post("/voice")
async def process_voice(
    audio: UploadFile = File(...),
    session_id: str = Form(...),
    provider: str = Form(None),
):
    """Upload audio → transcribe with Groq Whisper → process as command."""
    audio_bytes = await audio.read()
    if len(audio_bytes) > 25 * 1024 * 1024:  # 25MB limit
        raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")

    # 1. Transcribe
    transcript = await voice_processor.transcribe(audio_bytes, audio.filename or "audio.wav")

    # 2. Process through AI
    ai_result = await ai_engine.process(user_message=transcript, provider=provider)

    # 3. Execute actions
    results = []
    for action in ai_result.get("actions", []):
        action_result = await _execute_action(session_id, action)
        results.append(action_result)

    preview_url = _build_preview_url(session_id, results)
    return {
        "transcript": transcript,
        "intent": ai_result.get("intent"),
        "description": ai_result.get("description"),
        "results": results,
        "preview_url": preview_url,
    }


# ── Chat Endpoint (no code execution) ─────────────────────────────

@app.post("/chat")
async def chat(req: ChatRequest):
    """Simple conversational chat — no workspace actions."""
    try:
        response = await ai_engine.chat(
            user_message=req.message,
            context=req.context,
            provider=req.provider,
        )
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Execute Shell Command Directly ────────────────────────────────

@app.post("/execute")
async def execute_command(req: ExecuteRequest):
    """Run a shell command directly in the workspace (not AI-mediated)."""
    try:
        result = await workspace_manager.run_command(req.session_id, req.command)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── WebSocket Terminal ─────────────────────────────────────────────

@app.websocket("/ws/terminal/{session_id}")
async def terminal_ws(websocket: WebSocket, session_id: str):
    """Real-time terminal streaming over WebSocket."""
    await websocket.accept()
    ts = terminal_manager.create(session_id, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "command":
                await ts.execute_and_stream(msg["command"])
            elif msg.get("type") == "kill":
                await ts.kill()
    except WebSocketDisconnect:
        await terminal_manager.remove(session_id)


# ── Provider Info ──────────────────────────────────────────────────

@app.get("/providers")
async def list_providers():
    return {
        "default": settings.DEFAULT_LLM_PROVIDER,
        "providers": {
            "groq": {
                "model": settings.GROQ_MODEL,
                "configured": bool(settings.GROQ_API_KEY),
                "features": ["chat", "code", "whisper_stt"],
            },
            "openrouter": {
                "model": settings.OPENROUTER_MODEL,
                "configured": bool(settings.OPENROUTER_API_KEY),
                "features": ["chat", "code"],
            },
            "gemini": {
                "model": settings.GEMINI_MODEL,
                "configured": bool(settings.GEMINI_API_KEY),
                "features": ["chat", "code"],
            },
        },
    }


# ── Preview / Static File Serving ──────────────────────────────────

@app.get("/preview/{session_id}/{file_path:path}")
async def preview_file(session_id: str, file_path: str):
    """Serve workspace files for live preview in browser/webview."""
    try:
        ws_path = workspace_manager.get_workspace_path(session_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")

    target = (ws_path / file_path).resolve()

    # Security: prevent path traversal
    if not str(target).startswith(str(ws_path)):
        raise HTTPException(status_code=403, detail="Forbidden")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # Guess content type
    suffix = target.suffix.lower()
    content_types = {
        ".html": "text/html", ".htm": "text/html",
        ".css": "text/css", ".js": "application/javascript",
        ".json": "application/json", ".png": "image/png",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".gif": "image/gif", ".svg": "image/svg+xml",
        ".ico": "image/x-icon", ".woff2": "font/woff2",
    }
    media_type = content_types.get(suffix, "application/octet-stream")
    return FileResponse(target, media_type=media_type)


# ── Health Check ───────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)

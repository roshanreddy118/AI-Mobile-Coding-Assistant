"""
Terminal Stream - WebSocket-based real-time terminal output streaming.
Allows the mobile app to see live command output.
"""

import asyncio
import json
from fastapi import WebSocket
from workspace_manager import workspace_manager


class TerminalSession:
    def __init__(self, session_id: str, websocket: WebSocket):
        self.session_id = session_id
        self.ws = websocket
        self._process: asyncio.subprocess.Process | None = None

    async def execute_and_stream(self, command: str):
        """Run a command and stream stdout/stderr over WebSocket in real time."""
        ws_path = workspace_manager.get_workspace_path(self.session_id)

        await self.ws.send_json({"type": "cmd_start", "command": command})

        try:
            self._process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(ws_path),
            )

            async def stream_pipe(pipe, stream_type):
                async for line in pipe:
                    text = line.decode(errors="replace")
                    await self.ws.send_json({"type": stream_type, "data": text})

            await asyncio.gather(
                stream_pipe(self._process.stdout, "stdout"),
                stream_pipe(self._process.stderr, "stderr"),
            )

            exit_code = await asyncio.wait_for(self._process.wait(), timeout=120)
            await self.ws.send_json({"type": "cmd_end", "exit_code": exit_code})

        except asyncio.TimeoutError:
            if self._process:
                self._process.kill()
            await self.ws.send_json({"type": "cmd_end", "exit_code": -1, "error": "timeout"})
        except Exception as e:
            await self.ws.send_json({"type": "error", "message": str(e)})

    async def kill(self):
        if self._process:
            self._process.kill()


class TerminalManager:
    def __init__(self):
        self._sessions: dict[str, TerminalSession] = {}

    def create(self, session_id: str, websocket: WebSocket) -> TerminalSession:
        ts = TerminalSession(session_id, websocket)
        self._sessions[session_id] = ts
        return ts

    def get(self, session_id: str) -> TerminalSession | None:
        return self._sessions.get(session_id)

    async def remove(self, session_id: str):
        ts = self._sessions.pop(session_id, None)
        if ts:
            await ts.kill()


terminal_manager = TerminalManager()

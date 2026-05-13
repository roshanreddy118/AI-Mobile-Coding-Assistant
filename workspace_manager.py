"""
Workspace Manager - Manages project workspaces and file operations.
Handles local file system and optionally Docker containers.
"""

import os
import shutil
import asyncio
import uuid
from pathlib import Path
from config import settings


class WorkspaceManager:
    def __init__(self):
        self.base_dir = settings.WORKSPACE_DIR.resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self._active_sessions: dict[str, Path] = {}

    def create_session(self, name: str | None = None) -> str:
        """Create a new workspace session, return session ID."""
        session_id = uuid.uuid4().hex[:12]
        folder_name = f"{name or 'project'}_{session_id}"
        workspace_path = self.base_dir / folder_name
        workspace_path.mkdir(parents=True, exist_ok=True)
        self._active_sessions[session_id] = workspace_path
        return session_id

    def get_workspace_path(self, session_id: str) -> Path:
        if session_id not in self._active_sessions:
            # Try to recover from disk
            for d in self.base_dir.iterdir():
                if d.is_dir() and session_id in d.name:
                    self._active_sessions[session_id] = d
                    return d
            raise ValueError(f"Unknown session: {session_id}")
        return self._active_sessions[session_id]

    async def write_file(self, session_id: str, file_path: str, content: str) -> str:
        """Write a file inside the workspace. Returns absolute path."""
        ws = self.get_workspace_path(session_id)
        target = (ws / file_path).resolve()

        # Security: prevent path traversal
        if not str(target).startswith(str(ws)):
            raise ValueError("Path traversal detected")

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return str(target)

    async def read_file(self, session_id: str, file_path: str) -> str:
        ws = self.get_workspace_path(session_id)
        target = (ws / file_path).resolve()

        if not str(target).startswith(str(ws)):
            raise ValueError("Path traversal detected")
        if not target.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        return target.read_text(encoding="utf-8")

    async def delete_file(self, session_id: str, file_path: str) -> None:
        ws = self.get_workspace_path(session_id)
        target = (ws / file_path).resolve()

        if not str(target).startswith(str(ws)):
            raise ValueError("Path traversal detected")

        if target.is_dir():
            shutil.rmtree(target)
        elif target.exists():
            target.unlink()

    async def list_files(self, session_id: str, sub_path: str = ".") -> list[dict]:
        """List files/dirs in workspace, returning tree structure."""
        ws = self.get_workspace_path(session_id)
        target = (ws / sub_path).resolve()

        if not str(target).startswith(str(ws)):
            raise ValueError("Path traversal detected")

        entries = []
        if target.is_dir():
            for item in sorted(target.iterdir()):
                rel = item.relative_to(ws)
                entries.append({
                    "name": item.name,
                    "path": str(rel),
                    "is_dir": item.is_dir(),
                    "size": item.stat().st_size if item.is_file() else None,
                })
        return entries

    async def run_command(self, session_id: str, command: str) -> dict:
        """Execute a shell command inside the workspace directory."""
        ws = self.get_workspace_path(session_id)

        # Security: block dangerous commands
        blocked = ["rm -rf /", "mkfs", "dd if=", ":(){", "fork bomb"]
        cmd_lower = command.lower()
        for b in blocked:
            if b in cmd_lower:
                return {"exit_code": 1, "stdout": "", "stderr": f"Blocked dangerous command: {b}"}

        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(ws),
                env={**os.environ, "TERM": "dumb"},
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
            return {
                "exit_code": proc.returncode,
                "stdout": stdout.decode(errors="replace")[-5000:],  # Truncate large output
                "stderr": stderr.decode(errors="replace")[-2000:],
            }
        except asyncio.TimeoutError:
            proc.kill()
            return {"exit_code": -1, "stdout": "", "stderr": "Command timed out (60s limit)"}
        except Exception as e:
            return {"exit_code": -1, "stdout": "", "stderr": str(e)}

    def list_sessions(self) -> list[dict]:
        sessions = []
        for sid, path in self._active_sessions.items():
            sessions.append({"session_id": sid, "path": str(path), "name": path.name})
        return sessions


workspace_manager = WorkspaceManager()

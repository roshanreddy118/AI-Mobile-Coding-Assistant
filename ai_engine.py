"""
AI Engine - Multi-provider LLM integration
Supports: Groq (free), OpenRouter (free models), Gemini (free tier)
"""

import json
import httpx
from typing import Optional
from config import settings

SYSTEM_PROMPT = """You are an AI coding assistant integrated into a mobile development environment.
Your job is to interpret the user's voice commands and produce structured actions.

You MUST respond with valid JSON matching this schema:
{
  "intent": "one of: create_file, edit_file, delete_file, run_command, explain, debug, deploy, chat",
  "description": "brief human-readable summary of what you're doing",
  "actions": [
    {
      "type": "one of: write_file, patch_file, run_shell, respond",
      "path": "file path (for file operations)",
      "content": "file content or shell command or text response",
      "language": "programming language if applicable"
    }
  ]
}

Rules:
- For code generation, produce complete, working files
- For edits, produce the full updated file content
- For shell commands, provide the exact command to run
- For explanations/chat, use type "respond" with content
- Always infer project context from the conversation history
- Prefer simple, clean, production-quality code
- IMPORTANT: When creating web apps (HTML/CSS/JS), ALWAYS create a SINGLE self-contained index.html file with ALL CSS and JavaScript inlined. Do NOT use external imports, React CDN, or separate files. Use plain vanilla HTML, CSS, and JavaScript so the file works when opened directly in a browser with zero build steps.
- Make web UIs visually polished: use modern styling, dark themes, proper spacing, hover effects, and responsive design.
"""


class AIEngine:
    def __init__(self):
        self._clients: dict[str, httpx.AsyncClient] = {}

    async def _get_client(self, provider: str) -> httpx.AsyncClient:
        if provider not in self._clients:
            self._clients[provider] = httpx.AsyncClient(timeout=60.0)
        return self._clients[provider]

    async def process(
        self,
        user_message: str,
        context: list[dict] | None = None,
        provider: str | None = None,
    ) -> dict:
        """Process a user message through the LLM and return structured actions."""
        provider = provider or settings.DEFAULT_LLM_PROVIDER
        messages = self._build_messages(user_message, context)

        if provider == "groq":
            raw = await self._call_groq(messages)
        elif provider == "openrouter":
            raw = await self._call_openrouter(messages)
        elif provider == "gemini":
            raw = await self._call_gemini(messages)
        else:
            raise ValueError(f"Unknown provider: {provider}")

        return self._parse_response(raw)

    def _build_messages(self, user_message: str, context: list[dict] | None) -> list[dict]:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if context:
            messages.extend(context)
        messages.append({"role": "user", "content": user_message})
        return messages

    # ---- Groq (free tier: Llama, Mixtral via OpenAI-compatible API) ----

    async def _call_groq(self, messages: list[dict]) -> str:
        client = await self._get_client("groq")
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.GROQ_MODEL,
                "messages": messages,
                "temperature": 0.3,
                "max_tokens": 8192,
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    # ---- OpenRouter (free models: Llama, Mistral, etc.) ----

    async def _call_openrouter(self, messages: list[dict]) -> str:
        client = await self._get_client("openrouter")
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://mobile-coding-assistant.app",
                "X-Title": "Mobile Coding Assistant",
            },
            json={
                "model": settings.OPENROUTER_MODEL,
                "messages": messages,
                "temperature": 0.3,
                "max_tokens": 8192,
            },
        )
        data = resp.json()
        if "error" in data:
            raise ValueError(f"OpenRouter error: {data['error'].get('message', data['error'])}")
        resp.raise_for_status()
        return data["choices"][0]["message"]["content"]

    # ---- Gemini (free tier: generous limits) ----

    async def _call_gemini(self, messages: list[dict]) -> str:
        client = await self._get_client("gemini")

        # Convert OpenAI-style messages to Gemini format
        system_text = ""
        contents = []
        for msg in messages:
            if msg["role"] == "system":
                system_text = msg["content"]
            else:
                role = "user" if msg["role"] == "user" else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": msg["content"]}],
                })

        resp = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent",
            params={"key": settings.GEMINI_API_KEY},
            headers={"Content-Type": "application/json"},
            json={
                "system_instruction": {"parts": [{"text": system_text}]},
                "contents": contents,
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 8192,
                    "responseMimeType": "application/json",
                },
            },
        )
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]

    def _parse_response(self, raw: str) -> dict:
        """Parse the LLM JSON response, handling markdown code fences."""
        text = raw.strip()
        if text.startswith("```"):
            # Strip ```json ... ```
            lines = text.split("\n")
            text = "\n".join(lines[1:-1])
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {
                "intent": "chat",
                "description": "AI response (unparsed)",
                "actions": [{"type": "respond", "content": raw}],
            }

    async def chat(
        self,
        user_message: str,
        context: list[dict] | None = None,
        provider: str | None = None,
    ) -> str:
        """Simple chat without structured output — for conversational responses."""
        provider = provider or settings.DEFAULT_LLM_PROVIDER
        messages = [{"role": "system", "content": "You are a helpful mobile coding assistant. Be concise."}]
        if context:
            messages.extend(context)
        messages.append({"role": "user", "content": user_message})

        if provider == "groq":
            return await self._call_groq_plain(messages)
        elif provider == "openrouter":
            return await self._call_openrouter_plain(messages)
        elif provider == "gemini":
            return await self._call_gemini_plain(messages)
        raise ValueError(f"Unknown provider: {provider}")

    async def _call_groq_plain(self, messages: list[dict]) -> str:
        client = await self._get_client("groq")
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"model": settings.GROQ_MODEL, "messages": messages, "temperature": 0.5, "max_tokens": 4096},
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    async def _call_openrouter_plain(self, messages: list[dict]) -> str:
        client = await self._get_client("openrouter")
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"model": settings.OPENROUTER_MODEL, "messages": messages, "temperature": 0.5, "max_tokens": 4096},
        )
        data = resp.json()
        if "error" in data:
            raise ValueError(f"OpenRouter error: {data['error'].get('message', data['error'])}")
        resp.raise_for_status()
        return data["choices"][0]["message"]["content"]

    async def _call_gemini_plain(self, messages: list[dict]) -> str:
        client = await self._get_client("gemini")
        contents = []
        system_text = ""
        for msg in messages:
            if msg["role"] == "system":
                system_text = msg["content"]
            else:
                role = "user" if msg["role"] == "user" else "model"
                contents.append({"role": role, "parts": [{"text": msg["content"]}]})

        resp = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent",
            params={"key": settings.GEMINI_API_KEY},
            headers={"Content-Type": "application/json"},
            json={
                "system_instruction": {"parts": [{"text": system_text}]},
                "contents": contents,
                "generationConfig": {"temperature": 0.5, "maxOutputTokens": 4096},
            },
        )
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]

    async def close(self):
        for client in self._clients.values():
            await client.aclose()
        self._clients.clear()


ai_engine = AIEngine()

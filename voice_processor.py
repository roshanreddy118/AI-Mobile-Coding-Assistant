"""
Voice Processor - Speech-to-Text using Groq's free Whisper API
Also supports receiving pre-transcribed text from mobile STT.
"""

import httpx
from config import settings


class VoiceProcessor:
    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.wav") -> str:
        """
        Transcribe audio using Groq's free Whisper API.
        Supports: wav, mp3, m4a, webm, ogg
        """
        client = await self._get_client()

        resp = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            files={"file": (filename, audio_bytes)},
            data={
                "model": "whisper-large-v3",
                "language": "en",
                "response_format": "text",
            },
        )
        resp.raise_for_status()
        return resp.text.strip()

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None


voice_processor = VoiceProcessor()

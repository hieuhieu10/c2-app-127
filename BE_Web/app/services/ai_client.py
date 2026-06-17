from __future__ import annotations

import httpx

from app.core.settings import settings
from app.schemas.ai import AIGameResponse, LessonRequest, TemplateCandidate


class AIClientError(RuntimeError):
    pass


class AIClient:
    def __init__(self, base_url: str | None = None, timeout: float | None = None) -> None:
        self.base_url = (base_url or settings.be_ai_base_url).rstrip("/")
        self.timeout = timeout or settings.be_ai_timeout_seconds

    async def list_templates(self) -> list[TemplateCandidate]:
        data = await self._request("GET", "/templates")
        return [TemplateCandidate.model_validate(item) for item in data]

    async def generate(self, request: LessonRequest) -> AIGameResponse:
        data = await self._request("POST", "/generate", json=request.model_dump())
        return AIGameResponse.model_validate(data)

    async def generate_full(self, request: LessonRequest) -> AIGameResponse:
        data = await self._request("POST", "/generate/full", json=request.model_dump())
        return AIGameResponse.model_validate(data)

    async def _request(self, method: str, path: str, **kwargs: object) -> object:
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                response = await client.request(method, path, **kwargs)
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException as exc:
            raise AIClientError("BE_AI request timed out") from exc
        except httpx.HTTPStatusError as exc:
            raise AIClientError(f"BE_AI returned {exc.response.status_code}: {exc.response.text}") from exc
        except httpx.HTTPError as exc:
            raise AIClientError(f"BE_AI request failed: {exc}") from exc


def get_ai_client() -> AIClient:
    return AIClient()

"""Rutas HTTP del servicio de briefing."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import Settings, load_settings
from app.mock_client import MockClient, MockUnavailableError
from app.schemas import BriefingRequest, BriefingResponse
from app.service import BriefingService

ALLOWED_METHODS = ["GET", "POST", "OPTIONS"]
ALLOWED_HEADERS = ["Content-Type"]
BAD_GATEWAY_STATUS = 502
HEALTH_PAYLOAD = {"status": "ok"}


def create_app(settings: Settings | None = None, service: BriefingService | None = None) -> FastAPI:
    settings = settings or load_settings()
    service = service or BriefingService(
        settings, MockClient(settings.mock_base_url, settings.mock_timeout_seconds)
    )
    app = FastAPI(title="Agente asistente del supervisor")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_methods=ALLOWED_METHODS,
        allow_headers=ALLOWED_HEADERS,
    )

    @app.exception_handler(MockUnavailableError)
    async def handle_mock_unavailable(_request, error: MockUnavailableError) -> JSONResponse:
        return JSONResponse(status_code=BAD_GATEWAY_STATUS, content={"detail": str(error)})

    @app.get("/health")
    async def health() -> dict[str, str]:
        return HEALTH_PAYLOAD

    @app.post("/briefings", response_model=BriefingResponse)
    async def create_briefing(request: BriefingRequest) -> BriefingResponse:
        return await service.create_briefing(request)

    return app


app = create_app()

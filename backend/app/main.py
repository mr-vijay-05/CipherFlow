import sys
import os
import logging
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
root_dir = os.path.dirname(backend_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

try:
    from app.config import settings
    from app.api.router import api_router
    from app.database import engine, Base
    import app.models
except ImportError:
    from backend.app.config import settings
    from backend.app.api.router import api_router
    from backend.app.database import engine, Base
    import backend.app.models

# Configure safe zero-plaintext logger (Section 18)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cipherflow.backend")

# Create tables if not using migrations
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# CORS Middleware (allow explicit list + any localhost/127.0.0.1 port in dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Size Limit Middleware (Section 20)
@app.middleware("http")
async def validate_request_size(request: Request, call_next):
    # Preflight OPTIONS requests carry no payload
    if request.method == "OPTIONS":
        return await call_next(request)

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.MAX_PAYLOAD_BYTES:
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={"detail": "Encrypted payload exceeds maximum permitted size (10 MB)."},
        )
    return await call_next(request)

# Global safe error handler (Section 19: do not leak stack traces)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Internal request error on %s %s: %s", request.method, request.url.path, str(exc))
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Cryptographic boundaries preserved."},
    )

# Include API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "CipherFlow Encrypted Sync Engine",
        "phase": "Phase 3 (Encrypted Cloud Sync)",
        "plaintextKnowledge": "NONE (Blind Ciphertext Store)",
    }

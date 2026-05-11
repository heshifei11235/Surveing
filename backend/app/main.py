from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import tasks, sessions, messages
from .services.opencode_service import opencode_service
from .config import get_cors_config, get_backend_config

app = FastAPI(
    title="OpenCode Conversation Manager",
    description="Backend API for managing tasks, sessions, and AI-powered conversations",
    version="1.0.0"
)

# CORS middleware from config
cors_config = get_cors_config()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[cors_config.get('allowed_origins', '*')],
    allow_credentials=cors_config.get('allow_credentials', True),
    allow_methods=cors_config.get('allowed_methods', '*'),
    allow_headers=cors_config.get('allowed_headers', '*'),
)

# Include routers
app.include_router(tasks.router)
app.include_router(sessions.router)
app.include_router(messages.router)


@app.on_event("startup")
async def startup_event():
    """Initialize database and OpenCode service on startup"""
    init_db()
    await opencode_service.initialize()


@app.get("/")
def root():
    return {"message": "OpenCode Conversation Manager API", "status": "running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


def get_server_config():
    """Return server config for run.py"""
    return get_backend_config()
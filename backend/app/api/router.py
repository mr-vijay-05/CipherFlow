from fastapi import APIRouter
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.notes import router as notes_router
from backend.app.api.v1.sync import router as sync_router
from backend.app.api.v1.sharing import router as sharing_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(notes_router)
api_router.include_router(sync_router)
api_router.include_router(sharing_router)

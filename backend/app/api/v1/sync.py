import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.schemas.sync import SyncResponse
from backend.app.api.v1.notes import build_response
from backend.app.repositories.note_repository import note_repo
from backend.app.security.auth import get_current_user

router = APIRouter(prefix="/sync", tags=["Synchronization"])

@router.get("", response_model=SyncResponse)
def get_delta_sync(
    cursor: Optional[str] = Query(None, description="ISO timestamp cursor of last successful sync"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns encrypted changes and tombstones updated since cursor timestamp.
    SERVER NEVER DECRYPTS NOTE CONTENT.
    """
    if cursor:
        try:
            since = datetime.datetime.fromisoformat(cursor.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            since = datetime.datetime.min
    else:
        since = datetime.datetime.min

    now = datetime.datetime.utcnow()
    active_items, tombstones = note_repo.get_changes_since(db, user.id, since)

    changes = [build_response(n, v, m) for n, v, m in active_items]

    return SyncResponse(
        changes=changes,
        tombstones=tombstones,
        serverTimestamp=now.isoformat(),
        nextCursor=now.isoformat(),
    )

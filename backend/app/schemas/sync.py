from typing import List, Optional
from pydantic import BaseModel
from backend.app.schemas.note import EncryptedNoteResponse

class SyncResponse(BaseModel):
    changes: List[EncryptedNoteResponse]
    tombstones: List[str]  # Note IDs that were deleted
    serverTimestamp: str
    nextCursor: str

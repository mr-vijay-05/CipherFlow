from typing import List, Optional
from pydantic import BaseModel, Field

class NoteMetadataPayload(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = Field(default="", max_length=512)
    tags: List[str] = Field(default_factory=list)
    spaceId: Optional[str] = Field(default=None, max_length=64)
    isFavorite: bool = False
    isPinned: bool = False

class EncryptedNoteCreate(BaseModel):
    noteId: str = Field(..., min_length=1, max_length=64)
    version: int = Field(default=1, ge=1)
    ciphertext: str = Field(..., min_length=1)  # Base64 ciphertext + AEAD tag
    iv: str = Field(..., min_length=12, max_length=64)  # Base64 96-bit IV
    wrappedNoteKey: str = Field(..., min_length=1)  # Base64 AES-KW wrapped key
    aad: str = Field(..., min_length=1, max_length=255)
    metadata: NoteMetadataPayload

class EncryptedNoteUpdate(BaseModel):
    version: int = Field(..., ge=1, description="Expected next version (current + 1)")
    baseVersion: int = Field(..., ge=1, description="The version client is modifying from, for concurrency check")
    ciphertext: str = Field(..., min_length=1)
    iv: str = Field(..., min_length=12, max_length=64)
    wrappedNoteKey: Optional[str] = None  # If re-wrapped or rotated
    aad: str = Field(..., min_length=1, max_length=255)
    metadata: Optional[NoteMetadataPayload] = None

class EncryptedNoteResponse(BaseModel):
    noteId: str
    version: int
    ciphertext: str
    iv: str
    wrappedNoteKey: str
    aad: str
    metadata: NoteMetadataPayload
    isDeleted: bool = False
    createdAt: str
    updatedAt: str

    model_config = {"from_attributes": True}

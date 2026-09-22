from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class PublicKeyRegister(BaseModel):
    publicKeyJwk: Dict[str, Any]
    algorithm: str = "ECDH-P256"
    version: int = 1
    keyId: Optional[str] = None

class PublicKeyResponse(BaseModel):
    keyId: str
    userId: str
    publicKeyJwk: Dict[str, Any]
    algorithm: str
    version: int
    createdAt: str

class KeyEnvelopeSchema(BaseModel):
    id: str
    noteId: str
    recipientUserId: str
    role: str = Field(..., pattern="^(OWNER|EDITOR|VIEWER)$")
    wrappedNoteKey: str  # Base64 ciphertext
    ephemeralPublicKeyJwk: Dict[str, Any]
    iv: str  # Base64 IV
    algorithm: str = "ECDH-P256-HKDF-AES-GCM"
    keyId: Optional[str] = "primary"
    version: int
    createdAt: str

class ShareCreateRequest(BaseModel):
    recipientUserId: str
    role: str = Field("VIEWER", pattern="^(OWNER|EDITOR|VIEWER)$")
    envelope: KeyEnvelopeSchema

class ShareUpdateRequest(BaseModel):
    role: str = Field(..., pattern="^(OWNER|EDITOR|VIEWER)$")

class ShareResponse(BaseModel):
    id: str
    noteId: str
    ownerId: str
    recipientId: str
    role: str
    status: str  # PENDING, ACTIVE, REVOKED
    createdAt: str
    updatedAt: str
    revokedAt: Optional[str] = None

class KeyRotationRequest(BaseModel):
    version: int = Field(..., ge=1, description="Next version (current + 1)")
    baseVersion: int = Field(..., ge=1, description="Base version client started from")
    ciphertext: str
    iv: str
    aad: str
    envelopes: List[KeyEnvelopeSchema]

class AuditEventResponse(BaseModel):
    id: str
    noteId: str
    actorId: str
    eventType: str
    targetUserId: Optional[str] = None
    noteVersion: int
    metadata: Dict[str, Any] = {}
    createdAt: str

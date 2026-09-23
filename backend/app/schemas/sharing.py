import base64
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator

def validate_p256_public_jwk_dict(v: Dict[str, Any], field_name: str = "publicKeyJwk") -> Dict[str, Any]:
    if not isinstance(v, dict):
        raise ValueError(f"{field_name} must be a dictionary.")
    if v.get("kty") != "EC":
        raise ValueError(f"{field_name}.kty must be 'EC'.")
    if v.get("crv") != "P-256":
        raise ValueError(f"{field_name}.crv must be 'P-256'.")
    x = v.get("x")
    y = v.get("y")
    if not isinstance(x, str) or not isinstance(y, str):
        raise ValueError(f"{field_name} coordinates x and y must be strings.")
    
    def decode_b64u(s: str) -> bytes:
        padded = s + "=" * ((4 - len(s) % 4) % 4)
        return base64.urlsafe_b64decode(padded)
    
    try:
        x_bytes = decode_b64u(x)
        y_bytes = decode_b64u(y)
    except Exception as e:
        raise ValueError(f"Malformed base64url coordinates in {field_name}: {e}")
        
    if len(x_bytes) != 32 or len(y_bytes) != 32:
        raise ValueError(
            f"P-256 coordinates in {field_name} must be exactly 32 bytes (got x={len(x_bytes)}, y={len(y_bytes)})."
        )
    return v

class PublicKeyRegister(BaseModel):
    publicKeyJwk: Dict[str, Any]
    algorithm: str = "ECDH-P256"
    version: int = 1
    keyId: Optional[str] = None

    @field_validator("publicKeyJwk")
    @classmethod
    def validate_public_key_jwk(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        return validate_p256_public_jwk_dict(v, "publicKeyJwk")

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

    @field_validator("ephemeralPublicKeyJwk")
    @classmethod
    def validate_ephemeral_key_jwk(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        return validate_p256_public_jwk_dict(v, "ephemeralPublicKeyJwk")

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

class TamperReportRequest(BaseModel):
    noteId: str
    version: Optional[int] = 1
    reason: Optional[str] = "WebCrypto AES-GCM Authentication Failure: Message authentication tag mismatch or corrupted ciphertext"
    details: Optional[str] = None

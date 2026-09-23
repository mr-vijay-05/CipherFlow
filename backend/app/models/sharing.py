from datetime import datetime, timezone
import json
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class UserIdentity(Base):
    """
    Public key identity registry for secure sharing.
    Stores ONLY public keys; private keys remain client-side.
    """
    __tablename__ = "user_identities"

    key_id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    public_key = Column(Text, nullable=False)  # Exported JWK JSON string
    algorithm = Column(String(64), default="ECDH-P256", nullable=False)
    version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="identities")


class NoteShare(Base):
    """
    Access Control List (ACL) tracking collaborator roles and lifecycle status.
    Statuses: PENDING, ACTIVE, REVOKED
    Roles: OWNER, EDITOR, VIEWER
    """
    __tablename__ = "note_shares"

    id = Column(String(64), primary_key=True, index=True)
    note_id = Column(String(64), ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(32), default="VIEWER", nullable=False)  # OWNER, EDITOR, VIEWER
    status = Column(String(32), default="ACTIVE", nullable=False)  # PENDING, ACTIVE, REVOKED
    key_envelope_id = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    note = relationship("Note", back_populates="shares")
    owner = relationship("User", foreign_keys=[owner_id])
    recipient = relationship("User", foreign_keys=[recipient_id])


class KeyEnvelope(Base):
    """
    Recipient-specific sealed key envelope.
    Wrapped with recipient's public key via ECDH-P256 + HKDF + AES-256-GCM.
    NO plaintext note key is ever stored.
    """
    __tablename__ = "key_envelopes"

    id = Column(String(64), primary_key=True, index=True)
    note_id = Column(String(64), ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    key_id = Column(String(64), nullable=False)
    wrapped_note_key = Column(Text, nullable=False)  # Base64 ciphertext
    ephemeral_public_key = Column(Text, nullable=False)  # Ephemeral public key JWK
    iv = Column(String(64), nullable=False)  # Base64 IV
    algorithm = Column(String(64), default="ECDH-P256-HKDF-AES-GCM", nullable=False)
    version = Column(Integer, nullable=False)  # Note version this envelope unwraps
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    note = relationship("Note", back_populates="key_envelopes")


class AuditEvent(Base):
    """
    Immutable audit logging for notes, sharing, revocation, key rotation, and tamper detection.
    Plaintext and private keys are strictly forbidden.
    """
    __tablename__ = "audit_events"

    id = Column(String(64), primary_key=True, index=True)
    note_id = Column(String(64), ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(64), nullable=False)  # NOTE_CREATED, NOTE_UPDATED, NOTE_DECRYPTION_TAMPER_FAILURE, NOTE_SHARED, ROLE_CHANGED, ACCESS_REVOKED, KEY_ROTATED, etc.
    target_user_id = Column(String(64), nullable=True)
    note_version = Column(Integer, nullable=False)
    metadata_json = Column(Text, default="{}", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    note = relationship("Note", back_populates="audit_events")
    actor = relationship("User", foreign_keys=[actor_id])

    @property
    def event_metadata(self):
        try:
            return json.loads(self.metadata_json)
        except Exception:
            return {}

    @event_metadata.setter
    def event_metadata(self, val):
        self.metadata_json = json.dumps(val or {})


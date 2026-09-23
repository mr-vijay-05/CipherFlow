from datetime import datetime, timezone
import json
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Note(Base):
    __tablename__ = "notes"

    id = Column(String(64), primary_key=True, index=True)
    owner_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    current_version = Column(Integer, default=1, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    owner = relationship("User", back_populates="notes")
    versions = relationship("NoteVersion", back_populates="note", cascade="all, delete-orphan", order_by="NoteVersion.version")
    metadata_record = relationship("NoteMetadata", back_populates="note", uselist=False, cascade="all, delete-orphan")
    shares = relationship("NoteShare", back_populates="note", cascade="all, delete-orphan")
    key_envelopes = relationship("KeyEnvelope", back_populates="note", cascade="all, delete-orphan")
    audit_events = relationship("AuditEvent", back_populates="note", cascade="all, delete-orphan", order_by="AuditEvent.created_at")
    search_tokens = relationship("SearchTokenIndex", back_populates="note", cascade="all, delete-orphan")


class NoteVersion(Base):
    """
    Historical and current encrypted representations.
    STRICTLY ZERO PLAINTEXT NOTE CONTENT.
    """
    __tablename__ = "note_versions"

    id = Column(String(64), primary_key=True, index=True)
    note_id = Column(String(64), ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    ciphertext = Column(Text, nullable=False)  # Base64 encoded AES-256-GCM ciphertext + 128-bit tag
    iv = Column(String(64), nullable=False)  # Base64 encoded 96-bit IV
    wrapped_note_key = Column(Text, nullable=False)  # Base64 encoded AES-KW wrapped note key
    aad = Column(String(255), nullable=False)  # Canonical AAD string
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    note = relationship("Note", back_populates="versions")


class NoteMetadata(Base):
    """
    Catalog and indexing metadata for UI listing.
    """
    __tablename__ = "note_metadata"

    note_id = Column(String(64), ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(String(512), default="", nullable=False)
    tags_json = Column(Text, default="[]", nullable=False)  # Serialized JSON list of tags
    space_id = Column(String(64), nullable=True, index=True)
    is_favorite = Column(Boolean, default=False, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    note = relationship("Note", back_populates="metadata_record")

    @property
    def tags(self):
        try:
            return json.loads(self.tags_json)
        except Exception:
            return []

    @tags.setter
    def tags(self, val):
        self.tags_json = json.dumps(val or [])


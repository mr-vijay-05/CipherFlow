from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class SearchTokenIndex(Base):
    """
    Blind encrypted search index.
    STRICTLY ZERO PLAINTEXT SEARCH KEYWORDS OR NOTE CONTENT.
    Contains only HMAC-SHA-256 search tokens mapped to note_ids.
    Scoped strictly per user for user isolation.
    """
    __tablename__ = "search_token_index"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    note_id = Column(String(64), ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(128), nullable=False, index=True)  # URL-Safe Base64 HMAC-SHA-256 token
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User")
    note = relationship("Note", back_populates="search_tokens")

    __table_args__ = (
        Index("ix_search_token_user_token", "user_id", "token"),
        Index("ix_search_token_note_id", "note_id"),
    )

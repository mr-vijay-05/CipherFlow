import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import relationship
from backend.app.database import Base

class SyncState(Base):
    __tablename__ = "sync_state"

    device_id = Column(String(64), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    note_id = Column(String(64), ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    last_synced_version = Column(Integer, default=0, nullable=False)
    synced_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint("device_id", "note_id"),
    )

    device = relationship("Device", back_populates="sync_states")
    note = relationship("Note")

import datetime
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
from backend.app.models.note import Note, NoteVersion, NoteMetadata
from backend.app.schemas.note import EncryptedNoteCreate, EncryptedNoteUpdate

class VersionConflictException(Exception):
    def __init__(self, current_version: int, attempted_base_version: int):
        self.current_version = current_version
        self.attempted_base_version = attempted_base_version
        super().__init__(f"Conflict: Note is currently at version {current_version}, but update was based on version {attempted_base_version}.")

class NoteRepository:
    def get_by_id(self, db: Session, note_id: str, owner_id: str) -> Optional[Note]:
        return db.query(Note).filter(and_(Note.id == note_id, Note.owner_id == owner_id)).first()

    def get_latest_version(self, db: Session, note_id: str) -> Optional[NoteVersion]:
        return db.query(NoteVersion).filter(NoteVersion.note_id == note_id).order_by(NoteVersion.version.desc()).first()

    def create(self, db: Session, owner_id: str, payload: EncryptedNoteCreate) -> Tuple[Note, NoteVersion, NoteMetadata]:
        now = datetime.datetime.utcnow()
        note = Note(
            id=payload.noteId,
            owner_id=owner_id,
            current_version=payload.version,
            is_deleted=False,
            created_at=now,
            updated_at=now,
        )
        db.add(note)

        version = NoteVersion(
            id=f"{payload.noteId}-v{payload.version}",
            note_id=payload.noteId,
            version=payload.version,
            ciphertext=payload.ciphertext,
            iv=payload.iv,
            wrapped_note_key=payload.wrappedNoteKey,
            aad=payload.aad,
            created_at=now,
        )
        db.add(version)

        metadata = NoteMetadata(
            note_id=payload.noteId,
            title=payload.metadata.title,
            description=payload.metadata.description or "",
            space_id=payload.metadata.spaceId,
            is_favorite=payload.metadata.isFavorite,
            is_pinned=payload.metadata.isPinned,
            updated_at=now,
        )
        metadata.tags = payload.metadata.tags
        db.add(metadata)

        db.commit()
        db.refresh(note)
        db.refresh(version)
        db.refresh(metadata)
        return note, version, metadata

    def update_version(
        self, db: Session, note: Note, payload: EncryptedNoteUpdate
    ) -> Tuple[Note, NoteVersion, NoteMetadata]:
        # Optimistic Concurrency Check
        if note.current_version != payload.baseVersion:
            raise VersionConflictException(
                current_version=note.current_version,
                attempted_base_version=payload.baseVersion
            )

        now = datetime.datetime.utcnow()
        new_version_num = note.current_version + 1
        note.current_version = new_version_num
        note.updated_at = now

        # Get previous version if wrapped key wasn't rotated
        latest_v = self.get_latest_version(db, note.id)
        wrapped_key = payload.wrappedNoteKey or (latest_v.wrapped_note_key if latest_v else "")

        version = NoteVersion(
            id=f"{note.id}-v{new_version_num}",
            note_id=note.id,
            version=new_version_num,
            ciphertext=payload.ciphertext,
            iv=payload.iv,
            wrapped_note_key=wrapped_key,
            aad=payload.aad,
            created_at=now,
        )
        db.add(version)

        # Update metadata
        metadata = db.query(NoteMetadata).filter(NoteMetadata.note_id == note.id).first()
        if not metadata:
            metadata = NoteMetadata(note_id=note.id, title="Untitled", description="")
            db.add(metadata)

        if payload.metadata:
            metadata.title = payload.metadata.title
            metadata.description = payload.metadata.description or ""
            metadata.tags = payload.metadata.tags
            metadata.space_id = payload.metadata.spaceId
            metadata.is_favorite = payload.metadata.isFavorite
            metadata.is_pinned = payload.metadata.isPinned
        metadata.updated_at = now

        db.commit()
        db.refresh(note)
        db.refresh(version)
        db.refresh(metadata)
        return note, version, metadata

    def soft_delete(self, db: Session, note: Note) -> None:
        note.is_deleted = True
        note.updated_at = datetime.datetime.utcnow()
        db.commit()

    def get_changes_since(
        self, db: Session, owner_id: str, since: datetime.datetime
    ) -> Tuple[List[Tuple[Note, NoteVersion, NoteMetadata]], List[str]]:
        """
        Returns active note records updated since timestamp, and a list of deleted note IDs (tombstones).
        """
        notes = (
            db.query(Note)
            .filter(and_(Note.owner_id == owner_id, Note.updated_at >= since))
            .all()
        )

        active_items = []
        tombstones = []

        for n in notes:
            if n.is_deleted:
                tombstones.append(n.id)
            else:
                v = self.get_latest_version(db, n.id)
                m = db.query(NoteMetadata).filter(NoteMetadata.note_id == n.id).first()
                if v and m:
                    active_items.append((n, v, m))

        return active_items, tombstones

note_repo = NoteRepository()

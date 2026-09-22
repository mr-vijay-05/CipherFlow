from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.note import Note
from backend.app.models.sharing import NoteShare, KeyEnvelope
from backend.app.schemas.note import (
    EncryptedNoteCreate,
    EncryptedNoteUpdate,
    EncryptedNoteResponse,
    NoteMetadataPayload,
)
from backend.app.repositories.note_repository import note_repo, VersionConflictException
from backend.app.security.auth import get_current_user

router = APIRouter(prefix="/notes", tags=["Encrypted Notes"])

def build_response(note, version, metadata) -> EncryptedNoteResponse:
    return EncryptedNoteResponse(
        noteId=note.id,
        version=version.version,
        ciphertext=version.ciphertext,
        iv=version.iv,
        wrappedNoteKey=version.wrapped_note_key,
        aad=version.aad,
        metadata=NoteMetadataPayload(
            title=metadata.title,
            description=metadata.description,
            tags=metadata.tags,
            spaceId=metadata.space_id,
            isFavorite=metadata.is_favorite,
            isPinned=metadata.is_pinned,
        ),
        isDeleted=note.is_deleted,
        createdAt=note.created_at.isoformat(),
        updatedAt=note.updated_at.isoformat(),
    )

@router.post("", response_model=EncryptedNoteResponse, status_code=status.HTTP_201_CREATED)
def create_encrypted_note(
    payload: EncryptedNoteCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Receives encrypted ciphertext payload and persists to PostgreSQL.
    SERVER NEVER RECEIVES OR ATTEMPTS TO DECRYPT PLAINTEXT CONTENT.
    """
    existing = note_repo.get_by_id(db, payload.noteId, user.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Note with ID '{payload.noteId}' already exists.",
        )

    note, version, metadata = note_repo.create(db, user.id, payload)
    return build_response(note, version, metadata)

from backend.app.models.sharing import NoteShare, KeyEnvelope

@router.get("/{note_id}", response_model=EncryptedNoteResponse)
def get_encrypted_note(
    note_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns encrypted ciphertext payload only.
    Owner receives root-wrapped key; Collaborator receives their specific key envelope.
    """
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note or note.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encrypted note not found or has been deleted.",
        )

    # Authorization: Owner or active collaborator
    is_owner = note.owner_id == user.id
    if not is_owner:
        share = db.query(NoteShare).filter(
            NoteShare.note_id == note_id,
            NoteShare.recipient_id == user.id,
            NoteShare.status == "ACTIVE",
        ).first()
        if not share:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this encrypted note.",
            )

    version = note_repo.get_latest_version(db, note.id)
    metadata = note.metadata_record
    if not version or not metadata:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encrypted note payload corrupted or missing.",
        )

    # For collaborators, retrieve their recipient key envelope for this version
    wrapped_key = version.wrapped_note_key
    if not is_owner:
        envelope = db.query(KeyEnvelope).filter(
            KeyEnvelope.note_id == note_id,
            KeyEnvelope.recipient_id == user.id,
            KeyEnvelope.version == version.version,
            KeyEnvelope.revoked_at == None,
        ).first()
        if not envelope:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: No cryptographic key envelope available for this note version.",
            )
        wrapped_key = envelope.wrapped_note_key

    res = build_response(note, version, metadata)
    res.wrappedNoteKey = wrapped_key
    return res

@router.put("/{note_id}", response_model=EncryptedNoteResponse)
def update_encrypted_note(
    note_id: str,
    payload: EncryptedNoteUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Appends new encrypted version with optimistic concurrency check.
    OWNER and EDITOR roles can update. VIEWER is rejected with 403 Forbidden.
    """
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note or note.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encrypted note not found.",
        )

    # Authorization
    if note.owner_id != user.id:
        share = db.query(NoteShare).filter(
            NoteShare.note_id == note_id,
            NoteShare.recipient_id == user.id,
            NoteShare.status == "ACTIVE",
        ).first()
        if not share:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to update note.",
            )
        if share.role == "VIEWER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Viewer permission is read-only. Cannot update note content.",
            )

    try:
        note, version, metadata = note_repo.update_version(db, note, payload)
        return build_response(note, version, metadata)
    except VersionConflictException as err:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": str(err),
                "serverVersion": err.current_version,
                "attemptedBaseVersion": err.attempted_base_version,
            },
        )

@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_encrypted_note(
    note_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Marks note as deleted (tombstone). Only the OWNER can delete a note.
    """
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encrypted note not found.",
        )

    if note.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the note owner can delete the note.",
        )

    note_repo.soft_delete(db, note)
    return None

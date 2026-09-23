import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.note import Note
from app.models.search import SearchTokenIndex
from app.schemas.search import (
    IndexNoteTokensRequest,
    SearchQueryRequest,
    SearchResponse,
)
from app.security.auth import get_current_user

router = APIRouter(prefix="/search", tags=["Privacy-Preserving Encrypted Search"])

@router.post("/index", status_code=status.HTTP_200_OK)
def update_note_search_index(
    payload: IndexNoteTokensRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Receives blind HMAC-SHA-256 search tokens generated on the client.
    SERVER NEVER RECEIVES PLAINTEXT SEARCH KEYWORDS OR NOTE CONTENT.
    Updates the encrypted search index for the specified note.
    """
    note = db.query(Note).filter(Note.id == payload.noteId, Note.is_deleted == False).first()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found.")

    if note.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the note owner can update search index tokens in Phase 5 V1.",
        )

    # 1. Clear existing tokens for this note
    db.query(SearchTokenIndex).filter(SearchTokenIndex.note_id == payload.noteId).delete()

    # 2. Insert new blind search tokens (deduplicated)
    unique_tokens = list(set(payload.tokens))
    records = []
    for token in unique_tokens:
        clean_token = token.strip()
        if clean_token:
            records.append(
                SearchTokenIndex(
                    id=f"st-{uuid.uuid4().hex[:12]}",
                    user_id=current_user.id,
                    note_id=payload.noteId,
                    token=clean_token,
                )
            )

    if records:
        db.bulk_save_objects(records)

    db.commit()

    return {
        "status": "indexed",
        "noteId": payload.noteId,
        "indexedTokens": len(records),
    }


@router.post("/query", response_model=SearchResponse)
def query_encrypted_search_index(
    payload: SearchQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Receives client-generated HMAC-SHA-256 search query tokens.
    SERVER NEVER RECEIVES OR KNOWS THE PLAINTEXT QUERY KEYWORDS.
    Returns matching note IDs strictly scoped to the authenticated user.
    """
    if not payload.tokens:
        return SearchResponse(matchingNoteIds=[], matchCount=0)

    clean_tokens = [t.strip() for t in payload.tokens if t.strip()]
    if not clean_tokens:
        return SearchResponse(matchingNoteIds=[], matchCount=0)

    # Query matching note IDs strictly scoped to current_user
    matches = (
        db.query(SearchTokenIndex.note_id)
        .join(Note, Note.id == SearchTokenIndex.note_id)
        .filter(
            SearchTokenIndex.user_id == current_user.id,
            Note.owner_id == current_user.id,
            Note.is_deleted == False,
            SearchTokenIndex.token.in_(clean_tokens),
        )
        .distinct()
        .all()
    )

    matching_ids = [m[0] for m in matches]

    return SearchResponse(
        matchingNoteIds=matching_ids,
        matchCount=len(matching_ids),
    )


@router.delete("/index/{note_id}", status_code=status.HTTP_200_OK)
def delete_note_search_index(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Removes search tokens for a deleted note.
    """
    note = db.query(Note).filter(Note.id == note_id).first()
    if note and note.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to note index.",
        )

    deleted_count = (
        db.query(SearchTokenIndex)
        .filter(SearchTokenIndex.note_id == note_id, SearchTokenIndex.user_id == current_user.id)
        .delete()
    )
    db.commit()

    return {"status": "deleted", "noteId": note_id, "deletedTokens": deleted_count}

import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.note import Note, NoteVersion
from app.models.sharing import UserIdentity, NoteShare, KeyEnvelope, AuditEvent
from app.schemas.sharing import (
    PublicKeyRegister,
    PublicKeyResponse,
    ShareCreateRequest,
    ShareUpdateRequest,
    ShareResponse,
    KeyEnvelopeSchema,
    KeyRotationRequest,
    AuditEventResponse,
    TamperReportRequest,
)
from app.security.auth import get_current_user

router = APIRouter(tags=["Secure Sharing & Cryptographic Revocation"])

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def format_utc_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "Not available"

def get_note_and_check_permission(
    note_id: str,
    user_id: str,
    db: Session,
    required_role: Optional[str] = None,
) -> tuple[Note, str]:
    """
    Checks authorization for a note.
    Returns (Note, user_role).
    Roles: 'OWNER', 'EDITOR', 'VIEWER'.
    """
    note = db.query(Note).filter(Note.id == note_id, Note.is_deleted == False).first()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found.")

    if note.owner_id == user_id:
        return note, "OWNER"

    # Check active share
    share = db.query(NoteShare).filter(
        NoteShare.note_id == note_id,
        NoteShare.recipient_id == user_id,
        NoteShare.status == "ACTIVE",
    ).first()

    if not share:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this encrypted note.")

    if required_role == "OWNER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the note owner can manage sharing and access.")

    if required_role == "EDITOR" and share.role == "VIEWER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewer permission is read-only.")

    return note, share.role


# --- 1. Identity Public Key Registry ---

@router.post("/users/{user_id}/public-key", response_model=PublicKeyResponse)
def register_public_key(
    user_id: str,
    payload: PublicKeyRegister,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot register keys for another user.")

    key_id = payload.keyId or f"key-{user_id}-1"
    existing = db.query(UserIdentity).filter(
        (UserIdentity.key_id == key_id) | (UserIdentity.user_id == user_id)
    ).first()

    jwk_str = json.dumps(payload.publicKeyJwk)
    now = utc_now()

    if existing:
        existing.key_id = key_id
        existing.public_key = jwk_str
        existing.version = payload.version
        existing.created_at = now
        existing.revoked_at = None
        db.commit()
        db.refresh(existing)
        target = existing
    else:
        target = UserIdentity(
            key_id=key_id,
            user_id=user_id,
            public_key=jwk_str,
            algorithm=payload.algorithm,
            version=payload.version,
            created_at=now,
        )
        db.add(target)
        db.commit()
        db.refresh(target)

    return PublicKeyResponse(
        keyId=target.key_id,
        userId=target.user_id,
        publicKeyJwk=json.loads(target.public_key),
        algorithm=target.algorithm,
        version=target.version,
        createdAt=target.created_at.isoformat(),
    )


@router.get("/users/{user_id}/public-key", response_model=PublicKeyResponse)
def get_user_public_key(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    identity = db.query(UserIdentity).filter(
        UserIdentity.user_id == user_id,
        UserIdentity.revoked_at == None,
    ).order_by(UserIdentity.version.desc()).first()

    if not identity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Public key for user '{user_id}' not found.")

    return PublicKeyResponse(
        keyId=identity.key_id,
        userId=identity.user_id,
        publicKeyJwk=json.loads(identity.public_key),
        algorithm=identity.algorithm,
        version=identity.version,
        createdAt=identity.created_at.isoformat(),
    )


@router.get("/users/search")
def search_users(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = db.query(User).filter(
        (User.email.ilike(f"%{q}%")) | (User.id.ilike(f"%{q}%"))
    ).limit(20).all()

    results = []
    for u in users:
        has_key = db.query(UserIdentity).filter(UserIdentity.user_id == u.id).first() is not None
        results.append({
            "id": u.id,
            "email": u.email,
            "hasPublicKey": has_key,
        })
    return results


# --- 2. Share Management (Owner Only) ---

@router.post("/notes/{note_id}/shares", status_code=status.HTTP_201_CREATED, response_model=ShareResponse)
def create_note_share(
    note_id: str,
    payload: ShareCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note, role = get_note_and_check_permission(note_id, current_user.id, db, required_role="OWNER")

    # Verify recipient exists
    recipient = db.query(User).filter(User.id == payload.recipientUserId).first()
    if not recipient:
        recipient = User(id=payload.recipientUserId, email=f"{payload.recipientUserId}@cipherflow.internal")
        db.add(recipient)
        db.commit()

    now = utc_now()
    client_ip = get_client_ip(request)

    # Store key envelope
    envelope_data = payload.envelope
    new_envelope = KeyEnvelope(
        id=envelope_data.id,
        note_id=note_id,
        recipient_id=payload.recipientUserId,
        key_id=envelope_data.keyId,
        wrapped_note_key=envelope_data.wrappedNoteKey,
        ephemeral_public_key=json.dumps(envelope_data.ephemeralPublicKeyJwk),
        iv=envelope_data.iv,
        algorithm=envelope_data.algorithm,
        version=envelope_data.version,
        created_at=now,
    )
    db.add(new_envelope)

    # Check if share already exists (e.g. re-sharing after revocation)
    existing_share = db.query(NoteShare).filter(
        NoteShare.note_id == note_id,
        NoteShare.recipient_id == payload.recipientUserId,
    ).first()

    if existing_share:
        existing_share.role = payload.role
        existing_share.status = "ACTIVE"
        existing_share.key_envelope_id = new_envelope.id
        existing_share.updated_at = now
        existing_share.revoked_at = None
        share_record = existing_share
    else:
        share_record = NoteShare(
            id=f"share-{note_id}-{payload.recipientUserId}-{int(now.timestamp())}",
            note_id=note_id,
            owner_id=current_user.id,
            recipient_id=payload.recipientUserId,
            role=payload.role,
            status="ACTIVE",
            key_envelope_id=new_envelope.id,
            created_at=now,
            updated_at=now,
        )
        db.add(share_record)

    # Record NOTE_SHARED Audit Event
    audit = AuditEvent(
        id=f"audit-{int(now.timestamp()*1000)}-{uuid.uuid4().hex[:6]}",
        note_id=note_id,
        actor_id=current_user.id,
        event_type="NOTE_SHARED",
        target_user_id=payload.recipientUserId,
        note_version=note.current_version,
        metadata_json=json.dumps({
            "noteId": note_id,
            "version": note.current_version,
            "recipientUserId": payload.recipientUserId,
            "role": payload.role,
            "envelopeId": new_envelope.id,
            "timestamp": format_utc_iso(now),
            "status": "success",
            "ipAddress": client_ip,
            "action": "Cryptographic Access Grant Created",
            "noteTitle": note.metadata_record.title if note.metadata_record else "Note",
        }),
        created_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(share_record)

    return ShareResponse(
        id=share_record.id,
        noteId=share_record.note_id,
        ownerId=share_record.owner_id,
        recipientId=share_record.recipient_id,
        role=share_record.role,
        status=share_record.status,
        createdAt=format_utc_iso(share_record.created_at),
        updatedAt=format_utc_iso(share_record.updated_at),
        revokedAt=format_utc_iso(share_record.revoked_at) if share_record.revoked_at else None,
    )


@router.get("/notes/{note_id}/shares", response_model=List[ShareResponse])
def list_note_shares(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note, _ = get_note_and_check_permission(note_id, current_user.id, db)

    shares = db.query(NoteShare).filter(NoteShare.note_id == note_id).all()
    return [
        ShareResponse(
            id=s.id,
            noteId=s.note_id,
            ownerId=s.owner_id,
            recipientId=s.recipient_id,
            role=s.role,
            status=s.status,
            createdAt=s.created_at.isoformat(),
            updatedAt=s.updated_at.isoformat(),
            revokedAt=s.revoked_at.isoformat() if s.revoked_at else None,
        )
        for s in shares
    ]


@router.patch("/notes/{note_id}/shares/{recipient_id}", response_model=ShareResponse)
def update_share_role(
    note_id: str,
    recipient_id: str,
    payload: ShareUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note, _ = get_note_and_check_permission(note_id, current_user.id, db, required_role="OWNER")

    share = db.query(NoteShare).filter(
        NoteShare.note_id == note_id,
        NoteShare.recipient_id == recipient_id,
        NoteShare.status == "ACTIVE",
    ).first()

    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active share not found.")

    old_role = share.role
    share.role = payload.role
    now = utc_now()
    share.updated_at = now
    client_ip = get_client_ip(request)

    audit = AuditEvent(
        id=f"audit-{int(now.timestamp()*1000)}-{uuid.uuid4().hex[:6]}",
        note_id=note_id,
        actor_id=current_user.id,
        event_type="ROLE_CHANGED",
        target_user_id=recipient_id,
        note_version=note.current_version,
        metadata_json=json.dumps({
            "oldRole": old_role,
            "newRole": payload.role,
            "ipAddress": client_ip,
            "action": "Collaborator Role Changed",
            "noteTitle": note.metadata_record.title if note.metadata_record else "Note",
        }),
        created_at=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(share)

    return ShareResponse(
        id=share.id,
        noteId=share.note_id,
        ownerId=share.owner_id,
        recipientId=share.recipient_id,
        role=share.role,
        status=share.status,
        createdAt=format_utc_iso(share.created_at),
        updatedAt=format_utc_iso(share.updated_at),
    )


@router.delete("/notes/{note_id}/shares/{recipient_id}")
def revoke_share(
    note_id: str,
    recipient_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note, _ = get_note_and_check_permission(note_id, current_user.id, db, required_role="OWNER")

    share = db.query(NoteShare).filter(
        NoteShare.note_id == note_id,
        NoteShare.recipient_id == recipient_id,
        NoteShare.status == "ACTIVE",
    ).first()

    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active share not found for this user.")

    now = utc_now()
    share.status = "REVOKED"
    share.revoked_at = now
    share.updated_at = now
    client_ip = get_client_ip(request)

    # Mark envelope revoked
    db.query(KeyEnvelope).filter(
        KeyEnvelope.note_id == note_id,
        KeyEnvelope.recipient_id == recipient_id,
    ).update({"revoked_at": now})

    # Record ACCESS_REVOKED audit event
    audit = AuditEvent(
        id=f"audit-{int(now.timestamp()*1000)}-{uuid.uuid4().hex[:6]}",
        note_id=note_id,
        actor_id=current_user.id,
        event_type="ACCESS_REVOKED",
        target_user_id=recipient_id,
        note_version=note.current_version,
        metadata_json=json.dumps({
            "revokedRole": share.role,
            "ipAddress": client_ip,
            "action": "Collaborator Access Revocation Executed",
            "noteTitle": note.metadata_record.title if note.metadata_record else "Note",
        }),
        created_at=now,
    )
    db.add(audit)
    db.commit()

    return {
        "status": "revoked",
        "noteId": note_id,
        "recipientId": recipient_id,
        "message": "Access revoked. Cryptographic rekey required to seal future versions.",
    }


# --- 3. Cryptographic Key Rotation & Rekey ---

@router.post("/notes/{note_id}/rotate-key")
def rotate_note_key(
    note_id: str,
    payload: KeyRotationRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note, _ = get_note_and_check_permission(note_id, current_user.id, db, required_role="OWNER")

    # Concurrency Check: verify client's baseVersion matches current server version
    if payload.baseVersion != note.current_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflict: Note has been updated to version {note.current_version}. Refresh and re-rotate key.",
        )

    if payload.version != note.current_version + 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid target version {payload.version}. Expected {note.current_version + 1}.",
        )

    now = utc_now()
    client_ip = get_client_ip(request)

    # Create new NoteVersion
    new_version_record = NoteVersion(
        id=f"ver-{note_id}-v{payload.version}-{int(now.timestamp())}",
        note_id=note_id,
        version=payload.version,
        ciphertext=payload.ciphertext,
        iv=payload.iv,
        wrapped_note_key="",  # Kept in envelopes
        aad=payload.aad,
        created_at=now,
    )
    db.add(new_version_record)

    # Store new envelopes for remaining authorized recipients
    for env in payload.envelopes:
        new_env = KeyEnvelope(
            id=env.id,
            note_id=note_id,
            recipient_id=env.recipientUserId,
            key_id=env.keyId,
            wrapped_note_key=env.wrappedNoteKey,
            ephemeral_public_key=json.dumps(env.ephemeralPublicKeyJwk),
            iv=env.iv,
            algorithm=env.algorithm,
            version=payload.version,
            created_at=now,
        )
        db.add(new_env)

    # Advance note version
    note.current_version = payload.version
    note.updated_at = now

    # Record KEY_ROTATED audit event
    audit = AuditEvent(
        id=f"audit-{int(now.timestamp()*1000)}-{uuid.uuid4().hex[:6]}",
        note_id=note_id,
        actor_id=current_user.id,
        event_type="KEY_ROTATED",
        target_user_id=None,
        note_version=payload.version,
        metadata_json=json.dumps({
            "recipientCount": len(payload.envelopes),
            "ipAddress": client_ip,
            "action": "Cryptographic Rekey Executed",
            "noteTitle": note.metadata_record.title if note.metadata_record else "Note",
        }),
        created_at=now,
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "noteId": note_id,
        "newVersion": payload.version,
        "envelopesCount": len(payload.envelopes),
    }


# --- 4. Key Envelopes & Audit Trail Retrieval ---

@router.get("/notes/{note_id}/key-envelopes")
def get_key_envelopes(
    note_id: str,
    version: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note, role = get_note_and_check_permission(note_id, current_user.id, db)
    target_version = version or note.current_version

    # If owner, return all envelopes for this version; if collaborator, return their specific envelope
    query = db.query(KeyEnvelope).filter(
        KeyEnvelope.note_id == note_id,
        KeyEnvelope.version == target_version,
        KeyEnvelope.revoked_at == None,
    )

    if role != "OWNER":
        query = query.filter(KeyEnvelope.recipient_id == current_user.id)

    envelopes = query.all()

    return [
        {
            "id": e.id,
            "noteId": e.note_id,
            "recipientUserId": e.recipient_id,
            "keyId": e.key_id,
            "wrappedNoteKey": e.wrapped_note_key,
            "ephemeralPublicKeyJwk": json.loads(e.ephemeral_public_key),
            "iv": e.iv,
            "algorithm": e.algorithm,
            "version": e.version,
            "createdAt": format_utc_iso(e.created_at),
        }
        for e in envelopes
    ]


@router.get("/notes/{note_id}/audit-events", response_model=List[AuditEventResponse])
def get_note_audit_events(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_note_and_check_permission(note_id, current_user.id, db)

    events = db.query(AuditEvent).filter(
        AuditEvent.note_id == note_id
    ).order_by(AuditEvent.created_at.desc()).all()

    return [
        AuditEventResponse(
            id=ev.id,
            noteId=ev.note_id,
            actorId=ev.actor_id,
            eventType=ev.event_type,
            targetUserId=ev.target_user_id,
            noteVersion=ev.note_version,
            metadata=ev.event_metadata,
            createdAt=format_utc_iso(ev.created_at),
        )
        for ev in events
    ]


@router.get("/audit-events", response_model=List[AuditEventResponse])
def get_user_audit_events(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_notes = db.query(Note.id).filter(Note.owner_id == current_user.id)
    shared_notes = db.query(NoteShare.note_id).filter(
        NoteShare.recipient_id == current_user.id,
        NoteShare.status == "ACTIVE"
    )

    query = db.query(AuditEvent).filter(
        (AuditEvent.actor_id == current_user.id) |
        (AuditEvent.target_user_id == current_user.id) |
        AuditEvent.note_id.in_(owned_notes) |
        AuditEvent.note_id.in_(shared_notes)
    )

    if category and category != "all":
        cat = category.lower()
        if cat in ["edit", "create"]:
            query = query.filter(AuditEvent.event_type.in_(["NOTE_CREATED", "NOTE_UPDATED", "NOTE_REENCRYPTED"]))
        elif cat == "share":
            query = query.filter(AuditEvent.event_type.in_(["NOTE_SHARED", "ROLE_CHANGED", "SHARE_CREATED", "SHARE_ROLE_CHANGED"]))
        elif cat == "revoke":
            query = query.filter(AuditEvent.event_type.in_(["ACCESS_REVOKED", "KEY_ROTATED", "CRYPTOGRAPHIC_REKEY"]))
        elif cat == "security":
            query = query.filter(AuditEvent.event_type.in_(["NOTE_DECRYPTION_TAMPER_FAILURE", "KEY_ROTATED", "CRYPTOGRAPHIC_REKEY"]))
        elif cat == "device":
            query = query.filter(AuditEvent.event_type.in_(["DEVICE_REGISTERED", "DEVICE_REVOKED"]))

    events = query.order_by(AuditEvent.created_at.desc()).limit(100).all()

    return [
        AuditEventResponse(
            id=ev.id,
            noteId=ev.note_id,
            actorId=ev.actor_id,
            eventType=ev.event_type,
            targetUserId=ev.target_user_id,
            noteVersion=ev.note_version,
            metadata=ev.event_metadata,
            createdAt=format_utc_iso(ev.created_at),
        )
        for ev in events
    ]


@router.post("/audit-events/report-tamper", response_model=AuditEventResponse, status_code=status.HTTP_201_CREATED)
def report_tamper_event(
    payload: TamperReportRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = db.query(Note).filter(Note.id == payload.noteId).first()
    note_title = "Encrypted Note"
    if note and note.metadata_record:
        note_title = note.metadata_record.title

    now = utc_now()
    client_ip = get_client_ip(request)

    audit = AuditEvent(
        id=f"audit-{int(now.timestamp()*1000)}-{uuid.uuid4().hex[:6]}",
        note_id=payload.noteId,
        actor_id=current_user.id,
        event_type="NOTE_DECRYPTION_TAMPER_FAILURE",
        target_user_id=None,
        note_version=payload.version or (note.current_version if note else 1),
        metadata_json=json.dumps({
            "ipAddress": client_ip,
            "noteTitle": note_title,
            "action": "Decryption Integrity Check Failed",
            "reason": payload.reason,
            "details": payload.details or "Fail-closed: In-memory/storage ciphertext tampering detected by WebCrypto AES-GCM.",
            "algorithm": "AES-256-GCM",
            "status": "alert",
        }),
        created_at=now,
    )
    db.add(audit)
    db.commit()

    return AuditEventResponse(
        id=audit.id,
        noteId=audit.note_id,
        actorId=audit.actor_id,
        eventType=audit.event_type,
        targetUserId=audit.target_user_id,
        noteVersion=audit.note_version,
        metadata=audit.event_metadata,
        createdAt=format_utc_iso(audit.created_at),
    )


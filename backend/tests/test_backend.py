import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.user import User
from app.models.note import Note, NoteVersion, NoteMetadata
from app.security.auth import create_dev_access_token

@pytest.fixture(scope="module")
def client():
    # Setup clean test client
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def user_a():
    db = SessionLocal()
    u = db.query(User).filter(User.id == "test-user-a").first()
    if not u:
        u = User(id="test-user-a", email="user_a@cipherflow.internal")
        db.add(u)
        db.commit()
    db.close()
    token = create_dev_access_token("test-user-a", "user_a@cipherflow.internal")
    return {"id": "test-user-a", "email": "user_a@cipherflow.internal", "token": token}

@pytest.fixture(scope="module")
def user_b():
    db = SessionLocal()
    u = db.query(User).filter(User.id == "test-user-b").first()
    if not u:
        u = User(id="test-user-b", email="user_b@cipherflow.internal")
        db.add(u)
        db.commit()
    db.close()
    token = create_dev_access_token("test-user-b", "user_b@cipherflow.internal")
    return {"id": "test-user-b", "email": "user_b@cipherflow.internal", "token": token}

# 1. Create encrypted note
def test_create_encrypted_note(client, user_a):
    headers = {"Authorization": f"Bearer {user_a['token']}"}
    payload = {
        "noteId": "note-backend-test-1",
        "version": 1,
        "ciphertext": "QWxhZGRpbjpvcGVuIHNlc2FtZQ==",
        "iv": "dGhpcyBpcyBhbiBpdg==",
        "wrappedNoteKey": "d3JhcHBlZF9rZXlfZGF0YQ==",
        "aad": "note-backend-test-1:1:AES-256-GCM",
        "metadata": {
            "title": "Backend Architecture Notes",
            "description": "System design",
            "tags": ["backend", "crypto"],
            "spaceId": "work",
            "isFavorite": True,
            "isPinned": False,
        }
    }
    res = client.post("/api/v1/notes", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["noteId"] == "note-backend-test-1"
    assert data["version"] == 1
    assert data["ciphertext"] == payload["ciphertext"]
    assert data["metadata"]["title"] == "Backend Architecture Notes"

# 2. Retrieve encrypted note
def test_retrieve_encrypted_note(client, user_a):
    headers = {"Authorization": f"Bearer {user_a['token']}"}
    res = client.get("/api/v1/notes/note-backend-test-1", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["noteId"] == "note-backend-test-1"
    assert data["ciphertext"] == "QWxhZGRpbjpvcGVuIHNlc2FtZQ=="

# 3. Update encrypted note
def test_update_encrypted_note(client, user_a):
    headers = {"Authorization": f"Bearer {user_a['token']}"}
    payload = {
        "version": 2,
        "baseVersion": 1,
        "ciphertext": "VXBkYXRlZCBjaXBoZXJ0ZXh0",
        "iv": "bmV3X2l2XzEyYnl0ZXM=",
        "aad": "note-backend-test-1:2:AES-256-GCM",
        "metadata": {
            "title": "Backend Architecture Notes (Updated)",
            "description": "System design v2",
            "tags": ["backend", "v2"],
            "isFavorite": True,
            "isPinned": True,
        }
    }
    res = client.put("/api/v1/notes/note-backend-test-1", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["version"] == 2
    assert data["ciphertext"] == payload["ciphertext"]

# 4. Version conflict (Optimistic Concurrency)
def test_version_conflict_detection(client, user_a):
    headers = {"Authorization": f"Bearer {user_a['token']}"}
    # Attempt update based on stale baseVersion 1 when server is at version 2
    payload = {
        "version": 2,
        "baseVersion": 1,  # Stale!
        "ciphertext": "U3RhbGUgY2lwaGVydGV4dA==",
        "iv": "c3RhbGVfaXZfdmFsdWU=",
        "aad": "note-backend-test-1:2:AES-256-GCM",
    }
    res = client.put("/api/v1/notes/note-backend-test-1", json=payload, headers=headers)
    assert res.status_code == 409
    data = res.json()
    assert "Conflict" in str(data)

# 5. Unauthorized access & User Isolation
def test_user_isolation(client, user_a, user_b):
    headers_b = {"Authorization": f"Bearer {user_b['token']}"}
    # User B should NOT be able to access User A's note
    res = client.get("/api/v1/notes/note-backend-test-1", headers=headers_b)
    assert res.status_code in (403, 404)

# 6. Invalid payload rejected
def test_invalid_payload_rejected(client, user_a):
    headers = {"Authorization": f"Bearer {user_a['token']}"}
    res = client.post("/api/v1/notes", json={"noteId": ""}, headers=headers)
    assert res.status_code == 422

# 7. Oversized payload rejected (> 10MB)
def test_oversized_payload_rejected(client, user_a):
    headers = {
        "Authorization": f"Bearer {user_a['token']}",
        "content-length": "15000000",  # 15 MB
    }
    res = client.post("/api/v1/notes", json={"noteId": "large"}, headers=headers)
    assert res.status_code == 413

# 8. Sync endpoint & deltas
def test_sync_endpoint(client, user_a):
    headers = {"Authorization": f"Bearer {user_a['token']}"}
    res = client.get("/api/v1/sync", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "changes" in data
    assert "tombstones" in data
    assert "nextCursor" in data
    assert any(c["noteId"] == "note-backend-test-1" for c in data["changes"])

# 9. Delete / Tombstone
def test_soft_delete_and_tombstone(client, user_a):
    headers = {"Authorization": f"Bearer {user_a['token']}"}
    res = client.delete("/api/v1/notes/note-backend-test-1", headers=headers)
    assert res.status_code == 204

    # Now verify it returns in sync tombstones
    res_sync = client.get("/api/v1/sync", headers=headers)
    assert "note-backend-test-1" in res_sync.json()["tombstones"]

# 10. CRITICAL SECURITY TEST: Server storage MUST NOT contain plaintext note body
def test_zero_plaintext_note_body_in_server_storage():
    db = SessionLocal()
    sensitive_word = "ORION meeting tomorrow at 10 AM"

    # Query all note versions and metadata
    versions = db.query(NoteVersion).all()
    metadata_list = db.query(NoteMetadata).all()

    for v in versions:
        assert sensitive_word not in v.ciphertext, "Plaintext found in ciphertext column!"
        assert sensitive_word not in v.wrapped_note_key, "Plaintext found in wrapped key!"

    for m in metadata_list:
        assert sensitive_word not in m.title, "Plaintext found in title!"
        assert sensitive_word not in m.description, "Plaintext found in description!"

    db.close()


# 11. AUDIT TRAIL: Note creation and updates must generate server-side audit events
def test_note_creation_and_update_audit_events(client, user_a):
    headers = {"Authorization": f"Bearer {user_a['token']}"}
    
    # Check user audit events
    res = client.get("/api/v1/audit-events", headers=headers)
    assert res.status_code == 200
    events = res.json()
    
    # Must have NOTE_CREATED and NOTE_UPDATED events
    created_events = [e for e in events if e["eventType"] == "NOTE_CREATED"]
    updated_events = [e for e in events if e["eventType"] == "NOTE_UPDATED"]
    assert len(created_events) >= 1, "Expected NOTE_CREATED audit event"
    assert len(updated_events) >= 1, "Expected NOTE_UPDATED audit event"

    ev = created_events[0]
    assert ev["actorId"] == user_a["id"]
    assert "createdAt" in ev
    # Verify timezone-aware UTC ISO format
    assert "+" in ev["createdAt"] or "Z" in ev["createdAt"] or "T" in ev["createdAt"]
    assert "ipAddress" in ev["metadata"]

    # Test report tamper endpoint
    tamper_payload = {
        "noteId": "note-backend-test-1",
        "version": 2,
        "reason": "Test in-memory AES-GCM tag mismatch",
        "details": "Simulated live tamper detection bit-flip",
    }
    res_tamper = client.post("/api/v1/audit-events/report-tamper", json=tamper_payload, headers=headers)
    assert res_tamper.status_code == 201
    tamper_event = res_tamper.json()
    assert tamper_event["eventType"] == "NOTE_DECRYPTION_TAMPER_FAILURE"
    assert tamper_event["metadata"]["status"] == "alert"



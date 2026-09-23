import pytest
import json
import uuid
import base64
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.user import User
from app.models.note import Note, NoteVersion, NoteMetadata
from app.models.sharing import UserIdentity, NoteShare, KeyEnvelope, AuditEvent
from app.security.auth import create_dev_access_token

def generate_p256_public_jwk() -> dict:
    private_key = ec.generate_private_key(ec.SECP256R1())
    pub = private_key.public_key().public_numbers()
    x = base64.urlsafe_b64encode(pub.x.to_bytes(32, "big")).decode("utf-8").rstrip("=")
    y = base64.urlsafe_b64encode(pub.y.to_bytes(32, "big")).decode("utf-8").rstrip("=")
    return {
        "kty": "EC",
        "crv": "P-256",
        "x": x,
        "y": y,
    }

TEST_NOTE_ID = f"note-share-{uuid.uuid4().hex[:8]}"

@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def users():
    db = SessionLocal()
    u_alice = db.query(User).filter(User.id == "user-alice").first()
    if not u_alice:
        u_alice = User(id="user-alice", email="alice@cipherflow.com")
        db.add(u_alice)

    u_bob = db.query(User).filter(User.id == "user-bob").first()
    if not u_bob:
        u_bob = User(id="user-bob", email="bob@cipherflow.com")
        db.add(u_bob)

    u_carol = db.query(User).filter(User.id == "user-carol").first()
    if not u_carol:
        u_carol = User(id="user-carol", email="carol@cipherflow.com")
        db.add(u_carol)

    db.commit()
    db.close()

    return {
        "alice": {
            "id": "user-alice",
            "email": "alice@cipherflow.com",
            "token": create_dev_access_token("user-alice", "alice@cipherflow.com"),
        },
        "bob": {
            "id": "user-bob",
            "email": "bob@cipherflow.com",
            "token": create_dev_access_token("user-bob", "bob@cipherflow.com"),
        },
        "carol": {
            "id": "user-carol",
            "email": "carol@cipherflow.com",
            "token": create_dev_access_token("user-carol", "carol@cipherflow.com"),
        },
    }

def test_register_and_fetch_public_key(client, users):
    alice = users["alice"]
    headers = {"Authorization": f"Bearer {alice['token']}"}
    jwk = generate_p256_public_jwk()

    # 1. Register public key
    reg_res = client.post(
        f"/api/v1/users/{alice['id']}/public-key",
        json={"publicKeyJwk": jwk, "algorithm": "ECDH-P256", "version": 1},
        headers=headers,
    )
    assert reg_res.status_code == 200
    data = reg_res.json()
    assert data["userId"] == alice["id"]
    assert data["publicKeyJwk"]["crv"] == "P-256"

    # Test malformed public key rejection (fail-closed)
    malformed_res = client.post(
        f"/api/v1/users/{alice['id']}/public-key",
        json={"publicKeyJwk": {"kty": "EC", "crv": "P-256", "x": "bx", "y": "by"}, "algorithm": "ECDH-P256", "version": 1},
        headers=headers,
    )
    assert malformed_res.status_code == 422

    # 2. Fetch public key (can be retrieved by another user, e.g. Bob)
    bob_headers = {"Authorization": f"Bearer {users['bob']['token']}"}
    get_res = client.get(f"/api/v1/users/{alice['id']}/public-key", headers=bob_headers)
    assert get_res.status_code == 200
    assert get_res.json()["userId"] == alice["id"]

def test_create_note_and_share_envelope(client, users):
    alice = users["alice"]
    bob = users["bob"]
    headers = {"Authorization": f"Bearer {alice['token']}"}

    # Register Bob's public key first
    bob_headers = {"Authorization": f"Bearer {bob['token']}"}
    client.post(
        f"/api/v1/users/{bob['id']}/public-key",
        json={"publicKeyJwk": generate_p256_public_jwk(), "algorithm": "ECDH-P256", "version": 1},
        headers=bob_headers,
    )

    # Alice creates a note
    note_payload = {
        "noteId": TEST_NOTE_ID,
        "version": 1,
        "ciphertext": "QWxpY2UncyBzZWNyZXQgbm90ZSBib2R5",
        "iv": "dGVzdF9pdl85NmJpdA==",
        "wrappedNoteKey": "d3JhcHBlZF9rZXlfZm9yX2FsaWNl",
        "aad": f"{TEST_NOTE_ID}:1:AES-256-GCM",
        "metadata": {
            "title": "Confidential Specification",
            "tags": ["secret"],
            "spaceId": "rnd",
        },
    }
    create_res = client.post("/api/v1/notes", json=note_payload, headers=headers)
    assert create_res.status_code == 201

    # Alice shares note with Bob as VIEWER
    share_payload = {
        "recipientUserId": bob["id"],
        "role": "VIEWER",
        "envelope": {
            "id": f"env-bob-{TEST_NOTE_ID}-v1",
            "noteId": TEST_NOTE_ID,
            "recipientUserId": bob["id"],
            "role": "VIEWER",
            "wrappedNoteKey": "d3JhcHBlZF9rZXlfZm9yX2JvYg==",
            "ephemeralPublicKeyJwk": generate_p256_public_jwk(),
            "iv": "ZXBoZW1lcmFsX2l2",
            "algorithm": "ECDH-P256-HKDF-AES-GCM",
            "keyId": "primary",
            "version": 1,
            "createdAt": "2026-09-23T00:00:00Z",
        },
    }
    share_res = client.post(
        f"/api/v1/notes/{TEST_NOTE_ID}/shares",
        json=share_payload,
        headers=headers,
    )
    assert share_res.status_code == 201
    assert share_res.json()["role"] == "VIEWER"

    # Bob fetches the note
    bob_get_res = client.get(f"/api/v1/notes/{TEST_NOTE_ID}", headers=bob_headers)
    assert bob_get_res.status_code == 200
    assert bob_get_res.json()["wrappedNoteKey"] == "d3JhcHBlZF9rZXlfZm9yX2JvYg=="

    # Bob as VIEWER attempts to update -> must fail 403 Forbidden
    update_res = client.put(
        f"/api/v1/notes/{TEST_NOTE_ID}",
        json={
            "version": 2,
            "baseVersion": 1,
            "ciphertext": "dGFtcGVyZWRfYnktdmlld2Vy",
            "iv": "dGVzdF9pdl85NmJpdA==",
            "aad": f"{TEST_NOTE_ID}:2:AES-256-GCM",
        },
        headers=bob_headers,
    )
    assert update_res.status_code == 403
    assert "Viewer permission is read-only" in update_res.json()["detail"]

def test_role_change_and_editor_update(client, users):
    alice = users["alice"]
    bob = users["bob"]
    alice_headers = {"Authorization": f"Bearer {alice['token']}"}
    bob_headers = {"Authorization": f"Bearer {bob['token']}"}

    # Alice promotes Bob to EDITOR
    role_res = client.patch(
        f"/api/v1/notes/{TEST_NOTE_ID}/shares/{bob['id']}",
        json={"role": "EDITOR"},
        headers=alice_headers,
    )
    assert role_res.status_code == 200
    assert role_res.json()["role"] == "EDITOR"

    # Bob updates note as EDITOR -> must succeed
    update_res = client.put(
        f"/api/v1/notes/{TEST_NOTE_ID}",
        json={
            "version": 2,
            "baseVersion": 1,
            "ciphertext": "bmV3X2VkaXRvcl9jaXBoZXJ0ZXh0",
            "iv": "bmV3X2l2XzEyYnl0ZXM=",
            "aad": f"{TEST_NOTE_ID}:2:AES-256-GCM",
        },
        headers=bob_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["version"] == 2

def test_revocation_and_cryptographic_rekey(client, users):
    alice = users["alice"]
    bob = users["bob"]
    carol = users["carol"]
    alice_headers = {"Authorization": f"Bearer {alice['token']}"}
    bob_headers = {"Authorization": f"Bearer {bob['token']}"}
    carol_headers = {"Authorization": f"Bearer {carol['token']}"}

    # Alice shares note with Carol as well
    client.post(
        f"/api/v1/users/{carol['id']}/public-key",
        json={"publicKeyJwk": generate_p256_public_jwk(), "algorithm": "ECDH-P256", "version": 1},
        headers=carol_headers,
    )
    client.post(
        f"/api/v1/notes/{TEST_NOTE_ID}/shares",
        json={
            "recipientUserId": carol["id"],
            "role": "VIEWER",
            "envelope": {
                "id": f"env-carol-{TEST_NOTE_ID}-v2",
                "noteId": TEST_NOTE_ID,
                "recipientUserId": carol["id"],
                "role": "VIEWER",
                "wrappedNoteKey": "d3JhcHBlZF9rZXlfZm9yX2Nhcm9s",
                "ephemeralPublicKeyJwk": generate_p256_public_jwk(),
                "iv": "ZXBoZW1lcmFsX2l2Mg==",
                "algorithm": "ECDH-P256-HKDF-AES-GCM",
                "keyId": "primary",
                "version": 2,
                "createdAt": "2026-09-23T00:00:00Z",
            },
        },
        headers=alice_headers,
    )

    # 1. Alice revokes Bob
    revoke_res = client.delete(
        f"/api/v1/notes/{TEST_NOTE_ID}/shares/{bob['id']}",
        headers=alice_headers,
    )
    assert revoke_res.status_code == 200

    # 2. Alice performs Cryptographic Rekey (Version 3) with envelope for Carol only
    rotate_res = client.post(
        f"/api/v1/notes/{TEST_NOTE_ID}/rotate-key",
        json={
            "version": 3,
            "baseVersion": 2,
            "ciphertext": "cm90YXRlZF9jaXBoZXJ0ZXh0X2sy",
            "iv": "cm90YXRlZF9pdl8xMmJ5dGVz",
            "aad": f"{TEST_NOTE_ID}:3:AES-256-GCM",
            "envelopes": [
                {
                    "id": f"env-carol-{TEST_NOTE_ID}-v3",
                    "noteId": TEST_NOTE_ID,
                    "recipientUserId": carol["id"],
                    "role": "VIEWER",
                    "wrappedNoteKey": "Y2Fyb2xfazJfZW52ZWxvcGU=",
                    "ephemeralPublicKeyJwk": generate_p256_public_jwk(),
                    "iv": "ZXBoZW1lcmFsX2l2Mw==",
                    "algorithm": "ECDH-P256-HKDF-AES-GCM",
                    "keyId": "primary",
                    "version": 3,
                    "createdAt": "2026-09-23T00:00:00Z",
                }
            ],
        },
        headers=alice_headers,
    )
    assert rotate_res.status_code == 200
    assert rotate_res.json()["newVersion"] == 3

    # 3. Bob tries to access note -> denied 403
    bob_res = client.get(f"/api/v1/notes/{TEST_NOTE_ID}", headers=bob_headers)
    assert bob_res.status_code == 403

    # 4. Carol accesses note version 3 -> receives her envelope
    carol_res = client.get(f"/api/v1/notes/{TEST_NOTE_ID}", headers=carol_headers)
    assert carol_res.status_code == 200
    assert carol_res.json()["wrappedNoteKey"] == "Y2Fyb2xfazJfZW52ZWxvcGU="

def test_audit_trail_events(client, users):
    alice = users["alice"]
    headers = {"Authorization": f"Bearer {alice['token']}"}

    res = client.get(f"/api/v1/notes/{TEST_NOTE_ID}/audit-events", headers=headers)
    assert res.status_code == 200
    events = res.json()
    event_types = [e["eventType"] for e in events]
    assert "NOTE_SHARED" in event_types
    assert "ROLE_CHANGED" in event_types
    assert "ACCESS_REVOKED" in event_types
    assert "KEY_ROTATED" in event_types


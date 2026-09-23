import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.user import User
from app.models.note import Note, NoteVersion, NoteMetadata
from app.models.search import SearchTokenIndex
from app.security.auth import create_dev_access_token

@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def search_users():
    db = SessionLocal()
    u1 = db.query(User).filter(User.id == "user-search-alice").first()
    if not u1:
        u1 = User(id="user-search-alice", email="alice-search@cipherflow.com")
        db.add(u1)

    u2 = db.query(User).filter(User.id == "user-search-bob").first()
    if not u2:
        u2 = User(id="user-search-bob", email="bob-search@cipherflow.com")
        db.add(u2)

    db.commit()
    db.close()

    return {
        "alice": {
            "id": "user-search-alice",
            "token": create_dev_access_token("user-search-alice", "alice-search@cipherflow.com"),
        },
        "bob": {
            "id": "user-search-bob",
            "token": create_dev_access_token("user-search-bob", "bob-search@cipherflow.com"),
        },
    }

def test_index_and_query_blind_tokens(client, search_users):
    alice = search_users["alice"]
    headers = {"Authorization": f"Bearer {alice['token']}"}

    # 1. Create a note for Alice
    note_id = f"note-search-{uuid.uuid4().hex[:6]}"
    note_res = client.post(
        "/api/v1/notes",
        json={
            "noteId": note_id,
            "version": 1,
            "ciphertext": "encrypted-payload-base64",
            "iv": "random-iv-base64",
            "wrappedNoteKey": "wrapped-key-base64",
            "aad": f"{note_id}:1:AES-256-GCM",
            "metadata": {
                "title": "Quantum Cryptography Architecture",
                "description": "Research notes",
                "tags": ["crypto", "quantum"],
            },
        },
        headers=headers,
    )
    assert note_res.status_code == 201

    # 2. Client computes blind HMAC tokens locally (e.g. for 'quantum', 'cryptography', 'architecture')
    uid = uuid.uuid4().hex[:6]
    token_quantum = f"hmac_token_quantum_{uid}"
    token_crypto = f"hmac_token_crypto_{uid}"
    token_arch = f"hmac_token_arch_{uid}"

    index_res = client.post(
        "/api/v1/search/index",
        json={
            "noteId": note_id,
            "tokens": [token_quantum, token_crypto, token_arch],
        },
        headers=headers,
    )
    assert index_res.status_code == 200
    assert index_res.json()["status"] == "indexed"
    assert index_res.json()["indexedTokens"] == 3

    # 3. Query with valid token
    query_res = client.post(
        "/api/v1/search/query",
        json={"tokens": [token_quantum]},
        headers=headers,
    )
    assert query_res.status_code == 200
    res_data = query_res.json()
    assert note_id in res_data["matchingNoteIds"]
    assert res_data["matchCount"] == 1

    # 4. Query with non-existent token
    wrong_res = client.post(
        "/api/v1/search/query",
        json={"tokens": ["hmac_token_nonexistent_xyz999"]},
        headers=headers,
    )
    assert wrong_res.status_code == 200
    assert wrong_res.json()["matchingNoteIds"] == []
    assert wrong_res.json()["matchCount"] == 0

def test_user_isolation_in_search(client, search_users):
    alice = search_users["alice"]
    bob = search_users["bob"]

    alice_headers = {"Authorization": f"Bearer {alice['token']}"}
    bob_headers = {"Authorization": f"Bearer {bob['token']}"}

    # Alice creates a secret note and indexes a shared concept token
    shared_concept_token = "hmac_token_confidential_777"
    alice_note_id = f"note-alice-{uuid.uuid4().hex[:6]}"

    client.post(
        "/api/v1/notes",
        json={
            "noteId": alice_note_id,
            "version": 1,
            "ciphertext": "alice-ciphertext",
            "iv": "alice-iv-96bit",
            "wrappedNoteKey": "alice-wrapped-key",
            "aad": f"{alice_note_id}:1:AES-256-GCM",
            "metadata": {"title": "Alice Secret"},
        },
        headers=alice_headers,
    )

    client.post(
        "/api/v1/search/index",
        json={"noteId": alice_note_id, "tokens": [shared_concept_token]},
        headers=alice_headers,
    )

    # Bob searches with the exact same token
    bob_query = client.post(
        "/api/v1/search/query",
        json={"tokens": [shared_concept_token]},
        headers=bob_headers,
    )
    assert bob_query.status_code == 200
    # Bob MUST NOT receive Alice's note ID!
    assert alice_note_id not in bob_query.json()["matchingNoteIds"]
    assert bob_query.json()["matchCount"] == 0

def test_note_update_replaces_search_tokens(client, search_users):
    alice = search_users["alice"]
    headers = {"Authorization": f"Bearer {alice['token']}"}

    note_id = f"note-update-{uuid.uuid4().hex[:6]}"
    client.post(
        "/api/v1/notes",
        json={
            "noteId": note_id,
            "version": 1,
            "ciphertext": "cipher-v1",
            "iv": "random-iv-96bit-base64",
            "wrappedNoteKey": "wrapped-key",
            "aad": f"{note_id}:1:AES-256-GCM",
            "metadata": {"title": "Initial Title"},
        },
        headers=headers,
    )

    old_token = "token_old_keyword_111"
    client.post(
        "/api/v1/search/index",
        json={"noteId": note_id, "tokens": [old_token]},
        headers=headers,
    )

    # Verify old token matches
    q1 = client.post("/api/v1/search/query", json={"tokens": [old_token]}, headers=headers)
    assert note_id in q1.json()["matchingNoteIds"]

    # Now update note with new tokens
    new_token = "token_new_keyword_222"
    client.post(
        "/api/v1/search/index",
        json={"noteId": note_id, "tokens": [new_token]},
        headers=headers,
    )

    # Old token MUST NOT match anymore
    q_old = client.post("/api/v1/search/query", json={"tokens": [old_token]}, headers=headers)
    assert note_id not in q_old.json()["matchingNoteIds"]

    # New token MUST match
    q_new = client.post("/api/v1/search/query", json={"tokens": [new_token]}, headers=headers)
    assert note_id in q_new.json()["matchingNoteIds"]

def test_zero_plaintext_in_search_index_storage():
    db = SessionLocal()
    # Check all rows in search_token_index
    rows = db.query(SearchTokenIndex).all()
    assert len(rows) > 0

    for row in rows:
        # Columns: id, user_id, note_id, token, created_at
        assert hasattr(row, "token")
        assert not hasattr(row, "keyword")
        assert not hasattr(row, "plaintext")
        assert not hasattr(row, "content")
        # Ensure token does not look like plaintext english
        assert " " not in row.token
    db.close()

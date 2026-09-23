# CipherFlow Phase 5: Privacy-Preserving Encrypted Search

**Product Tagline**: *"Your Knowledge. Your Control."*  
**Specification**: Searchable Symmetric Encryption (SSE) via Client-Side Deterministic Trapdoors  
**Security Status**: Fully Implemented & Cryptographically Tested (15/15 Pass)

---

## 1. Overview & Architecture

Phase 5 introduces privacy-preserving encrypted search across client-side encrypted notes without exposing plaintext note content or plaintext search keywords to cloud servers.

### Architectural Data Flow:

```
[ User Keyword Input: "architecture" ]
                 │
                 ▼
[ Client-Side Normalization & Tokenization ]
  - Unicode NFKC Normalization
  - Lowercase conversion
  - Word boundary extraction
                 │
                 ▼
[ Local HMAC-SHA-256 Evaluation ]
  - SearchKey: 256-bit WebCrypto Key in IndexedDB Vault
  - Token = Base64Url(HMAC-SHA-256(SearchKey, "architecture"))
                 │
                 ▼
[ Network Transmission: POST /api/v1/search/query ]
  - Request Payload: { "tokens": ["hmac_token_hash_base64url..."] }
  - Server NEVER receives the string "architecture"
                 │
                 ▼
[ Backend Blind Token Index Query ]
  - Scoped strictly to current_user.id
  - Matches blind token in search_token_index table
  - Returns matching note IDs: ["note-chimera-001", "note-2"]
                 │
                 ▼
[ Client-Side Decryption & Local Rendering ]
  - Client retrieves matching encrypted records
  - Unwraps note keys from Protected Local Vault
  - Decrypts AES-256-GCM ciphertext + verifies AAD
  - Displays authenticated plaintext results in UI
```

---

## 2. Cryptographic Search Key Specification

1. **Dedicated Algorithm**:
   - `HMAC-SHA-256` with a dedicated 256-bit key length (`extractable: false`).
   - Completely independent from the Device Root Key (`AES-KW`) and note encryption keys ($K_1, K_2, \dots$).
2. **Storage Boundary**:
   - Stored exclusively in the client's **Protected Local Vault** (`IndexedDB` object store `cryptoKeys` under `search_key_${userId}`).
   - Strictly forbidden from `localStorage`, `sessionStorage`, or cookies.
   - Never exported across API requests or network boundaries.
3. **Key Derivation Context**:
   - For deterministic derivation from a master vault secret, the cryptographically separated context string is:
     $$\text{Context} = \text{"CipherFlow/SearchKey/v1"}$$
   - Derived using `HKDF-SHA-256` with salt `"cipherflow-search-salt-v1"`.

---

## 3. Client-Side Tokenization

To ensure exact token boundary matching across different user input styles:
1. **Unicode Normalization**: Canonical decomposition followed by canonical composition (`NFKC`).
2. **Case Folding**: All tokens converted to lowercase (`.toLowerCase()`).
3. **Word Boundary Extraction**: Uses Unicode character property regular expressions (`/[\p{L}\p{N}]+/gu`).
4. **Punctuation & Empty Removal**: Trailing punctuation and empty whitespace tokens are stripped.

Example:
```
Input:     "Project Chimera: Distributed Architecture (v2)!"
Tokens:    ["project", "chimera", "distributed", "architecture", "v2"]
Encrypted: [HMAC(K_s, "project"), HMAC(K_s, "chimera"), ...]
```

---

## 4. Threat Model & Leakage Analysis

> [!WARNING]
> **No Claims of Zero-Leakage or Zero-Knowledge Search**:
> Searchable Symmetric Encryption (SSE) schemes based on deterministic trapdoors inherently leak specific patterns to the server. CipherFlow explicitly acknowledges and documents these trade-offs according to modern cryptographic literature (Curtmola et al., Cash et al.).

### What Is Protected (Security Guarantees):
- **Plaintext Note Bodies**: The server never receives, stores, or processes unencrypted note content.
- **Plaintext Search Keywords**: The server never receives raw search terms (e.g. `"architecture"`). It receives only opaque, high-entropy 256-bit hashes.
- **SearchKey Secrecy**: The server never possesses the `SearchKey`. Without the key, the server cannot precompute a rainbow table across unknown dictionaries without brute-force HMAC attacks.
- **Unauthorized Cross-User Search**: User A's search queries and indexed tokens are cryptographically and logically isolated from User B.

### Known Leakage Profile (What the Server Can Learn):
1. **Search Pattern Leakage**:
   - Because token generation is deterministic for a given `SearchKey`, querying the same keyword multiple times yields the exact same HMAC token.
   - *Implication*: An honest-but-curious server can determine when a user is searching for the *same* keyword at different times.
2. **Access Pattern Leakage**:
   - The server observes which encrypted note IDs are returned for a given search token.
   - *Implication*: The server can correlate notes that share identical keywords.
3. **Co-Occurrence & Frequency Analysis**:
   - If an attacker obtains side-channel statistical knowledge about document frequency (e.g. knowing a specific public dataset or vocabulary distribution), they may attempt frequency analysis attacks against the frequency of search tokens across notes.
4. **Volume Leakage**:
   - The server knows how many unique tokens are associated with each note ID, which correlates with note length and vocabulary size.

---

## 5. Scope & Deferred Capabilities (Phase 5 V1)

- **User-Owned Notes Only**:
  - In Phase 5 V1, encrypted search indices are generated and queried exclusively for user-owned notes.
- **Shared-Note Search Deferred**:
  > *"Shared-note encrypted search requires additional per-recipient search-key access design and leakage analysis and is deferred."*
  - In collaborative environments, sharing a deterministic `SearchKey` across multiple users would allow any collaborator to observe or forge tokens for other shared notes. Multi-party searchable encryption (such as per-note search capabilities or forward-private dynamic SSE) is slated for future architectural phases.

---

## 6. Verification & Automated Test Matrix

The Phase 5 test suite (`src/crypto/__tests__/phase5SecurityTests.ts`) exercises 15 security invariants:

| # | Invariant Tested | Result |
| :--- | :--- | :---: |
| 1 | Deterministic token generation across repeated runs | **PASS** |
| 2 | Distinct keywords produce distinct HMAC-SHA-256 tokens | **PASS** |
| 3 | `SearchKey` is non-extractable and cannot be exported | **PASS** |
| 4 | Plaintext keyword absent from request payload | **PASS** |
| 5 | `SearchKey` material absent from request payload | **PASS** |
| 6 | Token changes when `SearchKey` changes (per-user divergence) | **PASS** |
| 7 | Index records contain zero plaintext keywords | **PASS** |
| 8 | Correct search token returns correct matching note IDs | **PASS** |
| 9 | Unmatched search token returns empty result set | **PASS** |
| 10 | User isolation prevents cross-tenant access to indexed notes | **PASS** |
| 11 | Note content update refreshes and replaces search index | **PASS** |
| 12 | Note deletion purges search tokens from index | **PASS** |
| 13 | SearchKey retrieval from vault is idempotent across reloads | **PASS** |
| 14 | Encrypted search results decrypt locally using Phase 2 AES-256-GCM | **PASS** |
| 15 | Existing Phase 2 tamper-detection & fail-closed crypto remains intact | **PASS** |

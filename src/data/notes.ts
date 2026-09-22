import { Note } from '../types/note';

export const INITIAL_NOTES: Note[] = [
  {
    id: 'note-1',
    title: 'Project Orion - Architecture',
    description: 'System design, module breakdown, and deployment strategy...',
    content: `# Project Orion - Architecture

## Executive Overview
Project Orion is our zero-trust enclave processing pipeline designed to handle distributed workloads without centralized unencrypted data exposure.

## Key Subsystems
1. **Client Identity & Key Derivation**: Uses Argon2id key derivation on device with a user-supplied passphrase.
2. **Encrypted Channel Transport**: Noise protocol framework for end-to-end forward secrecy between edge nodes.
3. **Storage Nodes**: Pure blind ciphertext stores with content-addressable BLOB indexing.

\`\`\`
[Device Enclave] ──(AES-256-GCM)──> [Blind Storage API]
        │
    (Key Rotation)
        ▼
[Revocation Ledger]
\`\`\`

## Deployment Checklist
- [x] Configure hardware security key attestations
- [x] Establish automated key rotation schedules
- [ ] Review access grant revocation propagation
`,
    tags: ['orion', 'architecture'],
    spaceId: 'work',
    updatedAt: '2 hours ago',
    createdAt: '2026-09-18T10:30:00Z',
    isFavorite: true,
    isPinned: true,
    securityStatus: 'encrypted',
    collaborators: [
      { id: 'u1', name: 'Arjun Verma', email: 'arjun@cipherflow.internal', role: 'editor', grantedAt: '2 days ago' },
      { id: 'u2', name: 'Dr. Sarah Lin', email: 'sarah.lin@college.edu', role: 'viewer', grantedAt: '1 week ago' },
      { id: 'u3', name: 'Priya Sharma', email: 'priya@techco.io', role: 'viewer', grantedAt: '3 days ago' },
    ],
    iconType: 'file',
  },
  {
    id: 'note-2',
    title: 'Meeting Notes - Client Discussion',
    description: 'Discussed requirements, timeline and next steps...',
    content: `# Meeting Notes - Client Discussion

**Date**: Today, 14:00 - 15:30 IST
**Participants**: Vijay Vignesh, Arjun Verma, Global FinTech Client Team

## Key Takeaways
- Client mandates that all compliance logs remain unindexed on cloud servers.
- Client requires client-side search indexing so server administrators cannot audit search terms.
- Target delivery for Phase 1 UI validation is scheduled for end of week.

## Action Items
- [x] Finalize application layout and mock service contracts
- [ ] Distribute cryptographic specifications for review
- [ ] Schedule follow-up architecture review session
`,
    tags: ['meeting', 'client'],
    spaceId: 'work',
    updatedAt: '5 hours ago',
    createdAt: '2026-09-20T14:00:00Z',
    isFavorite: false,
    isPinned: false,
    securityStatus: 'shared',
    collaborators: [
      { id: 'u1', name: 'Arjun Verma', email: 'arjun@cipherflow.internal', role: 'editor', grantedAt: '5 hours ago' },
    ],
    iconType: 'code',
  },
  {
    id: 'note-3',
    title: 'Research Ideas',
    description: 'Potential topics for next semester research...',
    content: `# Research Ideas - Cryptographic Systems

## Topic 1: Blind Searchable Encryption in Low-Latency Enclaves
Investigate practical trade-offs between ORAM (Oblivious RAM) and asymmetric searchable symmetric encryption (SSE) on resource-constrained mobile hardware.

## Topic 2: Post-Quantum Secret Sharing Schemes
Evaluating Kyber & Dilithium signature integration for peer-to-peer note synchronization without cloud reliance.

## Relevant Papers
- *Boneh et al.*: Public Key Encryption with keyword Search (PEKS)
- *Curtmola et al.*: Searchable Symmetric Encryption: Improved Definitions and Efficient Constructions
`,
    tags: ['research', 'ideas'],
    spaceId: 'college',
    updatedAt: '1 day ago',
    createdAt: '2026-09-17T09:15:00Z',
    isFavorite: true,
    isPinned: false,
    securityStatus: 'encrypted',
    iconType: 'lightbulb',
  },
  {
    id: 'note-4',
    title: 'Personal Goals',
    description: 'Career planning, skill development and milestones...',
    content: `# Personal Goals & Vision 2026

## Core Pillars
1. **Mastery**: Deep dive into systems programming, formal verification, and distributed cryptography.
2. **Health**: Consistent strength workouts 4x/week and mindful digital downtime.
3. **Reading**: Complete 15 foundational technical papers and 12 books on history/philosophy.

## Milestones for Q1
- [x] Ship CipherFlow Phase 1 foundational UI architecture
- [ ] Complete advanced distributed systems course
- [ ] Publish write-up on verifiable computing and data sovereignty
`,
    tags: ['personal', 'goals'],
    spaceId: 'personal',
    updatedAt: '2 days ago',
    createdAt: '2026-09-15T18:00:00Z',
    isFavorite: true,
    isPinned: false,
    securityStatus: 'locked',
    iconType: 'heart',
  },
  {
    id: 'note-5',
    title: 'Travel Plans - Himachal',
    description: 'Itinerary, places to visit, budget and contacts...',
    content: `# Travel Plans - Himachal Trek & Retreat

## Route Plan
- **Day 1**: Flight to Chandigarh -> Drive to Tirthan Valley
- **Day 2**: Trek to Great Himalayan National Park inner gate
- **Day 3**: Day hike around Jalori Pass & Serolsar Lake
- **Day 4**: Jibhi peaceful work day (offline encrypted sync test)
- **Day 5**: Return drive to Chandigarh

## Gear Checklist
- Waterproof pack cover
- Offline maps cached on encrypted phone storage
- Satellite messenger & emergency contact cards
`,
    tags: ['travel', 'trip'],
    spaceId: 'personal',
    updatedAt: '3 days ago',
    createdAt: '2026-09-12T11:20:00Z',
    isFavorite: false,
    isPinned: false,
    securityStatus: 'encrypted',
    iconType: 'plane',
  },
  {
    id: 'note-6',
    title: 'Distributed Systems & Consensus Reading',
    description: 'Notes on Raft, Paxos, and Byzantine Fault Tolerance...',
    content: `# Distributed Systems & Consensus Notes

Exploring state machine replication models and leader election guarantees in unstrusted networks.
`,
    tags: ['college', 'distributed-systems'],
    spaceId: 'college',
    updatedAt: '4 days ago',
    createdAt: '2026-09-10T16:00:00Z',
    isFavorite: true,
    isPinned: false,
    securityStatus: 'encrypted',
    iconType: 'book',
  },
  {
    id: 'note-7',
    title: 'Quarterly Security Budget & Keys Audit',
    description: 'Hardware key tokens, HSM allocation, and audit fees...',
    content: `# Quarterly Security Budget & Keys Audit

Audit log of physical YubiKeys assigned to engineering leads and planned HSM licensing.
`,
    tags: ['work', 'budget', 'security'],
    spaceId: 'work',
    updatedAt: '5 days ago',
    createdAt: '2026-09-08T13:45:00Z',
    isFavorite: false,
    isPinned: false,
    securityStatus: 'locked',
    iconType: 'file',
  }
];

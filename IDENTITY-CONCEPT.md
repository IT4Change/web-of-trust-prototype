# Identity & Authorization Concept

## Current State

**Fake DIDs**: `did:key:${timestamp}-${random}` without cryptographic keys
- No signatures
- No verification
- No proof of authorship
- Trust-based (anyone can claim any DID)

## Goals

1. **Cryptographic Identity**: Real `did:key` with keypair
2. **Signed Actions**: All mutations (votes, edits, creates) are signed
3. **Client-side Verification**: Each client validates signatures before trusting data
4. **Future-proof**: Support key recovery, delegation, and rotation

---

## Part 1: Understanding Automerge & Event Sourcing

### Automerge is Event Sourcing (Low-Level)

**Yes**, Automerge uses event sourcing internally:
```
Change 1: set doc.assumptions["abc"].sentence = "Hello"
Change 2: push doc.assumptions["abc"].tagIds <- "tag-1"
Change 3: set doc.votes["vote-1"].value = "green"
```

Each peer stores the **full history** of changes and can sync incrementally.

### The Gap: Domain Events vs CRDT Operations

Automerge events are **low-level CRDT operations**, not **domain events**:

| CRDT Operation (Automerge) | Domain Event (Our App) |
|-----------------------------|------------------------|
| `set property` | `VoteCast(did, assumption, value)` |
| `push to array` | `TagAdded(did, assumption, tag)` |
| `delete key` | `AssumptionDeleted(did, assumption)` |

**Implication**: We need an **application-level validation layer** on top of Automerge.

---

## Part 2: Authorization Architecture

### Strategy A: Signature-per-Entity (Simple)

**Approach**: Each entity (Vote, Edit, Assumption) includes a signature field.

```typescript
interface Vote {
  id: string;
  assumptionId: string;
  voterDid: string;
  value: VoteValue;
  createdAt: number;
  // New fields:
  signature: string;  // Signs: `${assumptionId}:${value}:${voterDid}:${createdAt}`
}
```

**Validation** (client-side, on read):
```typescript
function useValidVotes(doc: OpinionGraphDoc): Record<string, Vote> {
  return useMemo(() => {
    const valid: Record<string, Vote> = {};
    for (const [id, vote] of Object.entries(doc.votes)) {
      if (verifyVoteSignature(vote)) {
        valid[id] = vote;
      } else {
        console.warn('Invalid vote signature:', id);
      }
    }
    return valid;
  }, [doc.votes]);
}
```

**Pros**:
- Simple to implement
- Each entity is self-contained
- Works with Automerge CRDT (signatures are just data)

**Cons**:
- No delegation (can't vote on behalf of someone)
- No fine-grained permissions (e.g., "can only edit own assumptions")
- Key compromise = all past signatures invalid

### Strategy B: UCAN-based Capabilities

**UCAN (User Controlled Authorization Networks)**:
- JWT-like tokens for decentralized authorization
- Supports **delegation**: Alice can authorize Bob to act on her behalf
- Supports **attenuation**: Bob can give Carol fewer rights than he has
- Supports **chaining**: Verifiable chain of delegations

**Example UCAN for Narrative**:
```typescript
// Alice creates a UCAN for Bob
const ucan = {
  iss: "did:key:z6Mk...alice",   // Issuer (Alice)
  aud: "did:key:z6Mk...bob",     // Audience (Bob)
  att: [{
    with: "narrative:assumption:abc123",  // Resource
    can: "vote"                           // Capability
  }],
  prf: [],                        // Proofs (parent UCANs)
  exp: 1735689600,                // Expiration
  signature: "..."                // Alice's signature
};

// Bob uses this UCAN when voting
const vote: Vote = {
  id: "vote-1",
  assumptionId: "abc123",
  voterDid: "did:key:z6Mk...bob",
  value: "green",
  createdAt: Date.now(),
  signature: signVote(bobPrivateKey, ...),
  ucan: encodeUCAN(ucan),  // Proof that Bob can vote (Alice authorized him)
};
```

**Validation**:
```typescript
function verifyVote(vote: Vote, doc: OpinionGraphDoc): boolean {
  // 1. Verify vote signature
  if (!verifySignature(vote.voterDid, voteMessage(vote), vote.signature)) {
    return false;
  }

  // 2. If UCAN present, verify delegation chain
  if (vote.ucan) {
    const ucan = decodeUCAN(vote.ucan);
    return verifyUCANChain(ucan, {
      resource: `narrative:assumption:${vote.assumptionId}`,
      capability: "vote",
      invoker: vote.voterDid,
    });
  }

  // 3. Default: allow if voting on behalf of self
  return true;
}
```

**UCAN Use Cases for Narrative**:

1. **Bot Delegation**: Alice gives a bot `did:key:bot` permission to create assumptions on her behalf
2. **Team Voting**: Team lead creates UCAN allowing team members to vote on team assumptions
3. **Read-only Sharing**: Document owner gives observers `read` capability (future: encrypted data)
4. **Moderation**: Document creator delegates `delete` capability to moderators

**Pros**:
- Flexible permission model
- Delegation without trust (cryptographically verifiable)
- Fine-grained capabilities (`vote` vs `edit` vs `delete`)
- Future-proof for advanced use cases

**Cons**:
- More complex to implement
- Need UCAN library (`@ucanto/ucanto` or `ucan-ts`)
- Larger data footprint (UCAN tokens in each action)
- UX complexity (users need to understand delegation)

---

## Part 3: DID Method Selection

### Option 1: `did:key` (Recommended for MVP)

**Format**: `did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK`

**Derivation**:
```typescript
import { generateKeyPair } from '@noble/ed25519';
import { base58btc } from 'multiformats/bases/base58';

const privateKey = generateKeyPair();
const publicKey = getPublicKey(privateKey);

// Multicodec prefix for Ed25519: 0xed (237)
const multicodecPubKey = new Uint8Array([0xed, 0x01, ...publicKey]);
const did = `did:key:${base58btc.encode(multicodecPubKey)}`;
```

**Storage**:
```typescript
localStorage.setItem('narrativeIdentity', JSON.stringify({
  did: 'did:key:z6Mk...',
  privateKey: base64Encode(privateKey),  // or use Web Crypto non-extractable
  displayName: 'Alice',
}));
```

**Pros**:
- Offline (no server needed)
- Simple (DID = hash of public key)
- Self-verifying
- Standard (W3C DID spec)

**Cons**:
- No key rotation (DID changes if key changes)
- No recovery mechanism built-in
- Private key in localStorage (XSS risk)

### Option 2: `did:web` (Future)

**Format**: `did:web:narrative.app:users:alice`

**Resolution**: Fetches `https://narrative.app/users/alice/did.json`

**Pros**:
- Key rotation supported (update DID document)
- Recovery via server
- Human-readable

**Cons**:
- Requires server
- Centralization point
- Not offline-first

### Option 3: `did:pkh` (Blockchain)

**Format**: `did:pkh:eip155:1:0x1234...` (Ethereum address)

**Pros**:
- Leverage existing wallets (MetaMask)
- Key rotation via smart contracts
- Familiar to crypto users

**Cons**:
- Requires wallet extension
- Transaction costs (for rotation)
- Not privacy-friendly (public blockchain)

**Recommendation**: Start with `did:key`, design for migration to `did:web` or multi-method support.

---

## Part 4: Key Recovery & Loss Prevention

### Problem

If user loses private key:
- Loses access to identity
- Can't prove authorship of past actions
- Must create new identity (lose reputation/history)

### Solution Strategies

#### 1. **Email-based Encrypted Backup**

```typescript
// During key generation
const encrypted = await encryptPrivateKey(privateKey, userPassword);
await sendEmail(userEmail, {
  subject: 'Narrative Identity Backup',
  body: `Your encrypted key: ${encrypted}`,
});

// Recovery
const encrypted = promptUserForBackup();
const privateKey = await decryptPrivateKey(encrypted, userPassword);
```

**Pros**: Simple, familiar UX
**Cons**: Centralized (email provider), password weakness

#### 2. **Social Recovery (Shamir Secret Sharing)**

Split private key into N shares, require M to recover:

```typescript
const shares = shamirSplit(privateKey, { n: 5, m: 3 });
// Give shares to: Alice's phone, Bob's device, Carol's device, cold storage, email

// Recovery: Collect 3 shares
const privateKey = shamirRecombine([share1, share3, share5]);
```

**Pros**: Decentralized, no single point of failure
**Cons**: Complex UX, need trusted friends

#### 3. **Key Rotation with Recovery Key**

Store a **recovery DID** that can certify new keys:

```typescript
const mainKey = generateKeyPair();
const recoveryKey = generateKeyPair(); // stored offline

// In doc:
doc.identity = {
  did: keyToDid(mainKey.publicKey),
  recoveryDid: keyToDid(recoveryKey.publicKey),
};

// If main key lost:
const newKey = generateKeyPair();
const cert = signRecoveryCertificate(recoveryKey, {
  oldDid: keyToDid(mainKey.publicKey),
  newDid: keyToDid(newKey.publicKey),
  timestamp: Date.now(),
});

// Add to doc:
doc.keyRotations.push(cert);
```

**Pros**: Cryptographically verifiable rotation
**Cons**: Must secure recovery key separately

#### 4. **Hardware Security Keys (WebAuthn)**

Use U2F/FIDO2 for key storage:

```typescript
// Store private key in hardware token (non-extractable)
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: new Uint8Array(32),
    rp: { name: "Narrative" },
    user: { id: userId, name: "alice", displayName: "Alice" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
  }
});

// Sign with hardware key
const signature = await navigator.credentials.get({...});
```

**Pros**: Best security (no extraction possible)
**Cons**: Requires hardware, limited browser support

**Recommendation**:
1. MVP: Email backup + clear warnings
2. V2: Social recovery option
3. V3: Hardware key support

---

## Part 5: Implementation Roadmap

### Phase 1: Real DIDs (No Signatures Yet)

**Goal**: Replace fake DIDs with real `did:key`

**Changes**:
- Use `@noble/ed25519` for key generation
- Store keypair in localStorage
- Derive DID from public key
- NO signature verification yet (backward compatible)

**Schema** (no changes):
```typescript
interface UserIdentity {
  did: string;  // Now real did:key
  displayName?: string;
}
```

### Phase 2: Optional Signatures

**Goal**: Add signatures, validate on read, but don't enforce

**Changes**:
- Add `signature?: string` to Vote, Edit, Assumption
- Sign all new actions
- Validate signatures on read (warn if invalid)
- Display "verified" badge in UI

**Schema**:
```typescript
interface Vote {
  // ... existing
  signature?: string;
}
```

**Migration**: Old unsigned votes remain valid (backward compatible)

### Phase 3: Enforce Signatures

**Goal**: Ignore unsigned actions

**Changes**:
- Filter out invalid/unsigned entities in hooks
- Display warning if document contains invalid data

**Schema**: Same as Phase 2

### Phase 4: UCAN Support (Optional)

**Goal**: Enable delegation

**Changes**:
- Add `ucan?: string` to Vote, Edit, etc.
- Implement UCAN verification
- UI for creating/accepting delegations

**Schema**:
```typescript
interface Vote {
  // ... existing
  signature: string;
  ucan?: string;  // Base64-encoded UCAN token
}
```

---

## Part 6: Recommended Approach

### Architecture Decision

**Start Simple, Enable Complex**:

1. **Phase 1-3**: Use Strategy A (Signature-per-Entity)
   - Simple to implement
   - Covers 80% of use cases
   - No UCAN complexity

2. **Phase 4+**: Add UCAN support (opt-in)
   - Keep simple signatures as default
   - UCAN only for advanced delegation use cases
   - Graceful degradation (clients without UCAN support ignore delegation)

### Why This Approach?

- **MVP-friendly**: Get real DIDs fast without over-engineering
- **User-friendly**: Most users don't need delegation
- **Future-proof**: UCAN can be added later without breaking changes
- **Performant**: Simple signatures are faster to verify

### Key Libraries

```json
{
  "dependencies": {
    "@noble/ed25519": "^2.0.0",         // Key generation & signing
    "multiformats": "^13.0.0",          // DID encoding (base58btc)
    "@ucanto/ucanto": "^9.0.0"          // Phase 4: UCAN support
  }
}
```

---

## Part 7: Open Questions

1. **Signature Format**:
   - Detached signatures (just the signature bytes)?
   - JWS (JSON Web Signature, includes header/payload)?
   - Recommendation: JWS for compatibility with UCAN

2. **Validation Performance**:
   - Verify on every render?
   - Cache validation results?
   - Recommendation: useMemo with doc hash as key

3. **Invalid Data Handling**:
   - Silently filter out?
   - Show warning banner?
   - Allow user to "trust anyway"?
   - Recommendation: Filter + warning (developer console)

4. **Migration Path**:
   - Force all users to new identity?
   - Keep old fake-DIDs as "legacy" mode?
   - Recommendation: One-time migration prompt on app load

5. **Testing Strategy**:
   - Unit tests for signature verification
   - Integration tests for CRDT + signatures
   - E2E tests for multi-peer scenarios with malicious actors

---

## Next Steps

1. **Review & Discuss**: Get feedback on this concept
2. **Decide on Phases**: Which phases to implement now?
3. **Prototype**: Small spike with @noble/ed25519 + signature verification
4. **Update Schema**: Add optional signature fields
5. **Implement Phase 1**: Real DIDs without signatures
6. **Implement Phase 2**: Optional signatures with validation
7. **Security Audit**: Review implementation before enforcing signatures

---

## References

- **UCAN Spec**: https://github.com/ucan-wg/spec
- **Storacha UCAN Docs**: https://docs.storacha.network/concepts/ucan/
- **DID Core Spec**: https://www.w3.org/TR/did-core/
- **did:key Method**: https://w3c-ccg.github.io/did-method-key/
- **Automerge Docs**: https://automerge.org/docs/
- **@noble/ed25519**: https://github.com/paulmillr/noble-ed25519

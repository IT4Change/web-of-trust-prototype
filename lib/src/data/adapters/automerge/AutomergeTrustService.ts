/**
 * Automerge Trust Service
 *
 * TrustService-Implementierung für Automerge UserDocuments.
 * Verwaltet bidirektionales Trust (trustGiven/trustReceived).
 */

import type { DocHandle, Repo, AutomergeUrl } from '@automerge/automerge-repo';
import { generateId } from '../../../schema/document';
import { signEntity, verifyEntitySignature } from '../../../utils/signature';
import type { UserDocument, TrustAttestation as LegacyTrustAttestation } from '../../../schema';
import type {
  TrustAttestation,
  TrustLevel,
  TrustService,
} from '../../types';

/**
 * TrustService für Automerge UserDocuments
 */
export class AutomergeTrustService implements TrustService {
  private userDocHandle: DocHandle<UserDocument> | null = null;
  private currentUserId: string;
  private privateKey?: string;
  private repo?: Repo;
  private listeners: Set<(trust: TrustAttestation[]) => void> = new Set();
  private changeHandler: (() => void) | null = null;

  constructor(
    currentUserId: string,
    options?: {
      userDocHandle?: DocHandle<UserDocument>;
      privateKey?: string;
      repo?: Repo;
    }
  ) {
    this.currentUserId = currentUserId;
    this.privateKey = options?.privateKey;
    this.repo = options?.repo;

    if (options?.userDocHandle) {
      this.setUserDocHandle(options.userDocHandle);
    }
  }

  /**
   * Set or update the UserDocument handle
   */
  setUserDocHandle(handle: DocHandle<UserDocument>): void {
    // Cleanup old subscription
    if (this.changeHandler && this.userDocHandle) {
      this.userDocHandle.off('change', this.changeHandler);
    }

    this.userDocHandle = handle;
    this.setupSubscription();
  }

  private setupSubscription(): void {
    if (!this.userDocHandle) return;

    this.changeHandler = () => this.notifyListeners();
    this.userDocHandle.on('change', this.changeHandler);
  }

  destroy(): void {
    if (this.changeHandler && this.userDocHandle) {
      this.userDocHandle.off('change', this.changeHandler);
      this.changeHandler = null;
    }
    this.listeners.clear();
  }

  getTrustGiven(): TrustAttestation[] {
    const doc = this.userDocHandle?.docSync();
    if (!doc?.trustGiven) return [];

    return Object.values(doc.trustGiven).map((legacy) => this.mapLegacyAttestation(legacy));
  }

  getTrustReceived(): TrustAttestation[] {
    const doc = this.userDocHandle?.docSync();
    if (!doc?.trustReceived) return [];

    return Object.values(doc.trustReceived).map((legacy) => this.mapLegacyAttestation(legacy));
  }

  /**
   * Map legacy attestation format to new format
   */
  private mapLegacyAttestation(legacy: LegacyTrustAttestation): TrustAttestation {
    // Legacy format uses trusterDid/trusteeDid
    return {
      id: legacy.id || generateId('trust'),
      trustorId: legacy.trusterDid || '',
      trusteeId: legacy.trusteeDid || '',
      level: mapLegacyLevel(legacy.level || 'verified'),
      createdAt: legacy.createdAt || Date.now(),
      signature: legacy.signature,
    };
  }

  getTrustLevel(identityId: string): TrustLevel | null {
    const doc = this.userDocHandle?.docSync();
    const attestation = doc?.trustGiven?.[identityId];
    if (!attestation) return null;

    return mapLegacyLevel(attestation.level || 'verified');
  }

  async setTrust(trusteeId: string, level: TrustLevel): Promise<void> {
    if (!this.userDocHandle) {
      throw new Error('UserDocument not available');
    }

    const now = Date.now();
    const attestationId = generateId('trust');

    // Prepare data for signing
    const toSign = {
      id: attestationId,
      trusterDid: this.currentUserId,
      trusteeDid: trusteeId,
      level: mapToLegacyLevel(level),
      createdAt: now,
    };

    let signature: string | undefined;

    // Sign the attestation if we have a private key
    if (this.privateKey) {
      try {
        signature = await signEntity(toSign, this.privateKey);
      } catch (e) {
        console.warn('Failed to sign trust attestation:', e);
      }
    }

    // Write to our trustGiven
    this.userDocHandle.change((d) => {
      if (!d.trustGiven) {
        d.trustGiven = {};
      }
      // Use legacy format for backwards compatibility
      d.trustGiven[trusteeId] = {
        id: attestationId,
        trusterDid: this.currentUserId,
        trusteeDid: trusteeId,
        level: mapToLegacyLevel(level),
        createdAt: now,
        updatedAt: now,
        signature,
      };
      d.lastModified = now;
    });
  }

  async revokeTrust(trusteeId: string): Promise<void> {
    if (!this.userDocHandle) {
      throw new Error('UserDocument not available');
    }

    this.userDocHandle.change((d) => {
      if (d.trustGiven?.[trusteeId]) {
        delete d.trustGiven[trusteeId];
        d.lastModified = Date.now();
      }
    });
  }

  subscribe(callback: (trust: TrustAttestation[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const all = [...this.getTrustGiven(), ...this.getTrustReceived()];
    this.listeners.forEach((cb) => cb(all));
  }

  // === Advanced Trust Operations ===

  /**
   * Verify a trust attestation's signature
   */
  async verifyAttestation(
    attestation: TrustAttestation,
    publicKeyBase64: string
  ): Promise<boolean> {
    if (!attestation.signature) return false;

    try {
      const toVerify = {
        id: attestation.id,
        trusterDid: attestation.trustorId,
        trusteeDid: attestation.trusteeId,
        level: mapToLegacyLevel(attestation.level),
        createdAt: attestation.createdAt,
      };
      const result = await verifyEntitySignature(toVerify, publicKeyBase64);
      // verifyEntitySignature returns { valid: boolean } or throws
      return typeof result === 'object' && 'valid' in result ? result.valid : !!result;
    } catch {
      return false;
    }
  }

  /**
   * Propagate trust to recipient's UserDocument
   */
  async propagateTrustToRecipient(
    recipientDocUrl: string,
    attestation: TrustAttestation
  ): Promise<void> {
    if (!this.repo) {
      throw new Error('Repo not available for trust propagation');
    }

    try {
      const recipientHandle = await this.repo.find<UserDocument>(recipientDocUrl as AutomergeUrl);

      recipientHandle.change((d) => {
        if (!d.trustReceived) {
          d.trustReceived = {};
        }
        d.trustReceived[attestation.trustorId] = {
          id: attestation.id,
          trusterDid: attestation.trustorId,
          trusteeDid: attestation.trusteeId,
          level: mapToLegacyLevel(attestation.level),
          createdAt: attestation.createdAt,
          updatedAt: Date.now(),
          signature: attestation.signature,
        };
        d.lastModified = Date.now();
      });
    } catch (e) {
      console.warn('Failed to propagate trust to recipient:', e);
    }
  }
}

// === Helper Functions ===

function mapLegacyLevel(level: string): TrustLevel {
  switch (level) {
    case 'verified':
    case 'full':
      return 'full';
    case 'endorsed':
    case 'limited':
      return 'limited';
    case 'none':
      return 'none';
    default:
      return 'limited';
  }
}

function mapToLegacyLevel(level: TrustLevel): 'verified' | 'endorsed' {
  switch (level) {
    case 'full':
      return 'verified';
    case 'limited':
    case 'none':
    default:
      return 'endorsed';
  }
}

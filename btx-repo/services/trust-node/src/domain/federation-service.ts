import { FederationRepository } from '../adapter/db/repository';
import { PeerSyncRequest, PeerSyncEvent } from '../domain/federation';
import crypto from 'crypto';

/**
 * FederationService: Federation sync state machine
 * Handles peer node sync requests, audit chain verification, and Merkle root validation
 */
export class FederationService {
  constructor(
    private federationRepo: FederationRepository,
    private kmsVerify?: (signature: string, message: string, publicKeyPem: string) => Promise<boolean>
  ) {}

  /**
   * Handle incoming sync request from peer node
   * Implements state machine: pending → verified → update cursor OR failed
   */
  async syncFromPeer(request: PeerSyncRequest, peerPublicKeyPem?: string): Promise<PeerSyncEvent> {
    // Record the sync request
    const syncEvent = await this.federationRepo.recordPeerSync(request);

    try {
      // Verify Merkle root signature if provided
      if (request.signature && peerPublicKeyPem) {
        const isValid = await this.verifyMerkleRootSignature(
          request.merkleRootHash || '',
          request.signature,
          peerPublicKeyPem
        );
        if (!isValid) {
          await this.federationRepo.markPeerSyncFailed(syncEvent.id, 'Merkle root signature verification failed');
          return { ...syncEvent, status: 'failed' };
        }
      }

      // Verify audit chain
      if (request.merkleRootHash) {
        const chainValid = await this.verifyAuditChain(request.merkleRootHash);
        if (!chainValid) {
          await this.federationRepo.markPeerSyncFailed(syncEvent.id, 'Audit chain verification failed');
          return { ...syncEvent, status: 'failed' };
        }
      }

      // Update local sync cursor
      await this.federationRepo.updateSyncCursor(request.peerNodeId, request.cursor);
      await this.federationRepo.markPeerSyncVerified(syncEvent.id);

      return { ...syncEvent, status: 'verified' };
    } catch (err) {
      await this.federationRepo.markPeerSyncFailed(syncEvent.id, (err as Error).message);
      throw err;
    }
  }

  /**
   * Verify Merkle root signature from peer
   * Uses KMS adapter if available, otherwise stub verification
   */
  private async verifyMerkleRootSignature(
    merkleRootHash: string,
    signature: string,
    publicKeyPem: string
  ): Promise<boolean> {
    if (this.kmsVerify) {
      return this.kmsVerify(signature, merkleRootHash, publicKeyPem);
    }

    // Fallback: ed25519 verification (stub)
    try {
      const crypto = await import('crypto');
      const verifier = crypto.createVerify('sha256');
      verifier.update(merkleRootHash);
      return verifier.verify(publicKeyPem, signature, 'base64');
    } catch {
      return false;
    }
  }

  /**
   * Verify audit chain for continuity and integrity
   */
  private async verifyAuditChain(currentMerkleRoot: string): Promise<boolean> {
    // Stub: in production, this would:
    // 1. Fetch previous day's merkle root from federation peers
    // 2. Verify cryptographic hash chain
    // 3. Validate parent hashes from quorum
    // 4. Check timestamp ordering
    // For now, accept if signature verification passed
    return true;
  }

  /**
   * Get current federation state
   */
  async getState(nodeId: string) {
    return this.federationRepo.getState(nodeId);
  }

  /**
   * Get pending peer syncs
   */
  async getPendingSyncs() {
    return this.federationRepo.getPendingSyncs();
  }
}

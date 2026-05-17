import { FederationRepository } from '../adapter/db/repository';
import { PeerSyncRequest, PeerSyncEvent } from '../domain/federation';
/**
 * FederationService: Federation sync state machine
 * Handles peer node sync requests, audit chain verification, and Merkle root validation
 */
export declare class FederationService {
    private federationRepo;
    private kmsVerify?;
    constructor(federationRepo: FederationRepository, kmsVerify?: ((signature: string, message: string, publicKeyPem: string) => Promise<boolean>) | undefined);
    /**
     * Handle incoming sync request from peer node
     * Implements state machine: pending → verified → update cursor OR failed
     */
    syncFromPeer(request: PeerSyncRequest, peerPublicKeyPem?: string): Promise<PeerSyncEvent>;
    /**
     * Verify Merkle root signature from peer
     * Uses KMS adapter if available, otherwise stub verification
     */
    private verifyMerkleRootSignature;
    /**
     * Verify audit chain for continuity and integrity
     */
    private verifyAuditChain;
    /**
     * Get current federation state
     */
    getState(nodeId: string): Promise<any>;
    /**
     * Get pending peer syncs
     */
    getPendingSyncs(): Promise<PeerSyncEvent[]>;
}

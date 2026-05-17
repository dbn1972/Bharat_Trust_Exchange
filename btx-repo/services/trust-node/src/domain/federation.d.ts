/**
 * Federation domain model for trust-node
 */
export interface FederationState {
    nodeId: string;
    syncCursor: bigint;
    lastSyncAt?: Date;
    merkleRootVerifiedAt?: Date;
    status: 'active' | 'syncing' | 'paused';
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
export interface PeerSyncRequest {
    peerNodeId: string;
    cursor: bigint;
    merkleRootHash?: string;
    signature?: string;
}
export interface PeerSyncEvent {
    id: bigint;
    peerNodeId: string;
    cursor: bigint;
    merkleRootHash?: string;
    signature?: string;
    status: 'pending' | 'verified' | 'failed';
    errorMsg?: string;
    createdAt: Date;
    processedAt?: Date;
}
/**
 * Audit chain entry for verification
 */
export interface AuditChainEntry {
    index: bigint;
    eventHash: string;
    previousHash?: string;
    parentHashes: string[];
    verifiedAt?: Date;
    createdAt: Date;
}

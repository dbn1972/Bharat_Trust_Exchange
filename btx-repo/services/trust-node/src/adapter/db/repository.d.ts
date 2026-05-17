import { Pool } from 'pg';
import { FederationState, PeerSyncRequest, PeerSyncEvent } from '../domain/federation';
/**
 * FederationRepository: Data access layer for federation sync state
 */
export declare class FederationRepository {
    private pool;
    constructor(pool: Pool);
    initializeFederationState(nodeId: string): Promise<FederationState>;
    getState(nodeId: string): Promise<FederationState | null>;
    updateSyncCursor(nodeId: string, cursor: bigint): Promise<void>;
    recordPeerSync(request: PeerSyncRequest): Promise<PeerSyncEvent>;
    markPeerSyncVerified(syncId: bigint): Promise<void>;
    markPeerSyncFailed(syncId: bigint, error: string): Promise<void>;
    getPendingSyncs(limit?: number): Promise<PeerSyncEvent[]>;
    private mapToFederationState;
    private mapToPeerSyncEvent;
}

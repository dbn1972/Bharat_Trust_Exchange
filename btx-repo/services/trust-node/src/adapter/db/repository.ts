import { Pool } from 'pg';
import { FederationState, PeerSyncRequest, PeerSyncEvent } from '../domain/federation';
import crypto from 'crypto';

/**
 * FederationRepository: Data access layer for federation sync state
 */
export class FederationRepository {
  constructor(private pool: Pool) {}

  async initializeFederationState(nodeId: string): Promise<FederationState> {
    const result = await this.pool.query(
      `INSERT INTO federation_state (node_id, sync_cursor, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (node_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [nodeId, 0, 'active']
    );
    return this.mapToFederationState(result.rows[0]);
  }

  async getState(nodeId: string): Promise<FederationState | null> {
    const result = await this.pool.query(
      'SELECT * FROM federation_state WHERE node_id = $1',
      [nodeId]
    );
    return result.rows.length > 0 ? this.mapToFederationState(result.rows[0]) : null;
  }

  async updateSyncCursor(nodeId: string, cursor: bigint): Promise<void> {
    await this.pool.query(
      `UPDATE federation_state 
       SET sync_cursor = $2, last_sync_at = NOW(), updated_at = NOW()
       WHERE node_id = $1`,
      [nodeId, cursor]
    );
  }

  async recordPeerSync(request: PeerSyncRequest): Promise<PeerSyncEvent> {
    const result = await this.pool.query(
      `INSERT INTO peer_syncs (peer_node_id, cursor, merkle_root_hash, signature, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [request.peerNodeId, request.cursor, request.merkleRootHash || null, request.signature || null, 'pending']
    );
    return this.mapToPeerSyncEvent(result.rows[0]);
  }

  async markPeerSyncVerified(syncId: bigint): Promise<void> {
    await this.pool.query(
      `UPDATE peer_syncs 
       SET status = $2, processed_at = NOW()
       WHERE id = $1`,
      [syncId, 'verified']
    );
  }

  async markPeerSyncFailed(syncId: bigint, error: string): Promise<void> {
    await this.pool.query(
      `UPDATE peer_syncs 
       SET status = $2, error_msg = $3, processed_at = NOW()
       WHERE id = $1`,
      [syncId, 'failed', error]
    );
  }

  async getPendingSyncs(limit: number = 10): Promise<PeerSyncEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM peer_syncs 
       WHERE status = $1 
       ORDER BY created_at ASC 
       LIMIT $2`,
      ['pending', limit]
    );
    return result.rows.map(r => this.mapToPeerSyncEvent(r));
  }

  private mapToFederationState(row: any): FederationState {
    return {
      nodeId: row.node_id,
      syncCursor: BigInt(row.sync_cursor),
      lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
      merkleRootVerifiedAt: row.merkle_root_verified_at ? new Date(row.merkle_root_verified_at) : undefined,
      status: row.status,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapToPeerSyncEvent(row: any): PeerSyncEvent {
    return {
      id: BigInt(row.id),
      peerNodeId: row.peer_node_id,
      cursor: BigInt(row.cursor),
      merkleRootHash: row.merkle_root_hash,
      signature: row.signature,
      status: row.status,
      errorMsg: row.error_msg,
      createdAt: new Date(row.created_at),
      processedAt: row.processed_at ? new Date(row.processed_at) : undefined
    };
  }
}

import { Pool } from 'pg';
import { TrustNode, TrustNodeRegistration } from '../domain/trust-node';
/**
 * RegistryRepository: Data access layer for trust node directory
 */
export declare class RegistryRepository {
    private pool;
    constructor(pool: Pool);
    register(registration: TrustNodeRegistration): Promise<TrustNode>;
    getById(nodeId: string): Promise<TrustNode | null>;
    list(status?: string, limit?: number): Promise<TrustNode[]>;
    updateLastSeen(nodeId: string): Promise<void>;
    setStatus(nodeId: string, status: string): Promise<TrustNode>;
    private mapToTrustNode;
}

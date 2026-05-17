import { Pool } from 'pg';
import { Consent, ConsentStatus, ConsentGrant, AuditEvent, OutboxEvent } from '../domain/consent';
/**
 * ConsentsRepository: Data access layer for consent lifecycle
 */
export declare class ConsentsRepository {
    private pool;
    constructor(pool: Pool);
    create(grant: ConsentGrant): Promise<Consent>;
    getById(consentId: string): Promise<Consent | null>;
    updateStatus(consentId: string, status: ConsentStatus, revokedAt?: Date): Promise<Consent>;
    listByFromNode(nodeId: string): Promise<Consent[]>;
    listByToNode(nodeId: string): Promise<Consent[]>;
    private mapToConsent;
}
/**
 * AuditRepository: Append-only audit event persistence
 */
export declare class AuditRepository {
    private pool;
    constructor(pool: Pool);
    /**
     * Append audit event and outbox row in same transaction (ADR-0021)
     */
    appendInTransaction(auditEvent: Omit<AuditEvent, 'id' | 'createdAt'>, outboxEvent: Omit<OutboxEvent, 'id' | 'createdAt'>): Promise<{
        auditId: bigint;
        outboxId: bigint;
    }>;
    getById(auditId: bigint): Promise<AuditEvent | null>;
    listByConsent(consentId: string): Promise<AuditEvent[]>;
    getMerkleRoot(day: Date): Promise<{
        rootHash: string;
        signature: string;
    } | null>;
    private mapToAuditEvent;
}
/**
 * OutboxRepository: Transactional outbox for Kafka publishing
 */
export declare class OutboxRepository {
    private pool;
    constructor(pool: Pool);
    getPending(limit?: number): Promise<OutboxEvent[]>;
    markPublished(outboxId: bigint): Promise<void>;
    markFailed(outboxId: bigint, error: string): Promise<void>;
    private mapToOutboxEvent;
}

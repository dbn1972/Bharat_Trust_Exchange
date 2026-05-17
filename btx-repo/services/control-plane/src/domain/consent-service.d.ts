import { Consent, ConsentGrant, ConsentRevoke, AuditEvent } from '../domain/consent';
import { ConsentsRepository, AuditRepository, OutboxRepository } from '../adapter/db/repository';
import type { ObjectStoreAdapter } from '@btx/adapter-objectstore';
/**
 * ConsentService: Business logic for consent lifecycle
 * Implements policy evaluation, audit trail, and federation propagation
 */
export declare class ConsentService {
    private consentsRepo;
    private auditRepo;
    private outboxRepo;
    private policyEvaluator?;
    private objectStore?;
    constructor(consentsRepo: ConsentsRepository, auditRepo: AuditRepository, outboxRepo: OutboxRepository, policyEvaluator?: ((ruleId: string, context: Record<string, unknown>) => Promise<boolean>) | undefined, objectStore?: ObjectStoreAdapter);
    /** Archive a single audit event to object store (fire-and-forget; never fails the caller). */
    private archiveAuditEvent;
    /**
     * Grant new consent with policy evaluation
     */
    grant(grant: ConsentGrant, actorNodeId: string): Promise<Consent>;
    /**
     * Revoke consent with cascade option for federation
     */
    revoke(revoke: ConsentRevoke, actorNodeId: string): Promise<Consent>;
    /**
     * Query consent with authorization check
     */
    query(consentId: string, requestorNodeId: string): Promise<Consent>;
    /**
     * Get audit trail for a consent
     */
    getAuditTrail(consentId: string): Promise<AuditEvent[]>;
    /**
     * Compute daily Merkle root for audit chain commitment
     */
    computeDailyMerkleRoot(day: Date): Promise<string>;
}

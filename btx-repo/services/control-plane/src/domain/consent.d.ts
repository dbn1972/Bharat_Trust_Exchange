/**
 * Consent domain model for BTX control-plane
 * Represents a trust relationship between two nodes
 */
export declare enum ConsentStatus {
    PENDING = "pending",
    ACTIVE = "active",
    REVOKED = "revoked",
    EXPIRED = "expired"
}
export interface Obligations {
    audit?: boolean;
    retentionDays?: number;
    encryptionRequired?: boolean;
    [key: string]: unknown;
}
export interface Consent {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    subjectRef: string;
    purpose: string;
    status: ConsentStatus;
    obligations: Obligations;
    createdAt: Date;
    updatedAt: Date;
    revokedAt?: Date;
    expiresAt?: Date;
}
export interface ConsentGrant {
    fromNodeId: string;
    toNodeId: string;
    subjectRef: string;
    purpose: string;
    obligations?: Obligations;
    expiresAt?: Date;
}
export interface ConsentRevoke {
    consentId: string;
    reason: string;
    cascadeToFederation?: boolean;
}
/**
 * Audit event for immutable audit trail
 */
export declare enum AuditEventType {
    CONSENT_GRANTED = "consent.granted",
    CONSENT_REVOKED = "consent.revoked",
    CONSENT_QUERIED = "consent.queried",
    CONSENT_EXPIRED = "consent.expired",
    FEDERATION_SYNC = "federation.sync",
    MERKLE_ROOT_SIGNED = "merkle_root.signed"
}
export interface AuditEvent {
    id: bigint;
    consentId?: string;
    eventType: AuditEventType;
    actorNodeId: string;
    subjectRef?: string;
    details: Record<string, unknown>;
    merkleIndex?: bigint;
    createdAt: Date;
}
/**
 * Transactional outbox event (ADR-0021)
 */
export interface OutboxEvent {
    id: bigint;
    eventType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
    publishedAt?: Date;
    createdAt: Date;
}
/**
 * Daily Merkle root for audit chain commitment
 */
export interface MerkleRoot {
    day: Date;
    rootHash: string;
    signature: string;
    eventCount: bigint;
    signedAt: Date;
}

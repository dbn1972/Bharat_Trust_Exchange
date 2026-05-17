export { auditAppendedSchema } from './schemas.js';
export interface AuditEvent {
    event_id: string;
    event_type: string;
    schema_version: string;
    occurred_at: string;
    actor: {
        type: string;
        id: string;
    };
    subject?: {
        type: string;
        id: string;
    };
    trace_id?: string;
    payload: Record<string, unknown>;
}
export interface TxLike {
    query: (sql: string, params?: unknown[]) => Promise<{
        rowCount: number;
    }>;
}
export interface OutboxRow {
    topic: string;
    key: string;
    payload: string;
    headers?: Record<string, string>;
}
/**
 * Append immutable audit row and outbox row in the SAME transaction.
 * This is the only allowed DB↔Kafka boundary in BTX (ADR-0021).
 */
export declare function appendInTx(tx: TxLike, event: AuditEvent): Promise<void>;
export declare function canonicalEventHash(event: AuditEvent): string;
export declare function merkleRoot(hashes: string[]): string;
export interface AuditPublisher {
    publish(topic: string, key: string, payload: string, headers?: Record<string, string>): Promise<void>;
}
export declare class KafkaAuditPublisher implements AuditPublisher {
    private readonly producer;
    constructor(producer: {
        send: (m: {
            topic: string;
            messages: Array<{
                key: string;
                value: string;
                headers?: Record<string, string>;
            }>;
        }) => Promise<void>;
    });
    publish(topic: string, key: string, payload: string, headers?: Record<string, string>): Promise<void>;
}
export declare function runDailyMerkleJob(args: {
    loadDayEvents: (dayIso: string) => Promise<AuditEvent[]>;
    sign: (message: Uint8Array) => Promise<Uint8Array>;
    persist: (doc: {
        day: string;
        root: string;
        signatureB64: string;
        algorithm: string;
    }) => Promise<void>;
    dayIso: string;
}): Promise<void>;

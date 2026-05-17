import { createHash } from 'node:crypto';
export { auditAppendedSchema } from './schemas.js';
/**
 * Append immutable audit row and outbox row in the SAME transaction.
 * This is the only allowed DB↔Kafka boundary in BTX (ADR-0021).
 */
export async function appendInTx(tx, event) {
    await tx.query(`INSERT INTO audit_events(
      event_id, event_type, schema_version, occurred_at, actor, subject, trace_id, payload
    ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::jsonb)`, [
        event.event_id,
        event.event_type,
        event.schema_version,
        event.occurred_at,
        JSON.stringify(event.actor),
        JSON.stringify(event.subject ?? null),
        event.trace_id ?? null,
        JSON.stringify(event.payload)
    ]);
    const row = {
        topic: 'audit.appended',
        key: event.event_id,
        payload: JSON.stringify(event),
        headers: {
            schema_version: event.schema_version,
            event_type: event.event_type,
            trace_id: event.trace_id ?? ''
        }
    };
    await tx.query(`INSERT INTO outbox(topic, key, payload, headers, created_at)
     VALUES ($1,$2,$3::jsonb,$4::jsonb,now())`, [row.topic, row.key, row.payload, JSON.stringify(row.headers ?? {})]);
}
export function canonicalEventHash(event) {
    return createHash('sha256').update(JSON.stringify(event)).digest('hex');
}
export function merkleRoot(hashes) {
    if (hashes.length === 0)
        return createHash('sha256').update('').digest('hex');
    let level = hashes.map(h => Buffer.from(h, 'hex'));
    while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = level[i + 1] ?? left;
            next.push(createHash('sha256').update(Buffer.concat([left, right])).digest());
        }
        level = next;
    }
    return level[0].toString('hex');
}
export class KafkaAuditPublisher {
    producer;
    constructor(producer) {
        this.producer = producer;
    }
    async publish(topic, key, payload, headers) {
        await this.producer.send({ topic, messages: [{ key, value: payload, headers }] });
    }
}
export async function runDailyMerkleJob(args) {
    const events = await args.loadDayEvents(args.dayIso);
    const root = merkleRoot(events.map(canonicalEventHash));
    const sig = await args.sign(Buffer.from(root, 'utf8'));
    await args.persist({
        day: args.dayIso,
        root,
        signatureB64: Buffer.from(sig).toString('base64'),
        algorithm: 'ed25519'
    });
}
//# sourceMappingURL=index.js.map
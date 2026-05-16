import { createHash } from 'node:crypto';

export interface AuditEvent {
  event_id: string;
  event_type: string;
  schema_version: string;
  occurred_at: string;
  actor: { type: string; id: string };
  subject?: { type: string; id: string };
  trace_id?: string;
  payload: Record<string, unknown>;
}

export interface TxLike {
  query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number }>;
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
export async function appendInTx(tx: TxLike, event: AuditEvent): Promise<void> {
  await tx.query(
    `INSERT INTO audit_events(
      event_id, event_type, schema_version, occurred_at, actor, subject, trace_id, payload
    ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::jsonb)`,
    [
      event.event_id,
      event.event_type,
      event.schema_version,
      event.occurred_at,
      JSON.stringify(event.actor),
      JSON.stringify(event.subject ?? null),
      event.trace_id ?? null,
      JSON.stringify(event.payload)
    ]
  );

  const row: OutboxRow = {
    topic: 'audit.appended',
    key: event.event_id,
    payload: JSON.stringify(event),
    headers: {
      schema_version: event.schema_version,
      event_type: event.event_type,
      trace_id: event.trace_id ?? ''
    }
  };

  await tx.query(
    `INSERT INTO outbox(topic, key, payload, headers, created_at)
     VALUES ($1,$2,$3::jsonb,$4::jsonb,now())`,
    [row.topic, row.key, row.payload, JSON.stringify(row.headers ?? {})]
  );
}

export function canonicalEventHash(event: AuditEvent): string {
  return createHash('sha256').update(JSON.stringify(event)).digest('hex');
}

export function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return createHash('sha256').update('').digest('hex');
  let level = hashes.map(h => Buffer.from(h, 'hex'));
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      next.push(createHash('sha256').update(Buffer.concat([left, right])).digest());
    }
    level = next;
  }
  return level[0].toString('hex');
}

export interface AuditPublisher {
  publish(topic: string, key: string, payload: string, headers?: Record<string, string>): Promise<void>;
}

export class KafkaAuditPublisher implements AuditPublisher {
  constructor(private readonly producer: { send: (m: { topic: string; messages: Array<{ key: string; value: string; headers?: Record<string, string> }> }) => Promise<void> }) {}
  async publish(topic: string, key: string, payload: string, headers?: Record<string, string>): Promise<void> {
    await this.producer.send({ topic, messages: [{ key, value: payload, headers }] });
  }
}

export async function runDailyMerkleJob(args: {
  loadDayEvents: (dayIso: string) => Promise<AuditEvent[]>;
  sign: (message: Uint8Array) => Promise<Uint8Array>;
  persist: (doc: { day: string; root: string; signatureB64: string; algorithm: string }) => Promise<void>;
  dayIso: string;
}): Promise<void> {
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

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: 'EX', ttlSec?: number): Promise<unknown>;
}

export interface IdempotencyPluginOptions {
  redis: RedisLike;
  ttlSec?: number;
  keyPrefix?: string;
}

type ReplayValue = {
  statusCode: number;
  headers: Record<string, string>;
  payload: string;
};

const plugin: FastifyPluginAsync<IdempotencyPluginOptions> = async (app, opts) => {
  const ttl = opts.ttlSec ?? 86400;
  const prefix = opts.keyPrefix ?? 'idem:';

  app.addHook('preHandler', async (req, reply) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
    const idem = req.headers['idempotency-key'];
    if (!idem || Array.isArray(idem)) return;

    const storageKey = prefix + req.method + ':' + req.url + ':' + idem;
    const cached = await opts.redis.get(storageKey);
    if (!cached) {
      (req as any).__idemStorageKey = storageKey;
      return;
    }

    const replay = JSON.parse(cached) as ReplayValue;
    reply.code(replay.statusCode);
    for (const [k, v] of Object.entries(replay.headers ?? {})) {
      if (k.toLowerCase() === 'content-length') continue;
      reply.header(k, v);
    }
    reply.header('x-idempotency-replayed', 'true');
    reply.send(replay.payload);
  });

  app.addHook('onSend', async (req, reply, payload) => {
    const storageKey = (req as any).__idemStorageKey as string | undefined;
    if (!storageKey) return payload;

    const record: ReplayValue = {
      statusCode: reply.statusCode,
      headers: Object.fromEntries(Object.entries(reply.getHeaders()).map(([k, v]) => [k, String(v)])),
      payload: typeof payload === 'string' ? payload : Buffer.isBuffer(payload) ? payload.toString('utf8') : JSON.stringify(payload)
    };
    await opts.redis.set(storageKey, JSON.stringify(record), 'EX', ttl);
    return payload;
  });
};

export const idempotencyPlugin = fp(plugin, { name: '@btx/idempotency', fastify: '4.x' });
export default idempotencyPlugin;

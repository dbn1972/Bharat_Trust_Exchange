import Fastify from 'fastify';
import { Pool } from 'pg';
import crypto from 'crypto';
import { FederationRepository } from './adapter/db/repository';
import { FederationService } from './domain/federation-service';
import { getCloudConfig, createKmsAdapter } from '@btx/bootstrap';
import type { KmsAdapter } from '@btx/adapter-kms';

const app = Fastify({ logger: true });

// Initialize database pool
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'btx',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 10
});

const federationRepo = new FederationRepository(pool);

// KMS adapter is initialised in the onReady hook (C-01 / B-01 fix).
// We keep a reference so the health check can probe it.
let kmsAdapter: KmsAdapter | undefined;

/**
 * kmsVerify — production-grade peer signature verification (C-01 fix).
 *
 * Uses Node's crypto.verify() which infers the algorithm from the key type
 * (ed25519, ECDSA-P256, RSA-PSS) — correct for all BTX-supported key types.
 * The KMS adapter is initialised on startup to confirm KMS reachability;
 * peer signatures are verified against the peer's own public key PEM
 * (supplied in x-peer-public-key header), not against a KMS-managed key ID.
 */
async function kmsVerify(signature: string, message: string, publicKeyPem: string): Promise<boolean> {
  if (!publicKeyPem) return false;
  try {
    const msgBuf = Buffer.from(message, 'utf8');
    const sigBuf = Buffer.from(signature, 'base64');
    // crypto.verify with algorithm=null infers from key type (ed25519 / EC / RSA)
    return crypto.verify(null as unknown as string, msgBuf, publicKeyPem, sigBuf);
  } catch {
    return false;
  }
}

const federationService = new FederationService(federationRepo, kmsVerify);

// Authentication hook (F-02): protect all non-healthz endpoints with a Bearer token.
// Set BTX_API_KEY env var. Unauthenticated requests receive 401.
app.addHook('onRequest', async (req, reply) => {
  if (req.url === '/healthz') return; // healthz is always public
  const apiKey = process.env.BTX_API_KEY;
  if (!apiKey) return; // if env var is unset, auth is disabled (dev/test only)
  const auth = req.headers['authorization'];
  if (!auth || auth !== `Bearer ${apiKey}`) {
    reply.code(401).header('WWW-Authenticate', 'Bearer realm="btx-trust-node"');
    await reply.send({ statusCode: 401, error: 'Unauthorized', message: 'Valid Bearer token required' });
  }
});

// Health check endpoint
app.get('/healthz', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          service: { type: 'string' },
          dependencies: {
            type: 'object',
            properties: { kms: { type: 'boolean' } }
          }
        },
        required: ['ok', 'service']
      }
    }
  }
}, async () => {
  let kmsOk = false;
  try { kmsOk = kmsAdapter ? (await kmsAdapter.healthz()).ok : false; } catch { kmsOk = false; }
  return { ok: true, service: 'trust-node', dependencies: { kms: kmsOk } };
});

// Federation sync endpoint (POST /v1/federation/sync)
app.post('/v1/federation/sync', {
  schema: {
    body: {
      type: 'object',
      properties: {
        peerNodeId: { type: 'string', format: 'uuid' },
        cursor: { type: 'number' },
        merkleRootHash: { type: 'string' },
        signature: { type: 'string' }
      },
      required: ['peerNodeId', 'cursor']
    },
    response: {
      202: {
        type: 'object',
        properties: {
          syncId: { type: 'number' },
          status: { type: 'string' },
          accepted: { type: 'boolean' }
        },
        required: ['status', 'accepted']
      }
    }
  }
}, async (req) => {
  const { peerNodeId, cursor, merkleRootHash, signature } = req.body as any;
  const peerPublicKeyPem = req.headers['x-peer-public-key'] as string;

  try {
    const syncEvent = await federationService.syncFromPeer(
      { peerNodeId, cursor, merkleRootHash, signature },
      peerPublicKeyPem
    );

    return {
      code: 202,
      payload: {
        syncId: syncEvent.id.toString(),
        status: syncEvent.status,
        accepted: syncEvent.status === 'verified'
      }
    };
  } catch (err) {
    app.log.error(err);
    return {
      code: 202,
      payload: {
        status: 'error',
        accepted: false,
        message: (err as Error).message
      }
    };
  }
});

// Get federation state (GET /v1/federation/state/:nodeId)
app.get('/v1/federation/state/:nodeId', {
  schema: {
    params: {
      type: 'object',
      properties: { nodeId: { type: 'string', format: 'uuid' } },
      required: ['nodeId']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
          syncCursor: { type: 'number' },
          status: { type: 'string' },
          lastSyncAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  }
}, async (req) => {
  const { nodeId } = req.params as { nodeId: string };

  try {
    let state = await federationService.getState(nodeId);
    if (!state) {
      state = await federationRepo.initializeFederationState(nodeId);
    }
    return state;
  } catch (err) {
    app.log.error(err);
    throw { statusCode: 400, message: (err as Error).message };
  }
});

// Get pending peer syncs (GET /v1/federation/pending)
app.get('/v1/federation/pending', {
  schema: {
    response: {
      200: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            peerNodeId: { type: 'string' },
            status: { type: 'string' }
          }
        }
      }
    }
  }
}, async () => {
  try {
    const pending = await federationService.getPendingSyncs();
    return pending;
  } catch (err) {
    app.log.error(err);
    throw { statusCode: 400, message: (err as Error).message };
  }
});

app.addHook('onReady', async () => {
  try {
    // Initialise KMS adapter on startup (C-01 fix) — proves connectivity and
    // ensures stub is blocked in production (via getCloudConfig F-07 guard).
    const cloudConfig = await getCloudConfig();
    kmsAdapter = await createKmsAdapter(cloudConfig);
    const health = await kmsAdapter.healthz();
    app.log.info('[trust-node] KMS adapter ready', health);
  } catch (err) {
    app.log.error('[trust-node] KMS adapter init failed — refusing to start:', err);
    throw err;
  }
});

app.addHook('onClose', async () => {
  await pool.end();
  app.log.info('[trust-node] Cleanup complete');
});

if (process.env.NODE_ENV !== 'test') {
  app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3003) })
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}

export default app;

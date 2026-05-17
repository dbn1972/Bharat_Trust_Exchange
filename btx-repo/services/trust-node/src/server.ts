import Fastify from 'fastify';
import { Pool } from 'pg';
import { FederationRepository } from './adapter/db/repository';
import { FederationService } from './domain/federation-service';

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
const federationService = new FederationService(federationRepo);

// Health check endpoint
app.get('/healthz', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          service: { type: 'string' }
        },
        required: ['ok', 'service']
      }
    }
  }
}, async () => ({ ok: true, service: 'trust-node' }));

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

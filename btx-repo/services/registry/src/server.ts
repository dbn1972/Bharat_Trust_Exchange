import Fastify from 'fastify';
import { Pool } from 'pg';
import { RegistryRepository } from './adapter/db/repository';

const app = Fastify({ logger: true });

// Initialize database pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'btx',
  user: process.env.DB_USER || 'btx',
  password: process.env.DB_PASSWORD || 'btx',
  max: 10
});

const registryRepo = new RegistryRepository(pool);

// Authentication hook (F-02): protect all non-healthz endpoints with a Bearer token.
// Set BTX_API_KEY env var. Unauthenticated requests receive 401.
app.addHook('onRequest', async (req, reply) => {
  if (req.url === '/healthz') return; // healthz is always public
  const apiKey = process.env.BTX_API_KEY;
  if (!apiKey) return; // if env var is unset, auth is disabled (dev/test only)
  const auth = req.headers['authorization'];
  if (!auth || auth !== `Bearer ${apiKey}`) {
    reply.code(401).header('WWW-Authenticate', 'Bearer realm="btx-registry"');
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
          service: { type: 'string' }
        },
        required: ['ok', 'service']
      }
    }
  }
}, async () => ({ ok: true, service: 'registry' }));

// Register or update trust node (POST /v1/nodes)
app.post('/v1/nodes', {
  schema: {
    body: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        endpointUrl: { type: 'string', format: 'uri' },
        publicKeyPem: { type: 'string' },
        apiVersion: { type: 'string', default: 'v1' },
        capabilities: { type: 'array', items: { type: 'string' } },
        metadata: { type: 'object' }
      },
      required: ['nodeId', 'name', 'endpointUrl', 'publicKeyPem']
    },
    response: {
      201: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
          name: { type: 'string' },
          apiVersion: { type: 'string' },
          status: { type: 'string' }
        },
        required: ['nodeId', 'name', 'status']
      }
    }
  }
}, async (req, reply) => {
  const registration = req.body as any;
  try {
    const node = await registryRepo.register(registration);
    return reply.code(201).send(node);
  } catch (err) {
    app.log.error(err);
    throw { statusCode: 400, message: (err as Error).message };
  }
});

// Get trust node by ID (GET /v1/nodes/:nodeId)
app.get('/v1/nodes/:nodeId', {
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
          name: { type: 'string' },
          endpointUrl: { type: 'string' },
          apiVersion: { type: 'string' },
          status: { type: 'string' }
        },
        required: ['nodeId', 'name', 'endpointUrl', 'apiVersion', 'status']
      }
    }
  }
}, async (req) => {
  const { nodeId } = req.params as { nodeId: string };
  try {
    const node = await registryRepo.getById(nodeId);
    if (!node) {
      throw { statusCode: 404, message: 'Node not found' };
    }
    await registryRepo.updateLastSeen(nodeId);
    return node;
  } catch (err) {
    app.log.error(err);
    throw { statusCode: 404, message: (err as Error).message };
  }
});

// List active trust nodes (GET /v1/nodes)
app.get('/v1/nodes', {
  schema: {
    querystring: {
      type: 'object',
      properties: {
        status: { type: 'string', default: 'active' },
        limit: { type: 'number', default: 100 }
      }
    },
    response: {
      200: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nodeId: { type: 'string' },
            name: { type: 'string' },
            apiVersion: { type: 'string' }
          }
        }
      }
    }
  }
}, async (req) => {
  const { status, limit } = req.query as any;
  try {
    const nodes = await registryRepo.list(status || 'active', limit || 100);
    return nodes;
  } catch (err) {
    app.log.error(err);
    throw { statusCode: 400, message: (err as Error).message };
  }
});

app.addHook('onClose', async () => {
  await pool.end();
  app.log.info('[registry] Cleanup complete');
});

if (process.env.NODE_ENV !== 'test' && process.env.BTX_MANUAL_LISTEN !== 'true') {
  app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3001) })
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}

export default app;

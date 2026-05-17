import Fastify from 'fastify';
import { Pool } from 'pg';
import { RegistryRepository } from './adapter/db/repository';

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

const registryRepo = new RegistryRepository(pool);

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
          status: { type: 'string' }
        },
        required: ['nodeId', 'name', 'status']
      }
    }
  }
}, async (req) => {
  const registration = req.body as any;
  try {
    const node = await registryRepo.register(registration);
    return { code: 201, payload: node };
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
          status: { type: 'string' }
        },
        required: ['nodeId', 'name', 'endpointUrl', 'status']
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
            name: { type: 'string' }
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

if (process.env.NODE_ENV !== 'test') {
  app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3001) })
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}

export default app;

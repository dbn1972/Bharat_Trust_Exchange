import Fastify from 'fastify';
import { Pool } from 'pg';
import { ConsentsRepository, AuditRepository, OutboxRepository } from './adapter/db/repository';
import { ConsentService } from './domain/consent-service';
import { OutboxPublisher } from './adapter/kafka/outbox-publisher';
import { ConsentStatus } from './domain/consent';
import { getCloudConfig, createObjectStoreAdapter } from '@btx/bootstrap';
import type { ObjectStoreAdapter } from '@btx/adapter-objectstore';

const app = Fastify({ logger: true });

// Initialize database pool
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'btx',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});

// Initialize repositories
const consentsRepo = new ConsentsRepository(pool);
const auditRepo = new AuditRepository(pool);
const outboxRepo = new OutboxRepository(pool);

// ObjectStoreAdapter is initialized on startup (onReady hook) and wired into ConsentService.
// Declared here so the service can be rebuilt once the adapter is ready.
let objectStore: ObjectStoreAdapter | undefined;

// Initialize service (objectStore wired in onReady below)
let consentService = new ConsentService(consentsRepo, auditRepo, outboxRepo);

// Initialize outbox publisher
const kafkaBrokers = (process.env.KAFKA_BROKERS || 'redpanda:9092').split(',');
const outboxPublisher = new OutboxPublisher(pool, { brokers: kafkaBrokers });

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
            properties: {
              database: { type: 'boolean' },
              kafka: { type: 'boolean' }
            }
          }
        },
        required: ['ok', 'service']
      }
    }
  }
}, async () => {
  const dbOk = pool.totalCount > 0;
  const kafkaOk = outboxPublisher.getStatus().running;
  return {
    ok: dbOk && kafkaOk,
    service: 'control-plane',
    dependencies: { database: dbOk, kafka: kafkaOk }
  };
});

// Grant new consent endpoint (POST /v1/consents)
app.post('/v1/consents', {
  schema: {
    body: {
      type: 'object',
      properties: {
        fromNodeId: { type: 'string', format: 'uuid' },
        toNodeId: { type: 'string', format: 'uuid' },
        subjectRef: { type: 'string' },
        purpose: { type: 'string' },
        obligations: { type: 'object' },
        expiresAt: { type: 'string', format: 'date-time' }
      },
      required: ['fromNodeId', 'toNodeId', 'subjectRef', 'purpose']
    },
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
          createdAt: { type: 'string' }
        },
        required: ['id', 'status']
      }
    }
  }
}, async (req) => {
  const grant = req.body as any;
  const actorNodeId = req.headers['x-node-id'] as string || grant.fromNodeId;
  
  try {
    const consent = await consentService.grant(grant, actorNodeId);
    return { code: 201, payload: consent };
  } catch (err) {
    app.log.error(err);
    throw { statusCode: 400, message: (err as Error).message };
  }
});

// Revoke consent endpoint (POST /v1/consents/:consentId/revoke)
app.post('/v1/consents/:consentId/revoke', {
  schema: {
    params: {
      type: 'object',
      properties: { consentId: { type: 'string', format: 'uuid' } },
      required: ['consentId']
    },
    body: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
        cascadeToFederation: { type: 'boolean' }
      },
      required: ['reason']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string' }
        },
        required: ['id', 'status']
      }
    }
  }
}, async (req) => {
  const { consentId } = req.params as { consentId: string };
  const { reason, cascadeToFederation } = req.body as any;
  const actorNodeId = req.headers['x-node-id'] as string;

  try {
    const updated = await consentService.revoke(
      { consentId, reason, cascadeToFederation },
      actorNodeId
    );
    return { id: updated.id, status: updated.status };
  } catch (err) {
    app.log.error(err);
    throw { statusCode: 400, message: (err as Error).message };
  }
});

// Query consent endpoint (GET /v1/consents/:consentId)
app.get('/v1/consents/:consentId', {
  schema: {
    params: {
      type: 'object',
      properties: { consentId: { type: 'string', format: 'uuid' } },
      required: ['consentId']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
          fromNodeId: { type: 'string' },
          toNodeId: { type: 'string' },
          createdAt: { type: 'string' }
        },
        required: ['id', 'status']
      }
    }
  }
}, async (req) => {
  const { consentId } = req.params as { consentId: string };
  const requestorNodeId = req.headers['x-node-id'] as string;

  try {
    const consent = await consentService.query(consentId, requestorNodeId);
    return consent;
  } catch (err) {
    app.log.error(err);
    throw { statusCode: 403, message: (err as Error).message };
  }
});

// Get audit trail for consent (GET /v1/consents/:consentId/audit)
app.get('/v1/consents/:consentId/audit', {
  schema: {
    params: {
      type: 'object',
      properties: { consentId: { type: 'string', format: 'uuid' } },
      required: ['consentId']
    },
    response: {
      200: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            eventType: { type: 'string' },
            createdAt: { type: 'string' }
          }
        }
      }
    }
  }
}, async (req) => {
  const { consentId } = req.params as { consentId: string };

  try {
    const events = await consentService.getAuditTrail(consentId);
    return events;
  } catch (err) {
    app.log.error(err);
    throw { statusCode: 400, message: (err as Error).message };
  }
});

// Startup and shutdown hooks
app.addHook('onReady', async () => {
  try {
    // Wire ObjectStoreAdapter for audit archival (C-02 / B-02)
    const cloudConfig = await getCloudConfig();
    objectStore = await createObjectStoreAdapter(cloudConfig);
    const storeHealth = await objectStore.healthz();
    app.log.info('[control-plane] ObjectStore ready', storeHealth);
    // Rebuild ConsentService with the live adapter
    consentService = new ConsentService(consentsRepo, auditRepo, outboxRepo, undefined, objectStore);

    // Start outbox publisher worker
    await outboxPublisher.connect();
    outboxPublisher.start(1000);
    app.log.info('[control-plane] Outbox publisher started');
  } catch (err) {
    app.log.error('Failed to start control-plane services:', err);
    throw err;
  }
});

app.addHook('onClose', async () => {
  outboxPublisher.stop();
  await outboxPublisher.disconnect();
  await pool.end();
  app.log.info('[control-plane] Cleanup complete');
});

if (process.env.NODE_ENV !== 'test') {
  app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3002) })
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}

export default app;

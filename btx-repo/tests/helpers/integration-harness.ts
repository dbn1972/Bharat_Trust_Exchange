import { readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';

type ServiceName = 'registry' | 'controlPlane' | 'trustNode';

type ServiceRuntime = {
  app: FastifyInstance;
  baseUrl: string;
};

type HarnessOptions = {
  requireKafka?: boolean;
};

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const API_KEY = 'test-api-key';

const databaseConfig = {
  host: '127.0.0.1',
  port: 5432,
  user: 'btx',
  password: 'btx',
};

const serviceDatabases: Record<ServiceName, { name: string; migrations: string[] }> = {
  registry: {
    name: 'btx_registry',
    migrations: [
      'services/registry/migrations/001_init_nodes.sql',
      'services/registry/migrations/002_add_api_version.sql',
    ],
  },
  controlPlane: {
    name: 'btx_control_plane',
    migrations: ['services/control-plane/migrations/001_init_consents.sql'],
  },
  trustNode: {
    name: 'btx_trust_node',
    migrations: ['services/trust-node/migrations/001_init_federation.sql'],
  },
};

const pools = new Map<ServiceName, Pool>();

function setBaseEnv(): void {
  Object.assign(process.env, {
    BTX_API_KEY: API_KEY,
    BTX_MANUAL_LISTEN: 'true',
    NODE_ENV: 'integration',
    DB_HOST: databaseConfig.host,
    DB_PORT: String(databaseConfig.port),
    DB_USER: databaseConfig.user,
    DB_PASSWORD: databaseConfig.password,
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '6379',
    MESSAGE_BROKER_PROVIDER: 'redpanda',
    KAFKA_BROKERS: '127.0.0.1:19092',
    KAFKAJS_NO_PARTITIONER_WARNING: '1',
    CLOUD_PROVIDER: 'stub',
    KMS_STUB_URL: 'http://127.0.0.1:8081',
    MINIO_ENDPOINT: 'http://127.0.0.1:9000',
    MINIO_ACCESS_KEY: 'btxadmin',
    MINIO_SECRET_KEY: 'btxadmin123',
    EXPIRY_JOB_INTERVAL_MS: '200',
  });
}

async function waitForTcp(name: string, port: number, timeoutMs: number = 15000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.end();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
    });

    if (connected) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Required dependency is not reachable: ${name} on port ${port}`);
}

async function ensureDependencies(requireKafka: boolean): Promise<void> {
  await waitForTcp('postgres', 5432);
  await waitForTcp('redis', 6379);
  await waitForTcp('redpanda', 19092);
  await waitForTcp('minio', 9000);
  await waitForTcp('kms-stub', 8081);
  await waitForKafkaBroker('redpanda', ['127.0.0.1:19092']);
  if (requireKafka) {
    await waitForTcp('kafka', 29092);
    await waitForKafkaBroker('kafka', ['127.0.0.1:29092']);
  }
}

async function waitForKafkaBroker(name: string, brokers: string[], timeoutMs: number = 30000): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    const kafka = new Kafka({ clientId: `btx-${name}-probe`, brokers });
    const admin = kafka.admin();
    try {
      await admin.connect();
      await admin.listTopics();
      await admin.disconnect();
      return;
    } catch (error) {
      lastError = error;
      await admin.disconnect().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`Kafka broker is not ready: ${name} (${String(lastError)})`);
}

async function resetDatabase(service: ServiceName): Promise<void> {
  const { name, migrations } = serviceDatabases[service];
  const pool = new Pool({ ...databaseConfig, database: name });

  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');
  await pool.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
  await pool.query('GRANT ALL ON SCHEMA public TO public');

  for (const migration of migrations) {
    const sql = readFileSync(path.join(ROOT_DIR, migration), 'utf8');
    await pool.query(sql);
  }

  await pool.end();
}

async function startService(service: ServiceName): Promise<ServiceRuntime> {
  const { name } = serviceDatabases[service];
  process.env.DB_NAME = name;

  let modulePath = '';
  if (service === 'registry') modulePath = '../../services/registry/src/server.ts';
  if (service === 'controlPlane') modulePath = '../../services/control-plane/src/server.ts';
  if (service === 'trustNode') modulePath = '../../services/trust-node/src/server.ts';

  const imported = await import(modulePath);
  const app = imported.default as FastifyInstance;
  const baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });

  return { app, baseUrl };
}

export async function waitFor<T>(probe: () => Promise<T>, predicate: (value: T) => boolean, timeoutMs: number = 15000): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await probe();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Timed out waiting for condition');
}

export async function createIntegrationHarness(options: HarnessOptions = {}) {
  setBaseEnv();
  await ensureDependencies(Boolean(options.requireKafka));

  await resetDatabase('registry');
  await resetDatabase('controlPlane');
  await resetDatabase('trustNode');

  pools.set('registry', new Pool({ ...databaseConfig, database: serviceDatabases.registry.name }));
  pools.set('controlPlane', new Pool({ ...databaseConfig, database: serviceDatabases.controlPlane.name }));
  pools.set('trustNode', new Pool({ ...databaseConfig, database: serviceDatabases.trustNode.name }));

  const registry = await startService('registry');
  const controlPlane = await startService('controlPlane');
  const trustNode = await startService('trustNode');

  return {
    apiKey: API_KEY,
    urls: {
      registry: registry.baseUrl,
      controlPlane: controlPlane.baseUrl,
      trustNode: trustNode.baseUrl,
    },
    async request(service: ServiceName, route: string, init: RequestInit = {}, withAuth: boolean = true) {
      const headers = new Headers(init.headers || {});
      if (withAuth && !headers.has('authorization')) {
        headers.set('authorization', `Bearer ${API_KEY}`);
      }
      if (init.body && !headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }

      const response = await fetch(`${this.urls[service]}${route}`, {
        ...init,
        headers,
        body: typeof init.body === 'string' || init.body === undefined ? init.body : JSON.stringify(init.body),
      });

      const text = await response.text();
      let body: unknown = {};
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }

      return { status: response.status, body, headers: response.headers };
    },
    async query(service: ServiceName, text: string, values: unknown[] = []) {
      const pool = pools.get(service);
      if (!pool) throw new Error(`No pool configured for ${service}`);
      return pool.query(text, values);
    },
    waitFor,
    async stop() {
      await Promise.allSettled([
        trustNode.app.close(),
        controlPlane.app.close(),
        registry.app.close(),
      ]);

      await Promise.allSettled(Array.from(pools.values()).map((pool) => pool.end()));
      pools.clear();
    },
  };
}
/**
 * Google Cloud Storage adapter implementation
 */
import type { ObjectStoreAdapter, PutOpts } from './index.js';
import { ObjectStoreError } from './index.js';
import crypto from 'crypto';

export interface GcpConfig {
  project: string;
  client?: any;
}

export function createGcsStore(cfg: GcpConfig): ObjectStoreAdapter {
  let client = cfg.client;

  async function getClient() {
    if (!client) {
      try {
        const { Storage } = await import('@google-cloud/storage');
        client = new Storage({ projectId: cfg.project });
      } catch (err) {
        throw new ObjectStoreError('provider_error', 'GCP Storage SDK not available');
      }
    }
    return client;
  }

  return {
    async put(bucket: string, key: string, body: Uint8Array, opts?: PutOpts) {
      try {
        const gcs = await getClient();

        // Verify SHA-256 if provided
        if (opts?.sha256B64) {
          const computed = crypto.createHash('sha256').update(Buffer.from(body)).digest('base64');
          if (computed !== opts.sha256B64) {
            throw new ObjectStoreError('integrity', 'SHA-256 mismatch');
          }
        }

        const file = gcs.bucket(bucket).file(key);
        await file.save(body, {
          metadata: {
            contentType: opts?.contentType,
            metadata: opts?.metadata
          }
        });

        const [metadata] = await file.getMetadata();
        return {
          etag: metadata.etag || '',
          versionId: metadata.generation?.toString()
        };
      } catch (err) {
        if (err instanceof ObjectStoreError) throw err;
        throw new ObjectStoreError('provider_error', `put failed: ${String(err)}`);
      }
    },

    async get(bucket: string, key: string) {
      try {
        const gcs = await getClient();
        const file = gcs.bucket(bucket).file(key);

        const [data] = await file.download();
        const [metadata] = await file.getMetadata();

        return {
          body: new Uint8Array(data),
          metadata: metadata.metadata
        };
      } catch (err) {
        const msg = String(err);
        if (msg.includes('Not Found') || msg.includes('404')) {
          throw new ObjectStoreError('not_found', `Object not found: ${key}`);
        }
        throw new ObjectStoreError('provider_error', `get failed: ${msg}`);
      }
    },

    async head(bucket: string, key: string) {
      try {
        const gcs = await getClient();
        const file = gcs.bucket(bucket).file(key);

        const [metadata] = await file.getMetadata();
        return {
          size: Number(metadata.size || 0),
          etag: metadata.etag || '',
          metadata: metadata.metadata
        };
      } catch (err) {
        const msg = String(err);
        if (msg.includes('Not Found')) {
          return null;
        }
        throw new ObjectStoreError('provider_error', `head failed: ${msg}`);
      }
    },

    async signUrl(bucket: string, key: string, ttlSec: number, op?: 'get' | 'put') {
      try {
        const gcs = await getClient();
        const file = gcs.bucket(bucket).file(key);

        const [url] = await file.getSignedUrl({
          version: 'v4',
          action: op === 'put' ? 'write' : 'read',
          expires: Date.now() + ttlSec * 1000
        });

        return url;
      } catch (err) {
        throw new ObjectStoreError('provider_error', `signUrl failed: ${String(err)}`);
      }
    },

    async delete(bucket: string, key: string) {
      try {
        const gcs = await getClient();
        const file = gcs.bucket(bucket).file(key);
        await file.delete();
      } catch (err) {
        throw new ObjectStoreError('provider_error', `delete failed: ${String(err)}`);
      }
    },

    async healthz() {
      try {
        const gcs = await getClient();
        const [buckets] = await gcs.getBuckets({ maxResults: 1 });
        return { ok: buckets.length >= 0, provider: 'gcs' };
      } catch {
        return { ok: false, provider: 'gcs' };
      }
    }
  };
}

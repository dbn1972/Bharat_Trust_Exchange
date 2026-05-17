/**
 * Azure Blob Storage adapter implementation
 */
import type { ObjectStoreAdapter, PutOpts } from './index.js';
import { ObjectStoreError } from './index.js';
import crypto from 'crypto';

export interface AzureBlobConfig {
  account: string;
  client?: any;
}

export function createAzureBlobStore(cfg: AzureBlobConfig): ObjectStoreAdapter {
  let client = cfg.client;

  async function getClient() {
    if (!client) {
      try {
        const { BlobServiceClient } = await import('@azure/storage-blob');
        const { DefaultAzureCredential } = await import('@azure/identity');
        const credential = new DefaultAzureCredential();
        const accountUrl = `https://${cfg.account}.blob.core.windows.net`;
        client = new BlobServiceClient(accountUrl, credential);
      } catch (err) {
        throw new ObjectStoreError('provider_error', 'Azure Blob Storage SDK not available');
      }
    }
    return client;
  }

  return {
    async put(bucket: string, key: string, body: Uint8Array, opts?: PutOpts) {
      try {
        const blobService = await getClient();

        // Verify SHA-256 if provided
        if (opts?.sha256B64) {
          const computed = crypto.createHash('sha256').update(Buffer.from(body)).digest('base64');
          if (computed !== opts.sha256B64) {
            throw new ObjectStoreError('integrity', 'SHA-256 mismatch');
          }
        }

        const containerClient = blobService.getContainerClient(bucket);
        const blockBlobClient = containerClient.getBlockBlobClient(key);

        const result = await blockBlobClient.upload(body, body.length, {
          blobHTTPHeaders: { blobContentType: opts?.contentType },
          metadata: opts?.metadata
        });

        return {
          etag: result.etag || '',
          versionId: result.versionId
        };
      } catch (err) {
        if (err instanceof ObjectStoreError) throw err;
        throw new ObjectStoreError('provider_error', `put failed: ${String(err)}`);
      }
    },

    async get(bucket: string, key: string) {
      try {
        const blobService = await getClient();
        const containerClient = blobService.getContainerClient(bucket);
        const blockBlobClient = containerClient.getBlockBlobClient(key);

        const downloadResult = await blockBlobClient.download();
        if (!downloadResult.readableStreamBody) {
          throw new ObjectStoreError('not_found', `Object not found: ${key}`);
        }

        const chunks: Buffer[] = [];
        for await (const chunk of downloadResult.readableStreamBody) {
          chunks.push(chunk as Buffer);
        }
        const body = Buffer.concat(chunks);

        const properties = await blockBlobClient.getProperties();
        return {
          body: new Uint8Array(body),
          metadata: properties.metadata
        };
      } catch (err) {
        const msg = String(err);
        if (msg.includes('BlobNotFound') || msg.includes('404')) {
          throw new ObjectStoreError('not_found', `Object not found: ${key}`);
        }
        if (err instanceof ObjectStoreError) throw err;
        throw new ObjectStoreError('provider_error', `get failed: ${msg}`);
      }
    },

    async head(bucket: string, key: string) {
      try {
        const blobService = await getClient();
        const containerClient = blobService.getContainerClient(bucket);
        const blockBlobClient = containerClient.getBlockBlobClient(key);

        const properties = await blockBlobClient.getProperties();
        return {
          size: properties.contentLength || 0,
          etag: properties.etag || '',
          metadata: properties.metadata
        };
      } catch (err) {
        const msg = String(err);
        if (msg.includes('BlobNotFound')) {
          return null;
        }
        throw new ObjectStoreError('provider_error', `head failed: ${msg}`);
      }
    },

    async signUrl(bucket: string, key: string, ttlSec: number, op?: 'get' | 'put') {
      try {
        const { generateBlobSASUrl, BlobSASPermissions } = await import('@azure/storage-blob');
        const blobService = await getClient();

        const containerClient = blobService.getContainerClient(bucket);
        const blockBlobClient = containerClient.getBlockBlobClient(key);

        const permissions = op === 'put'
          ? new BlobSASPermissions({ write: true })
          : new BlobSASPermissions({ read: true });

        const url = await generateBlobSASUrl(
          blockBlobClient.name,
          blobService,
          { permissions, expiresOn: new Date(Date.now() + ttlSec * 1000) }
        );

        return url;
      } catch (err) {
        throw new ObjectStoreError('provider_error', `signUrl failed: ${String(err)}`);
      }
    },

    async delete(bucket: string, key: string) {
      try {
        const blobService = await getClient();
        const containerClient = blobService.getContainerClient(bucket);
        const blockBlobClient = containerClient.getBlockBlobClient(key);
        await blockBlobClient.delete();
      } catch (err) {
        throw new ObjectStoreError('provider_error', `delete failed: ${String(err)}`);
      }
    },

    async healthz() {
      try {
        const blobService = await getClient();
        const iter = blobService.listContainers();
        await iter.next();
        return { ok: true, provider: 'azure-blob' };
      } catch {
        return { ok: false, provider: 'azure-blob' };
      }
    }
  };
}

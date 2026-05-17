/**
 * AWS S3 object store adapter implementation
 */
import type { ObjectStoreAdapter, PutOpts } from './index.js';
import { ObjectStoreError } from './index.js';
import crypto from 'crypto';

export interface AwsS3Config {
  region: string;
  bucketDefault?: string;
  client?: any;
}

export function createAwsS3Store(cfg: AwsS3Config): ObjectStoreAdapter {
  let client = cfg.client;

  async function getClient() {
    if (!client) {
      try {
        const { S3Client } = await import('@aws-sdk/client-s3');
        client = new S3Client({ region: cfg.region });
      } catch (err) {
        throw new ObjectStoreError('provider_error', 'AWS S3 SDK not available');
      }
    }
    return client;
  }

  return {
    async put(bucket: string, key: string, body: Uint8Array, opts?: PutOpts) {
      try {
        const s3 = await getClient();
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');

        // Verify SHA-256 if provided
        if (opts?.sha256B64) {
          const computed = crypto.createHash('sha256').update(Buffer.from(body)).digest('base64');
          if (computed !== opts.sha256B64) {
            throw new ObjectStoreError('integrity', 'SHA-256 mismatch');
          }
        }

        const cmd = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: opts?.contentType,
          Metadata: opts?.metadata
        });

        const result = await s3.send(cmd);
        return {
          etag: result.ETag || '',
          versionId: result.VersionId
        };
      } catch (err) {
        if (err instanceof ObjectStoreError) throw err;
        throw new ObjectStoreError('provider_error', `put failed: ${String(err)}`);
      }
    },

    async get(bucket: string, key: string) {
      try {
        const s3 = await getClient();
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');

        const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
        const result = await s3.send(cmd);

        if (!result.Body) {
          throw new ObjectStoreError('not_found', `Object not found: ${key}`);
        }

        const bodyBytes = await result.Body.transformToByteArray();
        return {
          body: new Uint8Array(bodyBytes),
          metadata: result.Metadata
        };
      } catch (err) {
        if (err instanceof ObjectStoreError) throw err;
        const msg = String(err);
        if (msg.includes('NoSuchKey')) {
          throw new ObjectStoreError('not_found', `Object not found: ${key}`);
        }
        throw new ObjectStoreError('provider_error', `get failed: ${msg}`);
      }
    },

    async head(bucket: string, key: string) {
      try {
        const s3 = await getClient();
        const { HeadObjectCommand } = await import('@aws-sdk/client-s3');

        const cmd = new HeadObjectCommand({ Bucket: bucket, Key: key });
        const result = await s3.send(cmd);

        return {
          size: result.ContentLength || 0,
          etag: result.ETag || '',
          metadata: result.Metadata
        };
      } catch (err) {
        const msg = String(err);
        if (msg.includes('NotFound')) {
          return null;
        }
        throw new ObjectStoreError('provider_error', `head failed: ${msg}`);
      }
    },

    async signUrl(bucket: string, key: string, ttlSec: number, op?: 'get' | 'put') {
      try {
        const s3 = await getClient();
        const { GetObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

        const command = op === 'put'
          ? new PutObjectCommand({ Bucket: bucket, Key: key })
          : new GetObjectCommand({ Bucket: bucket, Key: key });

        const url = await getSignedUrl(s3, command, { expiresIn: ttlSec });
        return url;
      } catch (err) {
        throw new ObjectStoreError('provider_error', `signUrl failed: ${String(err)}`);
      }
    },

    async delete(bucket: string, key: string) {
      try {
        const s3 = await getClient();
        const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

        const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key });
        await s3.send(cmd);
      } catch (err) {
        throw new ObjectStoreError('provider_error', `delete failed: ${String(err)}`);
      }
    },

    async healthz() {
      try {
        const s3 = await getClient();
        const { ListBucketsCommand } = await import('@aws-sdk/client-s3');
        await s3.send(new ListBucketsCommand({}));
        return { ok: true, provider: 'aws-s3' };
      } catch {
        return { ok: false, provider: 'aws-s3' };
      }
    }
  };
}

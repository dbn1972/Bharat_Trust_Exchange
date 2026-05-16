/** MinIO / S3-compatible adapter. Talks S3 wire over plain fetch (no SDK
 *  dep) using AWS SigV4. Sufficient for local + CI. */
import { createHmac, createHash } from 'node:crypto';
import type { ObjectStoreAdapter, PutOpts } from './index.js';
import { ObjectStoreError } from './index.js';

export interface MinioConfig {
  endpoint: string;            // http://minio:9000
  accessKey: string;
  secretKey: string;
  region?: string;             // default 'us-east-1'
  fetch?: typeof fetch;
}

function sha256Hex(b: Uint8Array | string): string {
  return createHash('sha256').update(b as any).digest('hex');
}
function hmac(key: Uint8Array | string, data: string): Uint8Array {
  return new Uint8Array(createHmac('sha256', key).update(data).digest());
}

function signingKey(secret: string, date: string, region: string, service: string): Uint8Array {
  let k: Uint8Array = new TextEncoder().encode('AWS4' + secret);
  k = hmac(k, date);
  k = hmac(k, region);
  k = hmac(k, service);
  k = hmac(k, 'aws4_request');
  return k;
}

export function createMinioStore(cfg: MinioConfig): ObjectStoreAdapter {
  const region = cfg.region ?? 'us-east-1';
  const service = 's3';
  const f = cfg.fetch ?? fetch;
  const base = cfg.endpoint.replace(/\/$/, '');

  async function send(method: string, bucket: string, key: string, body: Uint8Array | null, extraHeaders: Record<string, string> = {}) {
    const path = `/${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
    const url = new URL(base + path);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
    const date = amzDate.slice(0, 8);
    const payloadHash = body ? sha256Hex(body) : sha256Hex('');

    const headers: Record<string, string> = {
      host: url.host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      ...extraHeaders
    };
    const canonicalHeaders = Object.keys(headers).sort().map(h => `${h.toLowerCase()}:${headers[h]}\n`).join('');
    const signedHeaders = Object.keys(headers).sort().map(h => h.toLowerCase()).join(';');
    const canonicalRequest = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const scope = `${date}/${region}/${service}/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
    const sig = Buffer.from(hmac(signingKey(cfg.secretKey, date, region, service), stringToSign)).toString('hex');
    const authz = `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;

    const res = await f(url, { method, headers: { ...headers, authorization: authz }, body: body ?? undefined });
    return res;
  }

  return {
    async put(bucket, key, body, opts?: PutOpts) {
      const extra: Record<string, string> = {};
      if (opts?.contentType) extra['content-type'] = opts.contentType;
      const res = await send('PUT', bucket, key, body, extra);
      if (!res.ok) throw new ObjectStoreError('provider_error', `s3 PUT ${res.status}`);
      return { etag: res.headers.get('etag') ?? '' };
    },
    async get(bucket, key) {
      const res = await send('GET', bucket, key, null);
      if (res.status === 404) throw new ObjectStoreError('not_found', `s3 GET ${key}`);
      if (!res.ok) throw new ObjectStoreError('provider_error', `s3 GET ${res.status}`);
      return { body: new Uint8Array(await res.arrayBuffer()) };
    },
    async head(bucket, key) {
      const res = await send('HEAD', bucket, key, null);
      if (res.status === 404) return null;
      if (!res.ok) throw new ObjectStoreError('provider_error', `s3 HEAD ${res.status}`);
      return { size: Number(res.headers.get('content-length') ?? 0), etag: res.headers.get('etag') ?? '' };
    },
    async signUrl() {
      throw new ObjectStoreError('not_implemented', 'minio presigned URL pending P-07 hardening');
    },
    async delete(bucket, key) {
      const res = await send('DELETE', bucket, key, null);
      if (!res.ok && res.status !== 404) throw new ObjectStoreError('provider_error', `s3 DELETE ${res.status}`);
    },
    async healthz() {
      try {
        const res = await f(base + '/minio/health/live');
        return { ok: res.ok, provider: 'minio' };
      } catch { return { ok: false, provider: 'minio' }; }
    }
  };
}

/** Cloud-agnostic object store (ADR-0007). Used for policy bundles, audit
 *  evidence packs, signed connector manifests. */

export interface PutOpts {
  contentType?: string;
  /** SHA-256 of body, base64; if set, store MUST reject on mismatch. */
  sha256B64?: string;
  metadata?: Record<string, string>;
}

export interface ObjectStoreAdapter {
  put(bucket: string, key: string, body: Uint8Array, opts?: PutOpts): Promise<{ etag: string; versionId?: string }>;
  get(bucket: string, key: string): Promise<{ body: Uint8Array; metadata?: Record<string, string> }>;
  head(bucket: string, key: string): Promise<{ size: number; etag: string; metadata?: Record<string, string> } | null>;
  signUrl(bucket: string, key: string, ttlSec: number, op?: 'get' | 'put'): Promise<string>;
  delete(bucket: string, key: string): Promise<void>;
  healthz(): Promise<{ ok: boolean; provider: string }>;
}

export class ObjectStoreError extends Error {
  constructor(public code: 'not_found' | 'unauth' | 'integrity' | 'provider_error' | 'not_implemented', m: string) {
    super(m); this.name = 'ObjectStoreError';
  }
}

export { createMinioStore } from './minio.js';
export { createAwsS3Store } from './aws.js';
export { createGcsStore } from './gcp.js';
export { createAzureBlobStore } from './azure.js';

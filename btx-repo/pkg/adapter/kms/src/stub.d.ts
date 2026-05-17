/**
 * HTTP-backed KMS adapter that targets the local `kms-stub` Fastify service
 * (see docker/kms-stub). Conforms to the same wire shape that real cloud
 * KMS adapters use, so the only swap to go live is `createStubKms` →
 * `createAwsKms` (etc.) via service config.
 */
import type { KmsAdapter } from './index.js';
export interface StubKmsConfig {
    endpoint: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
}
export declare function createStubKms(cfg: StubKmsConfig): KmsAdapter;

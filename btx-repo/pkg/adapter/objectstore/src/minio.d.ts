import type { ObjectStoreAdapter } from './index.js';
export interface MinioConfig {
    endpoint: string;
    accessKey: string;
    secretKey: string;
    region?: string;
    fetch?: typeof fetch;
}
export declare function createMinioStore(cfg: MinioConfig): ObjectStoreAdapter;

/**
 * Google Cloud Storage adapter implementation
 */
import type { ObjectStoreAdapter } from './index.js';
export interface GcpConfig {
    project: string;
    client?: any;
}
export declare function createGcsStore(cfg: GcpConfig): ObjectStoreAdapter;

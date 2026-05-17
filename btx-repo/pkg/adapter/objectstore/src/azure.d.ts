/**
 * Azure Blob Storage adapter implementation
 */
import type { ObjectStoreAdapter } from './index.js';
export interface AzureBlobConfig {
    account: string;
    client?: any;
}
export declare function createAzureBlobStore(cfg: AzureBlobConfig): ObjectStoreAdapter;

/**
 * AWS S3 object store adapter implementation
 */
import type { ObjectStoreAdapter } from './index.js';
export interface AwsS3Config {
    region: string;
    bucketDefault?: string;
    client?: any;
}
export declare function createAwsS3Store(cfg: AwsS3Config): ObjectStoreAdapter;

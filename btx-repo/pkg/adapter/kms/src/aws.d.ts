/**
 * AWS KMS adapter implementation
 * Uses AWS SDK v3 for KMS operations: DEK generation, signing, verification
 */
import type { KmsAdapter } from './index.js';
export interface AwsKmsConfig {
    region: string;
    signingKeyArn: string;
    encryptKeyArn: string;
    client?: any;
}
export declare function createAwsKms(cfg: AwsKmsConfig): KmsAdapter;

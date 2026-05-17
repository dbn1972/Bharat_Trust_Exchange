/**
 * Azure Key Vault adapter implementation
 * Uses Azure SDK for Key Vault operations: DEK generation, signing, verification
 */
import type { KmsAdapter } from './index.js';
export interface AzureKmsConfig {
    vaultUrl: string;
    signingKey: string;
    encryptKey: string;
    client?: any;
}
export declare function createAzureKms(cfg: AzureKmsConfig): KmsAdapter;

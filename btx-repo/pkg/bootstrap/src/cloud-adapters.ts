/**
 * Cloud adapter factory: Selects KMS/ObjectStore adapters based on environment
 * Supports local dev (stubs) and production (AWS/GCP/Azure)
 */

import type { KmsAdapter } from '@btx/adapter-kms';
import type { ObjectStoreAdapter } from '@btx/adapter-objectstore';

export interface CloudConfig {
  provider: 'stub' | 'aws' | 'gcp' | 'azure';
  kmsConfig?: Record<string, unknown>;
  objectStoreConfig?: Record<string, unknown>;
}

export async function getCloudConfig(): Promise<CloudConfig> {
  const provider = (process.env.CLOUD_PROVIDER || 'stub') as 'stub' | 'aws' | 'gcp' | 'azure';

  switch (provider) {
    case 'aws':
      return {
        provider: 'aws',
        kmsConfig: {
          region: process.env.AWS_REGION || 'us-east-1',
          signingKeyArn: process.env.AWS_KMS_SIGNING_KEY_ARN || '',
          encryptKeyArn: process.env.AWS_KMS_ENCRYPT_KEY_ARN || ''
        },
        objectStoreConfig: {
          region: process.env.AWS_REGION || 'us-east-1',
          bucketDefault: process.env.AWS_S3_BUCKET || 'btx-artifacts'
        }
      };

    case 'gcp':
      return {
        provider: 'gcp',
        kmsConfig: {
          project: process.env.GCP_PROJECT_ID || '',
          location: process.env.GCP_KMS_LOCATION || 'global',
          keyRing: process.env.GCP_KMS_KEYRING || 'btx',
          signingKey: process.env.GCP_KMS_SIGNING_KEY || 'btx-sign',
          encryptKey: process.env.GCP_KMS_ENCRYPT_KEY || 'btx-encrypt'
        },
        objectStoreConfig: {
          project: process.env.GCP_PROJECT_ID || ''
        }
      };

    case 'azure':
      return {
        provider: 'azure',
        kmsConfig: {
          vaultUrl: process.env.AZURE_KEYVAULT_URL || '',
          signingKey: process.env.AZURE_KMS_SIGNING_KEY || 'btx-sign',
          encryptKey: process.env.AZURE_KMS_ENCRYPT_KEY || 'btx-encrypt'
        },
        objectStoreConfig: {
          account: process.env.AZURE_STORAGE_ACCOUNT || ''
        }
      };

    case 'stub':
    default:
      return {
        provider: 'stub',
        kmsConfig: {
          stubUrl: process.env.KMS_STUB_URL || 'http://kms-stub:8081'
        },
        objectStoreConfig: {
          endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000',
          accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
          secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
        }
      };
  }
}

export async function createKmsAdapter(config: CloudConfig): Promise<KmsAdapter> {
  switch (config.provider) {
    case 'aws': {
      const { createAwsKms } = await import('@btx/adapter-kms');
      return createAwsKms(config.kmsConfig as any);
    }

    case 'gcp': {
      const { createGcpKms } = await import('@btx/adapter-kms');
      return createGcpKms(config.kmsConfig as any);
    }

    case 'azure': {
      const { createAzureKms } = await import('@btx/adapter-kms');
      return createAzureKms(config.kmsConfig as any);
    }

    case 'stub':
    default: {
      const { createStubKms } = await import('@btx/adapter-kms');
      return createStubKms(config.kmsConfig as any);
    }
  }
}

export async function createObjectStoreAdapter(config: CloudConfig): Promise<ObjectStoreAdapter> {
  switch (config.provider) {
    case 'aws': {
      const { createAwsS3Store } = await import('@btx/adapter-objectstore');
      return createAwsS3Store(config.objectStoreConfig as any);
    }

    case 'gcp': {
      const { createGcsStore } = await import('@btx/adapter-objectstore');
      return createGcsStore(config.objectStoreConfig as any);
    }

    case 'azure': {
      const { createAzureBlobStore } = await import('@btx/adapter-objectstore');
      return createAzureBlobStore(config.objectStoreConfig as any);
    }

    case 'stub':
    default: {
      const { createMinioStore } = await import('@btx/adapter-objectstore');
      return createMinioStore(config.objectStoreConfig as any);
    }
  }
}

/**
 * Cloud Conformance Test Specifications
 * Validates adapter implementations against real cloud services
 * Replaces stub implementations when cloud credentials available
 */

export interface CloudConformanceTest {
  cloud: 'aws' | 'gcp' | 'azure';
  testName: string;
  description: string;
  adrs: string[];  // Relevant ADRs
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  timeout: number; // milliseconds
}

// AWS Cloud Conformance Tests (CT-CLOUD-AWS-*)
export const AwsConformanceTests: CloudConformanceTest[] = [
  {
    cloud: 'aws',
    testName: 'CT-CLOUD-AWS-KMS-001',
    description: 'AWS KMS generateDataKey returns valid DEK with proper wrapping',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'aws',
    testName: 'CT-CLOUD-AWS-KMS-002',
    description: 'AWS KMS decryptDataKey unwraps ciphertext correctly',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'aws',
    testName: 'CT-CLOUD-AWS-KMS-003',
    description: 'AWS KMS sign produces ECDSA-P256-SHA256 signatures',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'aws',
    testName: 'CT-CLOUD-AWS-KMS-004',
    description: 'AWS KMS verify validates signatures correctly',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'aws',
    testName: 'CT-CLOUD-AWS-KMS-005',
    description: 'AWS KMS publicKeyPem returns valid PEM-encoded key',
    adrs: ['ADR-0007'],
    criticality: 'CRITICAL',
    timeout: 5000
  },
  {
    cloud: 'aws',
    testName: 'CT-CLOUD-AWS-S3-001',
    description: 'AWS S3 put with SHA-256 verification validates integrity',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 15000
  },
  {
    cloud: 'aws',
    testName: 'CT-CLOUD-AWS-S3-002',
    description: 'AWS S3 get retrieves stored object correctly',
    adrs: ['ADR-0007'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'aws',
    testName: 'CT-CLOUD-AWS-S3-003',
    description: 'AWS S3 signUrl generates valid presigned URLs',
    adrs: ['ADR-0007'],
    criticality: 'HIGH',
    timeout: 5000
  },
  {
    cloud: 'aws',
    testName: 'CT-CLOUD-AWS-KMS-LATENCY',
    description: 'AWS KMS operations meet latency budget (policy eval < 15ms)',
    adrs: ['ADR-0020'],
    criticality: 'HIGH',
    timeout: 30000
  }
];

// GCP Cloud Conformance Tests (CT-CLOUD-GCP-*)
export const GcpConformanceTests: CloudConformanceTest[] = [
  {
    cloud: 'gcp',
    testName: 'CT-CLOUD-GCP-KMS-001',
    description: 'GCP Cloud KMS generateDataKey produces valid DEK',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'gcp',
    testName: 'CT-CLOUD-GCP-KMS-002',
    description: 'GCP Cloud KMS decrypts wrapped data correctly',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'gcp',
    testName: 'CT-CLOUD-GCP-KMS-003',
    description: 'GCP Cloud KMS asymmetricSign produces valid ED25519 signatures',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'gcp',
    testName: 'CT-CLOUD-GCP-KMS-004',
    description: 'GCP Cloud KMS asymmetricDecrypt validates signatures',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'gcp',
    testName: 'CT-CLOUD-GCP-GCS-001',
    description: 'GCP Cloud Storage put stores object with metadata',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 15000
  },
  {
    cloud: 'gcp',
    testName: 'CT-CLOUD-GCP-GCS-002',
    description: 'GCP Cloud Storage get retrieves with correct metadata',
    adrs: ['ADR-0007'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'gcp',
    testName: 'CT-CLOUD-GCP-GCS-003',
    description: 'GCP Cloud Storage signUrl generates v4 URLs with TTL',
    adrs: ['ADR-0007'],
    criticality: 'HIGH',
    timeout: 5000
  },
  {
    cloud: 'gcp',
    testName: 'CT-CLOUD-GCP-IAM',
    description: 'GCP IAM credentials correctly authenticate requests',
    adrs: ['ADR-0014'],
    criticality: 'CRITICAL',
    timeout: 5000
  }
];

// Azure Cloud Conformance Tests (CT-CLOUD-AZURE-*)
export const AzureConformanceTests: CloudConformanceTest[] = [
  {
    cloud: 'azure',
    testName: 'CT-CLOUD-AZURE-KV-001',
    description: 'Azure Key Vault generateDataKey produces valid DEK',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'azure',
    testName: 'CT-CLOUD-AZURE-KV-002',
    description: 'Azure Key Vault decrypts wrapped data correctly',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'azure',
    testName: 'CT-CLOUD-AZURE-KV-003',
    description: 'Azure Key Vault sign produces ECDSA signatures',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'azure',
    testName: 'CT-CLOUD-AZURE-KV-004',
    description: 'Azure Key Vault verify validates signatures',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'azure',
    testName: 'CT-CLOUD-AZURE-BLOB-001',
    description: 'Azure Blob Storage put stores with metadata',
    adrs: ['ADR-0007', 'ADR-0020'],
    criticality: 'CRITICAL',
    timeout: 15000
  },
  {
    cloud: 'azure',
    testName: 'CT-CLOUD-AZURE-BLOB-002',
    description: 'Azure Blob Storage get retrieves with metadata',
    adrs: ['ADR-0007'],
    criticality: 'CRITICAL',
    timeout: 10000
  },
  {
    cloud: 'azure',
    testName: 'CT-CLOUD-AZURE-BLOB-003',
    description: 'Azure Blob Storage signUrl generates SAS URLs',
    adrs: ['ADR-0007'],
    criticality: 'HIGH',
    timeout: 5000
  },
  {
    cloud: 'azure',
    testName: 'CT-CLOUD-AZURE-IDENTITY',
    description: 'Azure DefaultAzureCredential authenticates correctly',
    adrs: ['ADR-0014'],
    criticality: 'CRITICAL',
    timeout: 5000
  }
];

/**
 * Cloud Conformance Execution Report
 */
export interface ConformanceReport {
  timestamp: Date;
  cloud: 'aws' | 'gcp' | 'azure';
  testsTotal: number;
  testsPassed: number;
  testsFailed: number;
  latencyP99: number; // milliseconds
  latencyP95: number;
  latencyMedian: number;
  results: Array<{
    testName: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
    latency: number;
    error?: string;
  }>;
}

# Phase 10: Cloud Conformance Certification

## Overview
Cloud conformance certification validates that real cloud provider SDKs (AWS, GCP, Azure) work correctly with BTX adapter implementations. This gates production deployment.

## Certification Process

### Prerequisites

**AWS**
```bash
# IAM Permissions Required
- kms:Decrypt
- kms:GenerateDataKey
- kms:Sign
- kms:Verify
- kms:GetPublicKey
- s3:GetObject
- s3:PutObject
- s3:DeleteObject
- s3:GetObjectVersion
```

**GCP**
```bash
# IAM Roles Required
- roles/cloudkms.cryptoOperator
- roles/cloudkms.publicKeyViewer
- roles/storage.admin
```

**Azure**
```bash
# RBAC Roles Required
- Key Vault Crypto User
- Storage Blob Data Contributor
```

### Test Specifications

#### AWS Conformance Tests (9 tests)
| Test ID | Description | Criticality |
|---------|-------------|-------------|
| CT-CLOUD-AWS-KMS-001 | generateDataKey produces valid DEK | CRITICAL |
| CT-CLOUD-AWS-KMS-002 | decryptDataKey unwraps correctly | CRITICAL |
| CT-CLOUD-AWS-KMS-003 | sign produces ECDSA-P256-SHA256 | CRITICAL |
| CT-CLOUD-AWS-KMS-004 | verify validates signatures | CRITICAL |
| CT-CLOUD-AWS-KMS-005 | publicKeyPem returns valid PEM | CRITICAL |
| CT-CLOUD-AWS-S3-001 | put with SHA-256 integrity | CRITICAL |
| CT-CLOUD-AWS-S3-002 | get retrieves correctly | CRITICAL |
| CT-CLOUD-AWS-S3-003 | signUrl generates presigned URLs | HIGH |
| CT-CLOUD-AWS-KMS-LATENCY | KMS ops < 15ms (policy eval budget) | HIGH |

#### GCP Conformance Tests (8 tests)
| Test ID | Description | Criticality |
|---------|-------------|-------------|
| CT-CLOUD-GCP-KMS-001 | generateDataKey produces valid DEK | CRITICAL |
| CT-CLOUD-GCP-KMS-002 | decrypt unwraps correctly | CRITICAL |
| CT-CLOUD-GCP-KMS-003 | asymmetricSign produces ED25519 | CRITICAL |
| CT-CLOUD-GCP-KMS-004 | asymmetricDecrypt validates | CRITICAL |
| CT-CLOUD-GCP-GCS-001 | put stores with metadata | CRITICAL |
| CT-CLOUD-GCP-GCS-002 | get retrieves with metadata | CRITICAL |
| CT-CLOUD-GCP-GCS-003 | signUrl generates v4 URLs | HIGH |
| CT-CLOUD-GCP-IAM | credentials authenticate | CRITICAL |

#### Azure Conformance Tests (8 tests)
| Test ID | Description | Criticality |
|---------|-------------|-------------|
| CT-CLOUD-AZURE-KV-001 | generateDataKey produces valid DEK | CRITICAL |
| CT-CLOUD-AZURE-KV-002 | decrypt unwraps correctly | CRITICAL |
| CT-CLOUD-AZURE-KV-003 | sign produces ECDSA | CRITICAL |
| CT-CLOUD-AZURE-KV-004 | verify validates signatures | CRITICAL |
| CT-CLOUD-AZURE-BLOB-001 | put stores with metadata | CRITICAL |
| CT-CLOUD-AZURE-BLOB-002 | get retrieves with metadata | CRITICAL |
| CT-CLOUD-AZURE-BLOB-003 | signUrl generates SAS URLs | HIGH |
| CT-CLOUD-AZURE-IDENTITY | credentials authenticate | CRITICAL |

## Certification Workflows

### AWS Certification (CT-CLOUD-AWS)

```bash
# Set up AWS resources (one-time)
aws kms create-key --description "BTX Signing Key"
aws kms create-key --description "BTX Encrypt Key"
aws s3api create-bucket --bucket btx-conformance --region us-east-1

# Run conformance tests
export AWS_REGION=us-east-1
export AWS_KMS_SIGNING_KEY_ARN=arn:aws:kms:us-east-1:123456789:key/xxx
export AWS_KMS_ENCRYPT_KEY_ARN=arn:aws:kms:us-east-1:123456789:key/yyy
export AWS_S3_BUCKET=btx-conformance

npm run cert:aws
# Output: ct/reports/aws-conformance-report.json
```

### GCP Certification (CT-CLOUD-GCP)

```bash
# Set up GCP resources (one-time)
gcloud kms keyrings create btx --location global
gcloud kms keys create btx-sign --location global --keyring btx --purpose asymmetric-sign
gcloud kms keys create btx-encrypt --location global --keyring btx --purpose encryption
gsutil mb gs://btx-conformance/

# Run conformance tests
export GCP_PROJECT_ID=my-project
export GCP_KMS_LOCATION=global
export GCP_KMS_KEYRING=btx

npm run cert:gcp
# Output: ct/reports/gcp-conformance-report.json
```

### Azure Certification (CT-CLOUD-AZURE)

```bash
# Set up Azure resources (one-time)
az keyvault create --name btx-vault --resource-group my-rg
az keyvault key create --vault-name btx-vault --name btx-sign --key-type EC
az keyvault key create --vault-name btx-vault --name btx-encrypt --key-type RSA
az storage account create --name btxconformance --resource-group my-rg

# Run conformance tests
export AZURE_KEYVAULT_URL=https://btx-vault.vault.azure.net/
export AZURE_KMS_SIGNING_KEY=btx-sign
export AZURE_KMS_ENCRYPT_KEY=btx-encrypt
export AZURE_STORAGE_ACCOUNT=btxconformance

npm run cert:azure
# Output: ct/reports/azure-conformance-report.json
```

## Certification Success Criteria

All tests must PASS with the following metrics:
- **Test Pass Rate**: 100% (zero failures)
- **KMS Latency p99**: < 15ms (policy decision SLA per ADR-0020)
- **S3/GCS/Blob Latency p95**: < 100ms (object store operations)
- **Error Rate**: 0%

## Certification Reports

Each cloud provider generates a conformance report:

```json
{
  "timestamp": "2026-05-17T12:00:00Z",
  "cloud": "aws",
  "testsTotal": 9,
  "testsPassed": 9,
  "testsFailed": 0,
  "latencyP99": 12.5,
  "latencyMedian": 8.2,
  "results": [
    {
      "testName": "CT-CLOUD-AWS-KMS-001",
      "status": "PASS",
      "latency": 8
    },
    ...
  ]
}
```

## Post-Certification

Once all three clouds (AWS, GCP, Azure) pass certification:

1. **Production Readiness**: Services can use real cloud adapters
2. **Environment Configuration**: Set `CLOUD_PROVIDER=aws|gcp|azure` in production
3. **Adapter Selection**: Bootstrap factory automatically loads correct cloud SDK
4. **Fallback**: Local dev/test continues using stubs (no cloud dependencies needed)

## Troubleshooting

### KMS Latency Exceeds Budget
- Check KMS key HSM type (CloudHSM slower than software keys)
- Verify network latency to KMS endpoint
- Enable CloudFront caching for key operations
- Consider key caching layer

### S3/GCS/Blob Upload Failures
- Verify bucket/container access permissions
- Check network throughput
- Reduce chunk size for slow connections
- Enable multipart upload for large objects

### Signature Verification Failures
- Verify key parameters match (ED25519 vs ECDSA)
- Check key rotation/expiration
- Validate message encoding (UTF-8 vs binary)

## Success Checklist

- [ ] AWS cert: All 9 tests pass, latency < 15ms
- [ ] GCP cert: All 8 tests pass, latency < 15ms
- [ ] Azure cert: All 8 tests pass, latency < 15ms
- [ ] Reports generated and committed to git
- [ ] Production deployment authorized
- [ ] Cloud provider support tickets closed

## Next Steps (Beyond Phase 10)
- Real-world multi-cloud testing with 2+ clouds simultaneously
- Chaos engineering: test KMS unavailability, S3 throttling
- Cost optimization: analyze cloud usage patterns
- Security audit: verify IAM least-privilege configuration

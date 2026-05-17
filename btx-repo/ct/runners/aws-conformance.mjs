/**
 * AWS Cloud Conformance Test Runner
 * Executes CT-CLOUD-AWS tests against real AWS KMS and S3
 * 
 * Prerequisites:
 *   - AWS credentials configured (IAM user with KMS + S3 access)
 *   - Environment: AWS_REGION, AWS_KMS_SIGNING_KEY_ARN, AWS_KMS_ENCRYPT_KEY_ARN, AWS_S3_BUCKET
 *   - Node 20+
 * 
 * Usage:
 *   AWS_REGION=us-east-1 \
 *   AWS_KMS_SIGNING_KEY_ARN=arn:aws:kms:us-east-1:123456789:key/xxx \
 *   AWS_KMS_ENCRYPT_KEY_ARN=arn:aws:kms:us-east-1:123456789:key/yyy \
 *   AWS_S3_BUCKET=btx-conformance \
 *   node ct/runners/aws-conformance.mjs
 */

import { createAwsKms } from '@btx/adapter-kms';
import { createAwsS3Store } from '@btx/adapter-objectstore';
import crypto from 'crypto';
import { writeFileSync } from 'fs';

const REGION = process.env.AWS_REGION || 'us-east-1';
const SIGNING_KEY_ARN = process.env.AWS_KMS_SIGNING_KEY_ARN || '';
const ENCRYPT_KEY_ARN = process.env.AWS_KMS_ENCRYPT_KEY_ARN || '';
const S3_BUCKET = process.env.AWS_S3_BUCKET || 'btx-conformance';

const results = [];
const startTime = Date.now();

async function runTest(testName, testFn) {
  console.log(`Running ${testName}...`);
  const ts = Date.now();
  try {
    await testFn();
    const latency = Date.now() - ts;
    results.push({ testName, status: 'PASS', latency });
    console.log(`  ✓ PASS (${latency}ms)`);
  } catch (err) {
    const latency = Date.now() - ts;
    results.push({ testName, status: 'FAIL', latency, error: String(err) });
    console.log(`  ✗ FAIL: ${err}`);
  }
}

async function main() {
  console.log('AWS Cloud Conformance Test Suite');
  console.log(`Region: ${REGION}`);
  console.log('');

  const kms = createAwsKms({
    region: REGION,
    signingKeyArn: SIGNING_KEY_ARN,
    encryptKeyArn: ENCRYPT_KEY_ARN
  });

  const s3 = createAwsS3Store({
    region: REGION,
    bucketDefault: S3_BUCKET
  });

  // KMS Tests
  await runTest('CT-CLOUD-AWS-KMS-001: generateDataKey', async () => {
    const dek = await kms.generateDataKey('encrypt', { bits: 256 });
    if (!dek.plaintext || !dek.ciphertext) throw new Error('Invalid DEK response');
    if (dek.plaintext.length !== 32) throw new Error(`DEK size mismatch: ${dek.plaintext.length}`);
  });

  await runTest('CT-CLOUD-AWS-KMS-002: decryptDataKey', async () => {
    const dek = await kms.generateDataKey('encrypt', { bits: 256 });
    const plaintext = await kms.decryptDataKey('encrypt', dek.ciphertext);
    if (!plaintext) throw new Error('Failed to decrypt DEK');
    if (plaintext.length !== dek.plaintext.length) throw new Error('Decrypted size mismatch');
  });

  await runTest('CT-CLOUD-AWS-KMS-003: sign', async () => {
    const message = new Uint8Array(Buffer.from('test message'));
    const sig = await kms.sign('signing', message);
    if (!sig.signature || sig.signature.length === 0) throw new Error('Empty signature');
    if (sig.algo !== 'ecdsa-p256-sha256') throw new Error('Wrong algorithm');
  });

  await runTest('CT-CLOUD-AWS-KMS-004: verify', async () => {
    const message = new Uint8Array(Buffer.from('test message'));
    const sig = await kms.sign('signing', message);
    const valid = await kms.verify('signing', message, sig.signature);
    if (!valid) throw new Error('Signature verification failed');
  });

  await runTest('CT-CLOUD-AWS-KMS-005: publicKeyPem', async () => {
    const pem = await kms.publicKeyPem('signing');
    if (!pem.includes('BEGIN PUBLIC KEY')) throw new Error('Invalid PEM format');
  });

  // S3 Tests
  const testBucket = S3_BUCKET;
  const testKey = `conformance-test-${Date.now()}.bin`;
  const testData = new Uint8Array(Buffer.from('test data content'));
  const testSha256 = crypto.createHash('sha256').update(Buffer.from(testData)).digest('base64');

  await runTest('CT-CLOUD-AWS-S3-001: put with SHA-256', async () => {
    const result = await s3.put(testBucket, testKey, testData, {
      sha256B64: testSha256,
      contentType: 'application/octet-stream',
      metadata: { conformance: 'test' }
    });
    if (!result.etag) throw new Error('No ETag returned');
  });

  await runTest('CT-CLOUD-AWS-S3-002: get', async () => {
    const result = await s3.get(testBucket, testKey);
    if (!result.body) throw new Error('No body returned');
    if (result.body.length === 0) throw new Error('Empty body');
  });

  await runTest('CT-CLOUD-AWS-S3-003: signUrl', async () => {
    const url = await s3.signUrl(testBucket, testKey, 3600, 'get');
    if (!url.includes('http')) throw new Error('Invalid URL format');
  });

  await runTest('CT-CLOUD-AWS-S3-cleanup: delete', async () => {
    await s3.delete(testBucket, testKey);
  });

  // KMS Latency Test
  await runTest('CT-CLOUD-AWS-KMS-LATENCY: measure policy eval time', async () => {
    const times = [];
    for (let i = 0; i < 10; i++) {
      const ts = Date.now();
      await kms.sign('signing', new Uint8Array(Buffer.from('msg')));
      times.push(Date.now() - ts);
    }
    const p99 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)];
    if (p99 > 15) {
      throw new Error(`KMS latency p99=${p99}ms exceeds budget of 15ms`);
    }
  });

  // Report
  const elapsed = Date.now() - startTime;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log('');
  console.log(`Results: ${passed} passed, ${failed} failed (${elapsed}ms total)`);
  console.log('');

  const report = {
    timestamp: new Date().toISOString(),
    cloud: 'aws',
    testsTotal: results.length,
    testsPassed: passed,
    testsFailed: failed,
    latencyP99: Math.max(...results.map(r => r.latency)),
    latencyMedian: results.sort((a, b) => a.latency - b.latency)[Math.floor(results.length / 2)].latency,
    results
  };

  writeFileSync('ct/reports/aws-conformance-report.json', JSON.stringify(report, null, 2));
  console.log('Report saved to ct/reports/aws-conformance-report.json');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

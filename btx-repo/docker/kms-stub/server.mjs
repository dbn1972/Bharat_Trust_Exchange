// BTX local KMS stub.
// Speaks the same wire shape as @btx/adapter-kms's HTTP transport so the
// adapter can swap stub <-> real cloud KMS by config.
//
// SECURITY: this stub is NOT a KMS. It stores DEKs on disk under /keys.
// Local dev / CI only. Never run in production. See ADR-0020.

import Fastify from 'fastify';
import { randomBytes, createCipheriv, createDecipheriv, createHash, createPrivateKey, sign as nodeSign, verify as nodeVerify, generateKeyPairSync } from 'node:crypto';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.KMS_STUB_PORT ?? 8080);
const ROOT = process.env.KMS_STUB_KEY_ROOT ?? '/keys';

await mkdir(ROOT, { recursive: true });

const app = Fastify({ logger: { level: 'info' } });

// In-memory KEK registry. Each KEK is an AES-256 master key persisted to disk.
const keks = new Map();          // keyId -> { algo, material: Buffer, version }
const signingKeys = new Map();   // keyId -> { algo:'ed25519', priv: KeyObject, pub: KeyObject, version }

async function loadOrCreateKek(keyId) {
  if (keks.has(keyId)) return keks.get(keyId);
  const path = join(ROOT, `kek-${keyId}.bin`);
  if (existsSync(path)) {
    const material = await readFile(path);
    keks.set(keyId, { algo: 'AES-256-GCM', material, version: 1 });
  } else {
    const material = randomBytes(32);
    await writeFile(path, material, { mode: 0o600 });
    keks.set(keyId, { algo: 'AES-256-GCM', material, version: 1 });
  }
  return keks.get(keyId);
}

async function loadOrCreateSigningKey(keyId) {
  if (signingKeys.has(keyId)) return signingKeys.get(keyId);
  const privPath = join(ROOT, `sig-${keyId}.pem`);
  const pubPath = join(ROOT, `sig-${keyId}.pub`);
  if (existsSync(privPath) && existsSync(pubPath)) {
    const priv = createPrivateKey(await readFile(privPath));
    const pub = createPrivateKey(await readFile(pubPath));
    signingKeys.set(keyId, { algo: 'ed25519', priv, pub, version: 1 });
  } else {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    await writeFile(privPath, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
    await writeFile(pubPath,  publicKey.export({ format: 'pem', type: 'spki' }));
    signingKeys.set(keyId, { algo: 'ed25519', priv: privateKey, pub: publicKey, version: 1 });
  }
  return signingKeys.get(keyId);
}

app.get('/healthz', async () => ({ ok: true, kind: 'kms-stub' }));

// ---- envelope crypto ------------------------------------------------------
app.post('/v1/generate-dek', {
  schema: {
    body: {
      type: 'object',
      required: ['keyId'],
      properties: {
        keyId:  { type: 'string', minLength: 1 },
        bits:   { type: 'integer', enum: [128, 192, 256], default: 256 },
        aad:    { type: 'string' }
      }
    }
  }
}, async (req) => {
  const { keyId, bits = 256, aad } = req.body;
  const kek = await loadOrCreateKek(keyId);
  const dek = randomBytes(bits / 8);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', kek.material, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    keyId,
    plaintext: dek.toString('base64'),
    ciphertext: Buffer.concat([iv, tag, ct]).toString('base64'),
    algo: kek.algo,
    keyVersion: kek.version
  };
});

app.post('/v1/decrypt', {
  schema: {
    body: {
      type: 'object',
      required: ['keyId', 'ciphertext'],
      properties: {
        keyId:      { type: 'string' },
        ciphertext: { type: 'string' },
        aad:        { type: 'string' }
      }
    }
  }
}, async (req) => {
  const { keyId, ciphertext, aad } = req.body;
  const kek = await loadOrCreateKek(keyId);
  const buf = Buffer.from(ciphertext, 'base64');
  if (buf.length < 28) return req.server.httpErrors.badRequest('ciphertext too short');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const d = createDecipheriv('aes-256-gcm', kek.material, iv);
  if (aad) d.setAAD(Buffer.from(aad, 'utf8'));
  d.setAuthTag(tag);
  const pt = Buffer.concat([d.update(ct), d.final()]);
  return { keyId, plaintext: pt.toString('base64'), keyVersion: kek.version };
});

// ---- signing ---------------------------------------------------------------
app.post('/v1/sign', {
  schema: {
    body: {
      type: 'object',
      required: ['keyId', 'message'],
      properties: {
        keyId:   { type: 'string' },
        message: { type: 'string' },          // base64
        algo:    { type: 'string', enum: ['ed25519'], default: 'ed25519' }
      }
    }
  }
}, async (req) => {
  const { keyId, message } = req.body;
  const k = await loadOrCreateSigningKey(keyId);
  const sig = nodeSign(null, Buffer.from(message, 'base64'), k.priv);
  return { keyId, algo: 'ed25519', signature: sig.toString('base64'), keyVersion: k.version };
});

app.post('/v1/verify', {
  schema: {
    body: {
      type: 'object',
      required: ['keyId', 'message', 'signature'],
      properties: {
        keyId:     { type: 'string' },
        message:   { type: 'string' },
        signature: { type: 'string' }
      }
    }
  }
}, async (req) => {
  const { keyId, message, signature } = req.body;
  const k = await loadOrCreateSigningKey(keyId);
  const ok = nodeVerify(null, Buffer.from(message, 'base64'), k.pub, Buffer.from(signature, 'base64'));
  return { keyId, valid: ok };
});

app.get('/v1/public-key/:keyId', async (req) => {
  const { keyId } = req.params;
  const k = await loadOrCreateSigningKey(keyId);
  return { keyId, algo: 'ed25519', publicKeyPem: k.pub.export({ format: 'pem', type: 'spki' }).toString() };
});

// ---- hash (convenience) ---------------------------------------------------
app.post('/v1/hash', async (req) => {
  const { message, algo = 'sha256' } = req.body ?? {};
  const h = createHash(algo).update(Buffer.from(message, 'base64')).digest('base64');
  return { algo, digest: h };
});

app.listen({ port: PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`kms-stub listening on :${PORT}`))
  .catch((e) => { app.log.error(e); process.exit(1); });

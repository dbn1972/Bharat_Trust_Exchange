import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { KmsAdapter } from '../../adapter/kms/src/index.js';
import type { ObjectStoreAdapter } from '../../adapter/objectstore/src/index.js';

type Primitive = string | number | boolean | null;
export type PolicyContext = Record<string, Primitive | Primitive[] | Record<string, unknown>>;

export interface PolicyRule {
  id: string;
  effect: 'allow' | 'deny';
  when: {
    all?: Array<{ path: string; op: 'eq' | 'neq' | 'in' | 'contains'; value: Primitive | Primitive[] }>;
    any?: Array<{ path: string; op: 'eq' | 'neq' | 'in' | 'contains'; value: Primitive | Primitive[] }>;
  };
  obligations?: Record<string, Primitive | Primitive[]>;
}

export interface PolicyBundle {
  bundleId: string;
  issuedAt: string;
  version: string;
  rules: PolicyRule[];
}

export interface SignedBundle {
  payload: PolicyBundle;
  signatureB64: string;
  keyId: string;
}

export interface Decision {
  ruleId: string;
  decision: 'allow' | 'deny';
  obligations: Record<string, Primitive | Primitive[]>;
  reason?: string;
}

export interface PolicyPluginOptions {
  objectStore: ObjectStoreAdapter;
  kms: KmsAdapter;
  bucket: string;
  key: string;
  cacheTtlMs?: number;
}

declare module 'fastify' {
  interface FastifyInstance {
    policy: {
      evaluate: (ruleId: string, ctx: PolicyContext) => Decision;
      reload: () => Promise<void>;
      currentBundleId: () => string | null;
    };
  }
}

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: any, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), obj as any);
}

function matchOne(cond: { path: string; op: 'eq' | 'neq' | 'in' | 'contains'; value: Primitive | Primitive[] }, ctx: PolicyContext): boolean {
  const left = getPath(ctx, cond.path);
  const right = cond.value;
  if (cond.op === 'eq') return left === right;
  if (cond.op === 'neq') return left !== right;
  if (cond.op === 'in') return Array.isArray(right) ? right.includes(left as any) : false;
  if (cond.op === 'contains') return Array.isArray(left) ? left.includes(right as any) : false;
  return false;
}

function matches(rule: PolicyRule, ctx: PolicyContext): boolean {
  const all = rule.when.all ?? [];
  const any = rule.when.any ?? [];
  const allOk = all.every(c => matchOne(c, ctx));
  const anyOk = any.length === 0 ? true : any.some(c => matchOne(c, ctx));
  return allOk && anyOk;
}

export const policyPlugin: FastifyPluginAsync<PolicyPluginOptions> = async (app, opts) => {
  let bundle: PolicyBundle | null = null;
  let byRuleId = new Map<string, PolicyRule>();
  let loadedAt = 0;

  async function load(): Promise<void> {
    const now = Date.now();
    if (bundle && now - loadedAt < (opts.cacheTtlMs ?? 15_000)) return;

    const obj = await opts.objectStore.get(opts.bucket, opts.key);
    const signed = JSON.parse(Buffer.from(obj.body).toString('utf8')) as SignedBundle;

    const msg = Buffer.from(JSON.stringify(signed.payload));
    const sig = Buffer.from(signed.signatureB64, 'base64');
    const ok = await opts.kms.verify(signed.keyId, msg, sig);
    if (!ok) {
      app.log.error({ bundleId: signed.payload.bundleId }, 'policy signature verification failed');
      throw new Error('policy-bundle-signature-invalid'); // fail-closed
    }

    bundle = signed.payload;
    byRuleId = new Map(bundle.rules.map(r => [r.id, r]));
    loadedAt = now;
    app.log.info({ bundleId: bundle.bundleId, version: bundle.version }, 'policy bundle loaded');
  }

  function evaluate(ruleId: string, ctx: PolicyContext): Decision {
    if (!bundle) {
      return { ruleId, decision: 'deny', obligations: {}, reason: 'bundle-not-loaded' };
    }
    const rule = byRuleId.get(ruleId);
    if (!rule) {
      return { ruleId, decision: 'deny', obligations: {}, reason: 'rule-not-found' };
    }
    if (!matches(rule, ctx)) {
      return { ruleId, decision: 'deny', obligations: {}, reason: 'conditions-not-met' };
    }
    return { ruleId, decision: rule.effect, obligations: rule.obligations ?? {} };
  }

  app.decorate('policy', {
    evaluate,
    reload: load,
    currentBundleId: () => bundle?.bundleId ?? null
  });

  app.addHook('onReady', async () => {
    await load();
  });
};

export const btxPolicyPlugin = fp(policyPlugin, {
  name: '@btx/policy',
  fastify: '4.x'
});

export default btxPolicyPlugin;

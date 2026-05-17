import fp from 'fastify-plugin';
function getPath(obj, path) {
    return path.split('.').reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), obj);
}
function matchOne(cond, ctx) {
    const left = getPath(ctx, cond.path);
    const right = cond.value;
    if (cond.op === 'eq')
        return left === right;
    if (cond.op === 'neq')
        return left !== right;
    if (cond.op === 'in')
        return Array.isArray(right) ? right.includes(left) : false;
    if (cond.op === 'contains')
        return Array.isArray(left) ? left.includes(right) : false;
    return false;
}
function matches(rule, ctx) {
    const all = rule.when.all ?? [];
    const any = rule.when.any ?? [];
    const allOk = all.every(c => matchOne(c, ctx));
    const anyOk = any.length === 0 ? true : any.some(c => matchOne(c, ctx));
    return allOk && anyOk;
}
export const policyPlugin = async (app, opts) => {
    let bundle = null;
    let byRuleId = new Map();
    let loadedAt = 0;
    async function load() {
        const now = Date.now();
        if (bundle && now - loadedAt < (opts.cacheTtlMs ?? 15_000))
            return;
        const obj = await opts.objectStore.get(opts.bucket, opts.key);
        const signed = JSON.parse(Buffer.from(obj.body).toString('utf8'));
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
    function evaluate(ruleId, ctx) {
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
//# sourceMappingURL=index.js.map
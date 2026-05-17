/**
 * Lightweight OTel bootstrap shim.
 * v1 keeps this package tiny and defers SDK wiring to deployment runtime.
 */
export function bootstrapFastifyOtel(app, opts) {
    app.addHook('onRequest', async (req) => {
        const traceId = req.headers['x-trace-id'];
        if (!traceId) {
            req.headers['x-trace-id'] = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        }
    });
    app.log.info({
        service: opts.serviceName,
        version: opts.serviceVersion ?? '0.1.0',
        env: opts.environment ?? process.env.NODE_ENV ?? 'dev'
    }, 'otel bootstrap active');
}
export function kafkaInjectTrace(headers, traceId) {
    return { ...headers, traceparent: `00-${traceId.padEnd(32, '0').slice(0, 32)}-0000000000000001-01`, 'x-trace-id': traceId };
}
export function kafkaExtractTrace(headers) {
    return headers['x-trace-id'] ?? headers['trace_id'] ?? undefined;
}
//# sourceMappingURL=index.js.map
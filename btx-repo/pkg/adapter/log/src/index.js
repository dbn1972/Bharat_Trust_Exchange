export function createConsoleLogger(level = 'info') {
    const ord = { debug: 10, info: 20, warn: 30, error: 40 };
    const min = ord[level];
    const emit = (lvl, obj, msg) => {
        if (ord[lvl] < min)
            return;
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ ts: new Date().toISOString(), level: lvl, msg, ...(typeof obj === 'object' && obj ? obj : { value: obj }) }));
    };
    const self = {
        level,
        info: (o, m) => emit('info', o, m),
        warn: (o, m) => emit('warn', o, m),
        error: (o, m) => emit('error', o, m),
        debug: (o, m) => emit('debug', o, m),
        child: (b) => {
            const c = {
                level,
                info: (o, m) => self.info({ ...b, ...o }, m),
                warn: (o, m) => self.warn({ ...b, ...o }, m),
                error: (o, m) => self.error({ ...b, ...o }, m),
                debug: (o, m) => self.debug({ ...b, ...o }, m),
                child: (b2) => self.child({ ...b, ...b2 })
            };
            return c;
        }
    };
    return self;
}
//# sourceMappingURL=index.js.map
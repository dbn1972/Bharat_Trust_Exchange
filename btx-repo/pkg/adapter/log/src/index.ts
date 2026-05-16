/** Minimal log adapter. Concrete impl uses pino; this file declares the
 *  shape so service code stays decoupled. Compatible with Fastify's logger
 *  contract. */
export interface Logger {
  level?: string;
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  debug: (obj: unknown, msg?: string) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

export function createConsoleLogger(level: 'info' | 'debug' | 'warn' | 'error' = 'info'): Logger {
  const ord = { debug: 10, info: 20, warn: 30, error: 40 } as const;
  const min = ord[level];
  const emit = (lvl: keyof typeof ord, obj: unknown, msg?: string) => {
    if (ord[lvl] < min) return;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: lvl, msg, ...(typeof obj === 'object' && obj ? obj : { value: obj }) }));
  };
  const self: Logger = {
    level,
    info:  (o, m) => emit('info',  o, m),
    warn:  (o, m) => emit('warn',  o, m),
    error: (o, m) => emit('error', o, m),
    debug: (o, m) => emit('debug', o, m),
    child: (b) => {
      const c: Logger = {
        level,
        info:  (o, m) => self.info({ ...b, ...(o as object) }, m),
        warn:  (o, m) => self.warn({ ...b, ...(o as object) }, m),
        error: (o, m) => self.error({ ...b, ...(o as object) }, m),
        debug: (o, m) => self.debug({ ...b, ...(o as object) }, m),
        child: (b2) => self.child({ ...b, ...b2 })
      };
      return c;
    }
  };
  return self;
}

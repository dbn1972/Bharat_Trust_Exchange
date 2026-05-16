import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/healthz', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          service: { type: 'string' }
        },
        required: ['ok', 'service']
      }
    }
  }
}, async () => ({ ok: true, service: 'trust-node' }));

app.post('/v1/federation/sync', {
  schema: {
    body: {
      type: 'object',
      properties: {
        peerNodeId: { type: 'string' },
        cursor: { type: 'string' }
      },
      required: ['peerNodeId']
    },
    response: {
      202: {
        type: 'object',
        properties: {
          accepted: { type: 'boolean' }
        },
        required: ['accepted']
      }
    }
  }
}, async () => {
  return { accepted: true };
});

if (process.env.NODE_ENV !== 'test') {
  app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3003) })
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}

export default app;

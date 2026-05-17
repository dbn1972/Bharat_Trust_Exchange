export const auditAppendedSchema = {
    $id: 'btx.audit.appended.v1',
    type: 'object',
    required: ['event_id', 'event_type', 'schema_version', 'occurred_at', 'actor', 'payload'],
    properties: {
        event_id: { type: 'string' },
        event_type: { type: 'string' },
        schema_version: { type: 'string' },
        occurred_at: { type: 'string', format: 'date-time' },
        actor: {
            type: 'object',
            required: ['type', 'id'],
            properties: {
                type: { type: 'string' },
                id: { type: 'string' }
            }
        },
        subject: {
            type: 'object',
            required: ['type', 'id'],
            properties: {
                type: { type: 'string' },
                id: { type: 'string' }
            }
        },
        trace_id: { type: 'string' },
        payload: { type: 'object', additionalProperties: true }
    }
};
//# sourceMappingURL=schemas.js.map
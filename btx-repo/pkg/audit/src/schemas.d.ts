export declare const auditAppendedSchema: {
    readonly $id: "btx.audit.appended.v1";
    readonly type: "object";
    readonly required: readonly ["event_id", "event_type", "schema_version", "occurred_at", "actor", "payload"];
    readonly properties: {
        readonly event_id: {
            readonly type: "string";
        };
        readonly event_type: {
            readonly type: "string";
        };
        readonly schema_version: {
            readonly type: "string";
        };
        readonly occurred_at: {
            readonly type: "string";
            readonly format: "date-time";
        };
        readonly actor: {
            readonly type: "object";
            readonly required: readonly ["type", "id"];
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                };
                readonly id: {
                    readonly type: "string";
                };
            };
        };
        readonly subject: {
            readonly type: "object";
            readonly required: readonly ["type", "id"];
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                };
                readonly id: {
                    readonly type: "string";
                };
            };
        };
        readonly trace_id: {
            readonly type: "string";
        };
        readonly payload: {
            readonly type: "object";
            readonly additionalProperties: true;
        };
    };
};

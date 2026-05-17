export type Json = null | boolean | number | string | Json[] | {
    [k: string]: Json;
};
export interface ProblemDetails {
    type: string;
    title: string;
    status: number;
    detail?: string;
    instance?: string;
    code?: string;
    trace_id?: string;
}
export declare const nowIso: () => string;

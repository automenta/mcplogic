/**
 * Response types for MCP Logic
 */

/**
 * Verbosity level for responses
 */
export type Verbosity = 'minimal' | 'standard' | 'detailed';

/**
 * Minimal response - just success/failure and result type
 */
export interface MinimalProveResponse {
    success: boolean;
    result: 'proved' | 'failed' | 'timeout' | 'error' | 'syntax_error';
}

/**
 * Standard response - includes message and bindings
 */
export interface StandardProveResponse extends MinimalProveResponse {
    message: string;
    bindings?: Record<string, string>[];
    engineUsed?: string;
    validation?: any; // For syntax errors
}

/**
 * Detailed response - includes debug info
 */
export interface DetailedProveResponse extends StandardProveResponse {
    prologProgram?: string;
    inferenceSteps?: string[];
    statistics?: {
        inferences?: number;
        timeMs: number;
    };
    proof?: string[];
}

/**
 * Union type for Prove responses
 */
export type ProveResponse = MinimalProveResponse | StandardProveResponse | DetailedProveResponse;

/**
 * Result of a proof operation (legacy format, extended for verbosity)
 */
export interface ProveResult {
    success: boolean;
    result: 'proved' | 'failed' | 'timeout' | 'error';
    message?: string;
    proof?: string[];
    bindings?: Record<string, string>[];
    error?: string;
    engineUsed?: string;
    // Detailed mode fields
    prologProgram?: string;
    inferenceSteps?: string[];
    statistics?: {
        inferences?: number;
        timeMs: number;
    };
}

/**
 * Minimal model response
 */
export interface MinimalModelResponse {
    success: boolean;
    result: 'model_found' | 'no_model' | 'timeout' | 'error';
    model?: {
        predicates: Record<string, string[]>;
    };
}

/**
 * Standard model response
 */
export interface StandardModelResponse extends MinimalModelResponse {
    message: string;
    interpretation?: string;
}

/**
 * Detailed model response
 */
export interface DetailedModelResponse extends StandardModelResponse {
    statistics: {
        domainSize: number;
        searchedSizes: number[];
        timeMs: number;
    };
}

/**
 * Union type for Model responses
 */
export type ModelResponse = MinimalModelResponse | StandardModelResponse | DetailedModelResponse;

/**
 * A finite model with domain, predicates, and constant interpretations
 */
export interface Model {
    domainSize: number;
    domain: number[];
    predicates: Map<string, Set<string>>;
    constants: Map<string, number>;
    interpretation: string;
}

/**
 * Result of a model-finding operation
 */
export interface ModelResult {
    success: boolean;
    result: 'model_found' | 'no_model' | 'timeout' | 'error';
    model?: Model;
    interpretation?: string;
    error?: string;
    message?: string;
    // Detailed mode fields
    statistics?: {
        domainSize?: number;
        searchedSizes?: number[];
        timeMs: number;
    };
}

// Session Responses

export interface SessionInfo {
    session_id: string;
    created_at: string;
    expires_at: string;
    ttl_minutes: number;
    active_sessions: number;
}

export interface PremiseAssertResponse {
    success: boolean;
    session_id: string;
    premise_count: number;
    formula_added: string;
    result?: 'syntax_error';
    validation?: any;
}

export interface PremiseRetractResponse {
    success: boolean;
    session_id: string;
    premise_count: number;
    message: string;
}

export interface SessionListResponse {
    session_id: string;
    premise_count: number;
    premises: string[];
    created_at?: string;
    expires_at?: string;
}

export interface SessionClearResponse {
    success: boolean;
    session_id: string;
    message: string;
    premise_count: number;
}

export interface SessionDeleteResponse {
    success: boolean;
    message: string;
    active_sessions: number;
}

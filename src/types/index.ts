/**
 * Shared type definitions for MCP Logic
 */

/**
 * Result of a proof operation
 */
export interface ProveResult {
    success: boolean;
    result: 'proved' | 'failed' | 'timeout' | 'error';
    proof?: string[];
    bindings?: Record<string, string>[];
    error?: string;
}

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
}

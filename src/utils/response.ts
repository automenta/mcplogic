import { ProveResult, Verbosity } from '../types/index.js';

export interface BaseResultData {
    success: boolean;
    result: 'proved' | 'failed' | 'timeout' | 'error';
    message?: string;
    error?: string;
    proof?: string[];
    bindings?: Record<string, string>[];
    prologProgram?: string;
    timeMs: number;
    inferenceCount?: number;
    clauseCount?: number;
    varCount?: number;
    inferenceSteps?: string[];
}

/**
 * Build a standardized ProveResult based on verbosity level.
 * Shared between Prolog and SAT engines.
 */
export function buildProveResult(
    data: BaseResultData,
    verbosity: Verbosity
): ProveResult {
    const base: ProveResult = {
        found: data.result === 'proved',
        success: data.success,
        result: data.result,
    };

    if (verbosity === 'minimal') {
        return base;
    }

    // Standard includes message, bindings, error, proof
    base.message = data.message;
    base.bindings = data.bindings;
    base.error = data.error;
    base.proof = data.proof;

    // Include trace if present (regardless of verbosity if explicitly provided in data)
    if (data.inferenceSteps) {
        base.inferenceSteps = data.inferenceSteps;
    }

    if (verbosity === 'detailed') {
        base.prologProgram = data.prologProgram;
        base.statistics = {
            timeMs: data.timeMs,
            inferences: data.inferenceCount ?? data.clauseCount,
        };
    }

    return base;
}

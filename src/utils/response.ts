import {
    ProveResult,
    Verbosity,
    ProveResponse,
    MinimalProveResponse,
    StandardProveResponse,
    DetailedProveResponse,
    ModelResult,
    ModelResponse,
    MinimalModelResponse,
    StandardModelResponse,
    DetailedModelResponse,
    Model
} from '../types/index.js';

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

/**
 * Build response based on verbosity level
 */
export function buildProveResponse(result: ProveResult, verbosity: Verbosity = 'standard'): ProveResponse {
    if (verbosity === 'minimal') {
        const response: MinimalProveResponse = {
            success: result.success,
            result: result.result,
        };
        return response;
    }

    if (verbosity === 'standard') {
        const response: StandardProveResponse = {
            success: result.success,
            result: result.result,
            message: result.message || (result.success ? 'Proof found' : result.error || 'No proof found'),
            ...(result.bindings && { bindings: result.bindings }),
            ...(result.engineUsed && { engineUsed: result.engineUsed }),
            ...(result.strategyUsed && { strategyUsed: result.strategyUsed }),
        };
        return response;
    }

    // detailed
    const response: DetailedProveResponse = {
        success: result.success,
        result: result.result,
        message: result.message || (result.success ? 'Proof found' : result.error || 'No proof found'),
        ...(result.bindings && { bindings: result.bindings }),
        ...(result.engineUsed && { engineUsed: result.engineUsed }),
        ...(result.strategyUsed && { strategyUsed: result.strategyUsed }),
        prologProgram: result.prologProgram || '',
        ...(result.inferenceSteps && { inferenceSteps: result.inferenceSteps }),
        statistics: result.statistics || { timeMs: 0 },
        ...(result.proof && { proof: result.proof }),
    };
    return response;
}

/**
 * Build model response based on verbosity level
 */
export function buildModelResponse(result: ModelResult, verbosity: Verbosity = 'standard'): ModelResponse {
    // Convert model predicates to serializable format
    const serializeModel = (model: ModelResult['model']) => {
        if (!model) return undefined;
        const predicates: Record<string, string[]> = {};
        for (const [name, tuples] of model.predicates) {
            predicates[name] = Array.from(tuples);
        }
        return {
            domainSize: model.domainSize,
            domain: model.domain,
            predicates,
            constants: Object.fromEntries(model.constants),
        };
    };

    if (verbosity === 'minimal') {
        const response: MinimalModelResponse = {
            success: result.success,
            result: result.result,
            ...(result.model && {
                model: {
                    predicates: (() => {
                        const p: Record<string, string[]> = {};
                        for (const [name, tuples] of result.model.predicates) {
                            p[name] = Array.from(tuples);
                        }
                        return p;
                    })()
                }
            }),
        };
        return response;
    }

    if (verbosity === 'standard') {
        const response: StandardModelResponse = {
            success: result.success,
            result: result.result,
            message: result.message || (result.success ? 'Model found' : result.error || 'No model found'),
            ...(result.model && { model: serializeModel(result.model) }),
            ...(result.interpretation && { interpretation: result.interpretation }),
        };
        return response;
    }

    // detailed
    const response: DetailedModelResponse = {
        success: result.success,
        result: result.result,
        message: result.message || (result.success ? 'Model found' : result.error || 'No model found'),
        ...(result.model && { model: serializeModel(result.model) }),
        ...(result.interpretation && { interpretation: result.interpretation }),
        statistics: {
            domainSize: result.statistics?.domainSize ?? 0,
            searchedSizes: result.statistics?.searchedSizes ?? [],
            timeMs: result.statistics?.timeMs ?? 0
        },
    };
    return response;
}

/**
 * Format model as human-readable string
 */
export function formatModelString(model: Model): string {
    const lines: string[] = [];
    lines.push(`Domain size: ${model.domainSize}`);
    lines.push(`Domain: {${model.domain.join(', ')}}`);

    if (model.constants.size > 0) {
        lines.push('Constants:');
        for (const [name, value] of model.constants) {
            lines.push(`  ${name} = ${value}`);
        }
    }

    if (model.functions.size > 0) {
        lines.push('Functions:');
        for (const [name, table] of model.functions) {
            const entries = Array.from(table.entries())
                .map(([args, val]) => `(${args})->${val}`)
                .join(', ');
            lines.push(`  ${name}: {${entries}}`);
        }
    }

    lines.push('Predicates:');
    for (const [name, extension] of model.predicates) {
        const tuples = Array.from(extension).map(s => `(${s})`).join(', ');
        lines.push(`  ${name}: {${tuples}}`);
    }

    return lines.join('\n');
}

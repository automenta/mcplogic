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
    DetailedModelResponse
} from '../types/index.js';

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

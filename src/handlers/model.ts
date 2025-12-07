import {
    ModelResult,
    Verbosity,
    ModelResponse,
    MinimalModelResponse,
    StandardModelResponse,
    DetailedModelResponse
} from '../types/index.js';
import { ModelFinder, createModelFinder } from '../modelFinder.js';

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
        statistics: result.statistics || { domainSize: 0, searchedSizes: [], timeMs: 0 },
    };
    return response;
}

export async function findModelHandler(
    args: {
        premises: string[];
        domain_size?: number;
        max_domain_size?: number;
    },
    defaultFinder: ModelFinder,
    verbosity: Verbosity
): Promise<ModelResponse> {
    const { premises, domain_size, max_domain_size } = args;
    // Create finder with custom max domain size if specified
    const finder = max_domain_size ? createModelFinder(undefined, max_domain_size) : defaultFinder;
    const modelResult = await finder.findModel(premises, domain_size);
    return buildModelResponse(modelResult, verbosity);
}

export async function findCounterexampleHandler(
    args: {
        premises: string[];
        conclusion: string;
        domain_size?: number;
        max_domain_size?: number;
    },
    defaultFinder: ModelFinder,
    verbosity: Verbosity
): Promise<ModelResponse> {
    const { premises, conclusion, domain_size, max_domain_size } = args;
    // Create finder with custom max domain size if specified
    const finder = max_domain_size ? createModelFinder(undefined, max_domain_size) : defaultFinder;
    const modelResult = await finder.findCounterexample(premises, conclusion, domain_size);
    return buildModelResponse(modelResult, verbosity);
}

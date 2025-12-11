import {
    Verbosity,
    ModelResponse,
} from '../types/index.js';
import { ModelFinder, createModelFinder } from '../modelFinder.js';
import { buildModelResponse } from './utils.js';

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
    // findModel expects domainSize (camelCase), but args has domain_size (snake_case)
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

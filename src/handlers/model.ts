import {
    Verbosity,
    ModelResponse,
} from '../types/index.js';
import { ModelFinder } from '../modelFinder.js';
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
    // Pass max_domain_size as option to findModel
    const modelResult = await defaultFinder.findModel(premises, domain_size, { maxDomainSize: max_domain_size });
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
    // Pass max_domain_size as option to findCounterexample
    const modelResult = await defaultFinder.findCounterexample(premises, conclusion, domain_size, { maxDomainSize: max_domain_size });
    return buildModelResponse(modelResult, verbosity);
}

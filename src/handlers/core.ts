import {
    Verbosity,
    ProveResponse,
    ModelResponse, // Added for findModelHandler
} from '../types/index.js';
import { validateFormulas, ValidationReport } from '../syntaxValidator.js';
import { EngineManager, EngineSelection } from '../engines/manager.js';
import { ModelFinder } from '../modelFinder.js'; // Added for findModelHandler
import { buildProveResponse, buildModelResponse } from './utils.js'; // Added buildModelResponse for findModelHandler

export async function proveHandler(
    args: {
        premises: string[];
        conclusion: string;
        inference_limit?: number;
        enable_arithmetic?: boolean;
        enable_equality?: boolean;
        engine?: EngineSelection;
        strategy?: 'auto' | 'breadth' | 'depth' | 'iterative';
        include_trace?: boolean;
    },
    engineManager: EngineManager,
    verbosity: Verbosity,
    onProgress?: (progress: number | undefined, message: string) => void
): Promise<ProveResponse | { result: 'syntax_error'; validation: ValidationReport }> {
    const { premises, conclusion, enable_arithmetic, enable_equality, engine: engineParam, strategy, inference_limit, include_trace } = args;

    // Validate syntax first
    const allFormulas = [...premises, conclusion];
    const validation = validateFormulas(allFormulas);

    if (!validation.valid) {
        return { result: 'syntax_error', validation };
    }

    // Use engineManager for engine-federated proving
    const proveResult = await engineManager.prove(premises, conclusion, {
        verbosity,
        enableArithmetic: enable_arithmetic,
        enableEquality: enable_equality,
        engine: engineParam ?? 'auto',
        strategy: strategy ?? 'auto',
        maxInferences: inference_limit,
        includeTrace: include_trace,
        onProgress
    });

    // engineUsed is now handled in buildProveResponse
    return buildProveResponse(proveResult, verbosity);
}

export function checkWellFormedHandler(
    args: { statements: string[] }
): ValidationReport {
    const { statements } = args;
    return validateFormulas(statements);
}

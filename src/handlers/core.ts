import {
    ProveResult,
    Verbosity,
    EngineSelection,
    ProveResponse,
    MinimalProveResponse,
    StandardProveResponse,
    DetailedProveResponse
} from '../types/index.js';
import { validateFormulas, ValidationReport } from '../syntaxValidator.js';
import { EngineManager } from '../engines/manager.js';

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
        prologProgram: result.prologProgram || '',
        ...(result.inferenceSteps && { inferenceSteps: result.inferenceSteps }),
        statistics: result.statistics || { timeMs: 0 },
        ...(result.proof && { proof: result.proof }),
    };
    return response;
}

export async function proveHandler(
    args: {
        premises: string[];
        conclusion: string;
        inference_limit?: number;
        enable_arithmetic?: boolean;
        enable_equality?: boolean;
        engine?: EngineSelection;
    },
    engineManager: EngineManager,
    verbosity: Verbosity
): Promise<ProveResponse | { result: 'syntax_error'; validation: ValidationReport }> {
    const { premises, conclusion, enable_arithmetic, enable_equality, engine: engineParam } = args;

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

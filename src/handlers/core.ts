import {
    ProveResult,
    Verbosity,
    EngineSelection
} from '../types/index.js';
import { validateFormulas } from '../syntaxValidator.js';
import { EngineManager } from '../engines/manager.js';

/**
 * Build response based on verbosity level
 */
export function buildProveResponse(result: ProveResult, verbosity: Verbosity = 'standard'): object {
    if (verbosity === 'minimal') {
        return {
            success: result.success,
            result: result.result,
        };
    }

    if (verbosity === 'standard') {
        return {
            success: result.success,
            result: result.result,
            message: result.message || (result.success ? 'Proof found' : result.error || 'No proof found'),
            ...(result.bindings && { bindings: result.bindings }),
        };
    }

    // detailed
    return {
        success: result.success,
        result: result.result,
        message: result.message || (result.success ? 'Proof found' : result.error || 'No proof found'),
        ...(result.bindings && { bindings: result.bindings }),
        ...(result.prologProgram && { prologProgram: result.prologProgram }),
        ...(result.inferenceSteps && { inferenceSteps: result.inferenceSteps }),
        ...(result.statistics && { statistics: result.statistics }),
        ...(result.proof && { proof: result.proof }),
    };
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
): Promise<object> {
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

    // Include engineUsed in response for standard/detailed verbosity
    const response = buildProveResponse(proveResult, verbosity);
    if (verbosity !== 'minimal' && proveResult.engineUsed) {
        (response as any).engineUsed = proveResult.engineUsed;
    }
    return response;
}

export function checkWellFormedHandler(
    args: { statements: string[] }
): object {
    const { statements } = args;
    return validateFormulas(statements);
}

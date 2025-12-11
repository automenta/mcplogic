import {
    Verbosity,
    ProveResponse,
} from '../types/index.js';
import { validateFormulas, ValidationReport } from '../syntaxValidator.js';
import { EngineManager, EngineSelection } from '../engines/manager.js';
import { buildProveResponse } from './utils.js';

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

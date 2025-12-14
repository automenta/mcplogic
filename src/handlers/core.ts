import {
    Verbosity,
    ProveResponse,
    ModelResponse,
    DEFAULTS, // Added DEFAULTS for highPower logic
} from '../types/index.js';
import { validateFormulas, ValidationReport } from '../syntaxValidator.js';
import { EngineManager, EngineSelection } from '../engines/manager.js';
import { ModelFinder } from '../modelFinder.js';
import { buildProveResponse, buildModelResponse } from './utils.js';

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
        highPower?: boolean;
    },
    engineManager: EngineManager,
    verbosity: Verbosity,
    onProgress?: (progress: number | undefined, message: string) => void
): Promise<ProveResponse | { result: 'syntax_error'; validation: ValidationReport }> {
    const { premises, conclusion, enable_arithmetic, enable_equality, engine: engineParam, strategy, inference_limit, include_trace, highPower } = args;

    // Validate syntax first
    const allFormulas = [...premises, conclusion];
    const validation = validateFormulas(allFormulas);

    if (!validation.valid) {
        return { result: 'syntax_error', validation };
    }

    // Apply high-power mode limits if requested
    const effectiveInferenceLimit = highPower
        ? DEFAULTS.highPowerMaxInferences
        : (inference_limit ?? DEFAULTS.maxInferences);

    // Note: maxSeconds is not directly passed to prove() in current signature,
    // but EngineManager usually takes timeout in constructor or we might need to update EngineManager prove options?
    // Looking at EngineManager.prove signature:
    // async prove(premises, conclusion, options: ProveOptions)
    // ProveOptions has maxSeconds.

    const effectiveTimeout = highPower
        ? DEFAULTS.highPowerMaxSeconds
        : DEFAULTS.maxSeconds;

    // Use engineManager for engine-federated proving
    const proveResult = await engineManager.prove(premises, conclusion, {
        verbosity,
        enableArithmetic: enable_arithmetic,
        enableEquality: enable_equality,
        engine: engineParam ?? 'auto',
        strategy: strategy ?? 'auto',
        maxInferences: effectiveInferenceLimit,
        maxSeconds: effectiveTimeout,
        includeTrace: include_trace,
        onProgress
    });

    return buildProveResponse(proveResult, verbosity);
}

export function checkWellFormedHandler(
    args: { statements: string[] }
): ValidationReport {
    const { statements } = args;
    return validateFormulas(statements);
}

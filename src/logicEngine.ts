/**
 * Logic Engine: Tau-Prolog wrapper for theorem proving
 * 
 * Provides async interface for proving and model finding using Tau-Prolog.
 */

import pl, { Session } from 'tau-prolog';

import { buildPrologProgram, folGoalToProlog } from './translator.js';
import { getArithmeticSetup } from './axioms/arithmetic.js';
import { parse } from './parser.js';
import { extractSignature } from './utils/ast.js';
import {
    generateEqualityAxioms,
    generateMinimalEqualityAxioms,
    getEqualityBridge
} from './axioms/equality.js';
import {
    ProveResult,
    Verbosity,
    createInferenceLimitError,
    createEngineError,
} from './types/index.js';
import { buildProveResult } from './utils/response.js';
import { consultProgram, runPrologQuery } from './engines/prologUtils.js';

export type { ProveResult };

/**
 * Options for prove operation
 */
export interface ProveOptions {
    verbosity?: Verbosity;
    /** Enable arithmetic support (default: false) */
    enableArithmetic?: boolean;
    /** Enable equality axioms (default: false) */
    enableEquality?: boolean;
}

/**
 * Logic Engine using Tau-Prolog
 */
export class LogicEngine {
    private session: Session;
    private inferenceLimit: number;

    /**
     * @param _timeout Timeout in milliseconds (reserved for future use)
     * @param inferenceLimit Maximum inference steps before giving up (default: 1000)
     */
    constructor(_timeout: number = 5000, inferenceLimit: number = 1000) {
        this.inferenceLimit = inferenceLimit;
        this.session = pl.create(this.inferenceLimit);
    }

    /**
     * Prove a goal from given premises
     */
    async prove(
        premises: string[],
        conclusion: string,
        options?: ProveOptions
    ): Promise<ProveResult> {
        const startTime = Date.now();
        const verbosity = options?.verbosity || 'standard';
        let prologProgram = '';
        let inferenceCount = 0;
        let hitInferenceLimit = false;

        try {
            // Build program from premises
            // We pass enableEquality option to translator so it uses eq/2 instead of =/2
            prologProgram = buildPrologProgram(premises, { enableEquality: options?.enableEquality });

            // Add arithmetic axioms if enabled
            if (options?.enableArithmetic) {
                prologProgram = this.setupArithmetic(prologProgram);
            }

            // Add equality axioms if enabled
            if (options?.enableEquality) {
                prologProgram = this.setupEquality(prologProgram, premises, conclusion);
            }

            // Create fresh session with configured inference limit
            this.session = pl.create(this.inferenceLimit);

            // Consult the program
            const consultResult = await consultProgram(this.session, prologProgram);
            if (!consultResult.success) {
                return buildProveResult({
                    success: false,
                    result: 'error',
                    error: consultResult.error,
                    prologProgram,
                    timeMs: Date.now() - startTime,
                }, verbosity);
            }

            // Build query from conclusion
            // Pass enableEquality to translator
            const query = folGoalToProlog(conclusion, { enableEquality: options?.enableEquality });

            // Run query
            const queryResult = await runPrologQuery(this.session, query);

            if (queryResult.hitLimit) {
                hitInferenceLimit = true;
            }

            if (queryResult.found) {
                return buildProveResult({
                    success: true,
                    result: 'proved',
                    message: `Proved: ${conclusion}`,
                    proof: [
                        `Goal: ${conclusion}`,
                        `Program: ${premises.join('; ')}`,
                        `Result: Proved via Prolog resolution`
                    ],
                    bindings: queryResult.bindings,
                    prologProgram,
                    timeMs: Date.now() - startTime,
                    inferenceCount,
                }, verbosity);
            } else {
                // If we hit the limit, use structured error
                if (hitInferenceLimit) {
                    const error = createInferenceLimitError(this.inferenceLimit, conclusion);
                    return buildProveResult({
                        success: false,
                        result: 'failed',
                        message: error.message,
                        error: error.message,
                        prologProgram,
                        timeMs: Date.now() - startTime,
                        inferenceCount: this.inferenceLimit,
                    }, verbosity);
                }

                return buildProveResult({
                    success: false,
                    result: 'failed',
                    message: 'No proof found',
                    error: queryResult.error || 'No proof found',
                    prologProgram,
                    timeMs: Date.now() - startTime,
                    inferenceCount,
                }, verbosity);
            }
        } catch (e) {
            const error = e instanceof Error ? e : createEngineError(String(e));
            return buildProveResult({
                success: false,
                result: 'error',
                error: error.message,
                prologProgram,
                timeMs: Date.now() - startTime,
                inferenceCount,
            }, verbosity);
        }
    }

    /**
     * Setup arithmetic axioms
     */
    private setupArithmetic(program: string): string {
        const arithmeticSetup = getArithmeticSetup();
        return arithmeticSetup + '\n' + program;
    }

    /**
     * Setup equality axioms
     */
    private setupEquality(program: string, premises: string[], conclusion: string): string {
        try {
            const bridge = getEqualityBridge();
            // Always include base equality axioms (reflexivity, symmetry, transitivity)
            const emptySignature = extractSignature([]);
            const baseAxioms = generateEqualityAxioms(emptySignature, {
                includeCongruence: false,
                includeSubstitution: false
            });

            // Add signature-specific axioms (congruence, substitution) only when = is used
            const parsedFormulas = [...premises, conclusion].map(p => parse(p));
            const signatureAxioms = generateMinimalEqualityAxioms(parsedFormulas);

            const allAxioms = [...bridge, ...baseAxioms, ...signatureAxioms];
            return allAxioms.join('\n') + '\n' + program;
        } catch {
            // If parsing fails for equality extraction, continue without equality axioms
            // The main validation will catch syntax errors
            return program;
        }
    }

    /**
     * Check if premises are satisfiable (can find a model)
     */
    async checkSatisfiability(premises: string[]): Promise<boolean> {
        try {
            // Note: checkSatisfiability usually assumes default options (no special equality handling)
            // or we could add options here too. For now, we assume default (strict equality).
            const program = buildPrologProgram(premises);
            this.session = pl.create(this.inferenceLimit);

            const result = await consultProgram(this.session, program);
            return result.success;
        } catch {
            return false;
        }
    }
}

/**
 * Create a new logic engine instance
 * @param timeout Timeout in milliseconds (reserved for future use)
 * @param inferenceLimit Maximum inference steps (default: 1000)
 */
export function createLogicEngine(timeout?: number, inferenceLimit?: number): LogicEngine {
    return new LogicEngine(timeout, inferenceLimit);
}

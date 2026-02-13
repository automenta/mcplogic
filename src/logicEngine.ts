/**
 * Logic Engine: Tau-Prolog wrapper for theorem proving
 * 
 * Provides async interface for proving and model finding using Tau-Prolog.
 */

import pl from 'tau-prolog';
import { PrologSession, consult, query } from './engines/prologUtils.js';

type Session = PrologSession;

import { buildPrologProgram, folGoalToProlog } from './translator.js';
import { getArithmeticSetup } from './axioms/arithmetic.js';
import { parse } from './parser.js';
import { extractSignature } from './utils/ast.js';
import {
    generateMinimalEqualityAxioms,
    getEqualityBridge
} from './axioms/equality.js';
import {
    ProveResult,
    createInferenceLimitError,
    createEngineError,
} from './types/index.js';
import { buildProveResult } from './utils/response.js';
import { ProveOptions } from './types/options.js';
import { META_INTERPRETER, generateDynamicDirectives, parseTraceOutput } from './utils/trace.js';

// Re-export ProveOptions to ensure it's used correctly by consumers
export type { ProveResult, ProveOptions };

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
        if (options?.strategy === 'iterative') {
            return this.proveIterative(premises, conclusion, options);
        }

        const startTime = Date.now();
        const verbosity = options?.verbosity || 'standard';
        let prologProgram = '';
        let inferenceCount = 0;
        let hitInferenceLimit = false;
        let trace: string[] | undefined;
        const traceState = { buffer: '' };

        try {
            // Build program from premises
            prologProgram = buildPrologProgram(premises, { enableEquality: options?.enableEquality });

            // Add arithmetic axioms if enabled
            if (options?.enableArithmetic) {
                prologProgram = this.setupArithmetic(prologProgram);
            }

            // Add equality axioms if enabled
            if (options?.enableEquality) {
                prologProgram = this.setupEquality(prologProgram, premises, conclusion);
            }

            // Use configured limit or default to constructor limit
            const limit = options?.maxInferences ?? this.inferenceLimit;
            this.session = pl.create(limit);

            // Add directive to make unknown predicates fail instead of error
            // This enables closed-world assumption for tautology checking
            prologProgram = ':- set_prolog_flag(unknown, fail).\n' + prologProgram;

            // Setup trace if requested
            if (options?.includeTrace) {
                const parsedPremises = premises.map(p => parse(p));
                const signature = extractSignature(parsedPremises);
                const dynamicDirectives = generateDynamicDirectives(signature);

                prologProgram = dynamicDirectives + '\n' + META_INTERPRETER + '\n' + prologProgram;

                // Replace output streams entirely to ensure capture
                const outputStream = {
                    put: (char: string | number, _encoding: any) => {
                        const str = typeof char === 'number' ? String.fromCharCode(char) : char;
                        traceState.buffer += str;
                    },
                    flush: () => { }
                };

                (this.session as any).standard_output = outputStream;

                const streams = (this.session as any).streams;
                if (streams) {
                    ['standard_output', 'current_output', 'user_output'].forEach(alias => {
                        if (streams[alias]) {
                            streams[alias].put = outputStream.put;
                        }
                    });
                }
            }

            // Consult the program
            const consultResult = await consult(this.session, prologProgram);

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
            let queryGoal = folGoalToProlog(conclusion, { enableEquality: options?.enableEquality });

            if (options?.includeTrace) {
                const queryTerm = queryGoal.endsWith('.') ? queryGoal.slice(0, -1) : queryGoal;
                queryGoal = `trace_goal(${queryTerm}).`;
            }

            // Run query
            const queryResult = await query(this.session, queryGoal);

            if (options?.includeTrace) {
                trace = parseTraceOutput(traceState.buffer);
            }

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
                    inferenceSteps: trace,
                }, verbosity);
            } else {
                // If we hit the limit, use structured error
                if (hitInferenceLimit) {
                    const error = createInferenceLimitError(limit, conclusion);
                    return buildProveResult({
                        success: false,
                        result: 'failed',
                        message: error.message,
                        error: error.message,
                        prologProgram,
                        timeMs: Date.now() - startTime,
                        inferenceCount: limit,
                        inferenceSteps: trace,
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
                    inferenceSteps: trace,
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
                inferenceSteps: trace,
            }, verbosity);
        }
    }

    /**
     * Iterative deepening proof strategy
     */
    async proveIterative(
        premises: string[],
        conclusion: string,
        options?: ProveOptions
    ): Promise<ProveResult> {
        const maxInf = options?.maxInferences ?? 50000;
        const maxSec = options?.maxSeconds ?? 30;
        const start = Date.now();
        const limits = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000].filter(l => l <= maxInf);

        // Ensure at least one attempt if maxInf is small
        if (limits.length === 0 || limits[limits.length - 1] < maxInf) {
            limits.push(maxInf);
        }

        for (const [index, limit] of limits.entries()) {
            if (options?.onProgress) {
                options.onProgress((index) / limits.length, `Trying inference limit: ${limit}`);
            }

            if (Date.now() - start > maxSec * 1000) {
                return buildProveResult({
                    success: false,
                    result: 'timeout',
                    message: `Timeout after ${Math.round((Date.now() - start) / 1000)}s`,
                    timeMs: Date.now() - start
                }, options?.verbosity ?? 'standard');
            }

            const result = await this.prove(premises, conclusion, { ...options, maxInferences: limit, strategy: undefined }); // prevent recursion

            if (result.result === 'proved') {
                if (options?.onProgress) {
                    options.onProgress(1.0, 'Proof found');
                }
                return result;
            }

            // If it didn't hit limit (definite failure) or error, we can stop early
            const isLimitError = result.message?.includes('limit');
            if (!isLimitError && result.result === 'failed') {
                if (options?.onProgress) {
                    options.onProgress(1.0, 'Disproved (definite failure)');
                }
                return result;
            }
        }

        return buildProveResult({
            success: false,
            result: 'failed',
            message: `No proof found within ${maxInf} inferences`,
            timeMs: Date.now() - start
        }, options?.verbosity ?? 'standard');
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
            // Add signature-specific axioms (congruence, substitution) only when = is used
            const parsedFormulas = [...premises, conclusion].map(p => parse(p));
            const equalityAxioms = generateMinimalEqualityAxioms(parsedFormulas);

            // Only add bridge if we have equality axioms
            if (equalityAxioms.length === 0) {
                return program;
            }

            const bridge = getEqualityBridge();
            const allAxioms = [...bridge, ...equalityAxioms];
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
            const program = buildPrologProgram(premises);
            this.session = pl.create(this.inferenceLimit);

            const result = await consult(this.session, program);
            return result.success;
        } catch {
            return false;
        }
    }

    /**
     * Check satisfiability of a raw Prolog program (list of clauses)
     *
     * Treats facts/rules as program and :- directives as constraints.
     * If any constraint is provable (query succeeds), the set is UNSAT (returns false).
     */
    async checkPrologSatisfiability(programClauses: string[]): Promise<boolean> {
        const definiteClauses = programClauses.filter(c => !c.trim().startsWith(':-'));
        const constraints = programClauses.filter(c => c.trim().startsWith(':-'));

        try {
            const program = definiteClauses.join('\n');
            this.session = pl.create(this.inferenceLimit);

            // 1. Consult definite clauses
            const consultResult = await consult(this.session, program);
            if (!consultResult.success) return false;

            // 2. Check each constraint
            for (const constraint of constraints) {
                // constraint is ":- p, q." -> goal "p, q."
                const goal = constraint.trim().substring(2, constraint.trim().length - 1) + ".";
                if (goal === ".") continue; // Empty constraint?

                const result = await query(this.session, goal);
                if (result.found) {
                    // Contradiction derived!
                    return false;
                }
            }

            return true; // No contradiction found
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

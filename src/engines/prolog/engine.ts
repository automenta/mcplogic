/**
 * Logic Engine: Tau-Prolog wrapper for theorem proving
 * 
 * Provides async interface for proving and model finding using Tau-Prolog.
 */

import { buildPrologProgram, folGoalToProlog } from './translator.js';
import { getArithmeticSetup } from '../../axioms/arithmetic.js';
import { parse } from '../../parser/index.js';
import { extractSignature } from '../../ast/index.js';
import {
    generateMinimalEqualityAxioms,
    getEqualityBridge
} from '../../axioms/equality.js';
import { generateRewritingAxioms } from '../../logic/equality/rewriting.js';
import {
    ProveResult,
    createInferenceLimitError,
    createEngineError,
} from '../../types/index.js';
import { clausify } from '../../logic/clausifier.js';
import { buildProveResult } from '../../utils/response.js';
import { ProveOptions } from '../../types/options.js';
import { META_INTERPRETER, generateDynamicDirectives, parseTraceOutput } from './trace.js';
import { TauPrologAdapter } from './adapter.js';

// Re-export ProveOptions to ensure it's used correctly by consumers
export type { ProveResult, ProveOptions };

/**
 * Logic Engine using Tau-Prolog
 */
export class LogicEngine {
    private inferenceLimit: number;

    /**
     * @param inferenceLimit Maximum inference steps before giving up (default: 1000)
     */
    constructor(inferenceLimit: number = 1000) {
        this.inferenceLimit = inferenceLimit;
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
            const adapter = new TauPrologAdapter(limit);

            // Add directive to make unknown predicates fail instead of error
            // This enables closed-world assumption for tautology checking
            prologProgram = ':- set_prolog_flag(unknown, fail).\n' + prologProgram;

            // Setup trace if requested
            if (options?.includeTrace) {
                const parsedPremises = premises.map(p => parse(p));
                const signature = extractSignature(parsedPremises);
                const dynamicDirectives = generateDynamicDirectives(signature);

                prologProgram = dynamicDirectives + '\n' + META_INTERPRETER + '\n' + prologProgram;

                adapter.setStandardOutput((str) => {
                    traceState.buffer += str;
                });
            }

            // Consult the program
            const consultResult = await adapter.consult(prologProgram);

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
            const queryResult = await adapter.query(queryGoal);

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
            const parsedFormulas = [...premises, conclusion].map(p => parse(p));

            // Convert premises to clauses to get proper Skolem constants for rewriting
            // Only use premises for rewrite rules, not the conclusion (goal)
            const allClauses = premises.flatMap(p => clausify(p).clauses || []);

            // Use improved rewriting logic (Knuth-Bendix style) which handles congruence dynamically
            const rewritingAxioms = generateRewritingAxioms(allClauses);

            if (rewritingAxioms.length > 0) {
                // If rewriting generated rules, we append them.
                // However, rewrite rules involving variables can cause infinite loops.
                // It's safer to ensure standard transitivity and symmetry are also available
                // for general proving, or just rely on minimal axioms.
                return rewritingAxioms.join('\n') + '\n' + program;
            }

            // Fallback to minimal equality axioms + bridge.
            // But standard minimal equality axioms might not include transitivity explicitly in a way
            // that Prolog can use safely without looping, but we must add them to allow basic eq reasoning.
            const equalityAxioms = generateMinimalEqualityAxioms(parsedFormulas);
            const bridge = getEqualityBridge();

            // Inject standard equality rules to support `a=b, b=c |- a=c` when rewritten rules fail
            const standardEqAxioms = [
                'eq(X, X).',
                'eq(X, Y) :- eq_fact(X, Y).',
                'eq(X, Y) :- eq_fact(Y, X).',
                'eq(X, Z) :- eq_fact(X, Y), eq(Y, Z).'
            ];

            const allAxioms = [...bridge, ...standardEqAxioms, ...equalityAxioms];
            return allAxioms.join('\n') + '\n' + program;
        } catch {
            return program;
        }
    }

    /**
     * Check if premises are satisfiable (can find a model)
     */
    async checkSatisfiability(premises: string[]): Promise<boolean> {
        try {
            const program = buildPrologProgram(premises);
            const adapter = new TauPrologAdapter(this.inferenceLimit);

            const result = await adapter.consult(program);
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
            const adapter = new TauPrologAdapter(this.inferenceLimit);

            // 1. Consult definite clauses
            const consultResult = await adapter.consult(program);
            if (!consultResult.success) return false;

            // 2. Check each constraint
            for (const constraint of constraints) {
                // constraint is ":- p, q." -> goal "p, q."
                const goal = constraint.trim().substring(2, constraint.trim().length - 1) + ".";
                if (goal === ".") continue; // Empty constraint?

                const result = await adapter.query(goal);
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
 * @param inferenceLimit Maximum inference steps (default: 1000)
 */
export function createLogicEngine(inferenceLimit?: number): LogicEngine {
    return new LogicEngine(inferenceLimit);
}

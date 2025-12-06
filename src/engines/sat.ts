/**
 * SAT Engine
 * 
 * SAT solver backend using the logic-solver package (MiniSat compiled to JS).
 * Handles arbitrary propositional CNF formulas.
 */

import Logic from 'logic-solver';
import { Clause } from '../types/clause.js';
import { ProveResult, Verbosity } from '../types/index.js';
import { clausify, isHornFormula } from '../clausifier.js';
import {
    ReasoningEngine,
    EngineCapabilities,
    EngineProveOptions,
    SatResult
} from './interface.js';

/**
 * SAT solver-based reasoning engine.
 * Uses the logic-solver package (MiniSat in JS).
 * 
 * Handles arbitrary CNF formulas including non-Horn clauses.
 * For theorem proving, uses refutation: premises ∧ ¬conclusion is UNSAT → theorem holds.
 */
export class SATEngine implements ReasoningEngine {
    readonly name = 'sat/minisat';
    readonly capabilities: EngineCapabilities = {
        horn: true,
        fullFol: true,  // Handles arbitrary CNF (after grounding)
        equality: false, // No built-in equality
        arithmetic: false, // No built-in arithmetic
        streaming: false,
    };

    /**
     * Convert a literal to a unique string key for the SAT solver.
     */
    private literalToKey(lit: { predicate: string; args: string[] }): string {
        if (lit.args.length === 0) {
            return lit.predicate;
        }
        return `${lit.predicate}(${lit.args.join(',')})`;
    }

    /**
     * Check satisfiability of clauses using the SAT solver.
     */
    async checkSat(clauses: Clause[]): Promise<SatResult> {
        const startTime = Date.now();

        if (clauses.length === 0) {
            return {
                sat: true,
                model: new Map(),
                statistics: {
                    timeMs: Date.now() - startTime,
                    variables: 0,
                    clauses: 0,
                },
            };
        }

        try {
            const solver = new Logic.Solver();
            const variables = new Set<string>();

            // Convert each clause to logic-solver format
            for (const clause of clauses) {
                if (clause.literals.length === 0) {
                    // Empty clause = unsatisfiable
                    return {
                        sat: false,
                        statistics: {
                            timeMs: Date.now() - startTime,
                            variables: variables.size,
                            clauses: clauses.length,
                        },
                    };
                }

                const disjuncts = clause.literals.map(lit => {
                    const key = this.literalToKey(lit);
                    variables.add(key);
                    return lit.negated ? Logic.not(key) : key;
                });

                // Add the clause as a disjunction
                solver.require(Logic.or(...disjuncts));
            }

            // Solve
            const solution = solver.solve();

            if (solution) {
                // Extract model
                const model = new Map<string, boolean>();
                for (const v of variables) {
                    model.set(v, solution.getTrueVars().includes(v));
                }

                return {
                    sat: true,
                    model,
                    statistics: {
                        timeMs: Date.now() - startTime,
                        variables: variables.size,
                        clauses: clauses.length,
                    },
                };
            } else {
                return {
                    sat: false,
                    statistics: {
                        timeMs: Date.now() - startTime,
                        variables: variables.size,
                        clauses: clauses.length,
                    },
                };
            }
        } catch (e) {
            return {
                sat: false,
                statistics: {
                    timeMs: Date.now() - startTime,
                    clauses: clauses.length,
                },
            };
        }
    }

    /**
     * Prove a conclusion from premises using refutation.
     * 
     * Method: Clausify (premises ∧ ¬conclusion) and check for UNSAT.
     * If UNSAT, the conclusion follows from the premises.
     */
    async prove(
        premises: string[],
        conclusion: string,
        options?: EngineProveOptions
    ): Promise<ProveResult> {
        const startTime = Date.now();
        const verbosity = options?.verbosity || 'standard';

        try {
            // Build the refutation formula: premises & -conclusion
            // Wrap each part in parentheses to ensure correct precedence
            const wrappedPremises = premises.map(p => `(${p})`);
            const wrappedNegConclusion = `(-(${conclusion}))`;
            const refutationFormula = [...wrappedPremises, wrappedNegConclusion].join(' & ');

            // Clausify 
            const clausifyResult = clausify(refutationFormula);

            if (!clausifyResult.success || !clausifyResult.clauses) {
                return this.buildResult({
                    success: false,
                    result: 'error',
                    error: clausifyResult.error?.message || 'Clausification failed',
                    timeMs: Date.now() - startTime,
                }, verbosity);
            }

            // Check satisfiability
            const satResult = await this.checkSat(clausifyResult.clauses);

            if (!satResult.sat) {
                // UNSAT means the conclusion follows from premises
                return this.buildResult({
                    success: true,
                    result: 'proved',
                    message: `Proved: ${conclusion} (via refutation)`,
                    proof: [
                        `Premises: ${premises.join('; ')}`,
                        `Conclusion: ${conclusion}`,
                        `Method: Refutation (premises ∧ ¬conclusion is UNSAT)`,
                    ],
                    timeMs: Date.now() - startTime,
                    clauseCount: clausifyResult.clauses.length,
                    varCount: satResult.statistics?.variables,
                }, verbosity);
            } else {
                // SAT means we found a countermodel
                return this.buildResult({
                    success: false,
                    result: 'failed',
                    message: `Cannot prove: ${conclusion}`,
                    error: 'Found satisfying assignment for premises ∧ ¬conclusion',
                    timeMs: Date.now() - startTime,
                    clauseCount: clausifyResult.clauses.length,
                    varCount: satResult.statistics?.variables,
                }, verbosity);
            }
        } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            return this.buildResult({
                success: false,
                result: 'error',
                error,
                timeMs: Date.now() - startTime,
            }, verbosity);
        }
    }

    /**
     * Build result based on verbosity level.
     */
    private buildResult(
        data: {
            success: boolean;
            result: 'proved' | 'failed' | 'error';
            message?: string;
            error?: string;
            proof?: string[];
            timeMs: number;
            clauseCount?: number;
            varCount?: number;
        },
        verbosity: Verbosity
    ): ProveResult {
        const base: ProveResult = {
            success: data.success,
            result: data.result,
        };

        if (verbosity === 'minimal') {
            return base;
        }

        base.message = data.message;
        base.error = data.error;
        base.proof = data.proof;

        if (verbosity === 'detailed') {
            base.statistics = {
                timeMs: data.timeMs,
                inferences: data.clauseCount, // Use clauseCount as "inferences" equivalent
            };
        }

        return base;
    }
}

/**
 * Create a new SAT engine instance.
 */
export function createSATEngine(): SATEngine {
    return new SATEngine();
}

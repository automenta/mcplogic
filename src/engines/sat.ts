/**
 * SAT Engine
 * 
 * SAT solver backend using the logic-solver package (MiniSat compiled to JS).
 * Handles arbitrary propositional CNF formulas.
 */

import { Clause } from '../types/clause.js';
import { ProveResult, Verbosity } from '../types/index.js';
import { buildProveResult } from '../utils/response.js';
import { clausify } from '../clausifier.js';
import { solveSat } from './satUtils.js';
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
     * Check satisfiability of clauses using the SAT solver.
     */
    async checkSat(clauses: Clause[]): Promise<SatResult> {
        const startTime = Date.now();

        try {
            const result = solveSat(clauses);

            return {
                sat: result.sat,
                model: result.model,
                statistics: {
                    timeMs: Date.now() - startTime,
                    variables: result.statistics.variables,
                    clauses: result.statistics.clauses,
                },
            };
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
                return buildProveResult({
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
                return buildProveResult({
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
                return buildProveResult({
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
            return buildProveResult({
                success: false,
                result: 'error',
                error,
                timeMs: Date.now() - startTime,
            }, verbosity);
        }
    }
}

/**
 * Create a new SAT engine instance.
 */
export function createSATEngine(): SATEngine {
    return new SATEngine();
}

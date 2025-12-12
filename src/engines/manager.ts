/**
 * Engine Manager
 * 
 * Orchestrates multiple reasoning engines with automatic selection.
 * Provides a unified interface for theorem proving with intelligent fallback.
 */

import { Clause } from '../types/clause.js';
import { ProveResult, ASTNode } from '../types/index.js';
import { parse } from '../parser.js';
import { clausifyAST, isHornFormula } from '../clausifier.js';
import { buildProveResult } from '../utils/response.js';
import {
    EngineCapabilities,
    EngineProveOptions,
    SatResult
} from './interface.js';
import { PrologEngine, createPrologEngine } from './prolog.js';
import { SATEngine, createSATEngine } from './sat.js';

/**
 * Engine selection mode
 */
export type EngineSelection = 'prolog' | 'sat' | 'auto';

/**
 * Extended prove options with engine selection
 */
export interface ManagerProveOptions extends EngineProveOptions {
    /** Which engine to use (default: 'auto') */
    engine?: EngineSelection;
}

/**
 * Engine Manager - orchestrates multiple reasoning engines.
 * 
 * In 'auto' mode:
 * - Analyzes formula structure
 * - Uses Prolog for Horn clauses (fast, proven)
 * - Falls back to SAT for non-Horn clauses
 */
export class EngineManager {
    private prolog: PrologEngine;
    private sat: SATEngine;

    constructor(
        timeout: number = 5000,
        inferenceLimit: number = 1000
    ) {
        this.prolog = createPrologEngine(timeout, inferenceLimit);
        this.sat = createSATEngine();
    }

    /**
     * Get the Prolog engine instance.
     */
    getPrologEngine(): PrologEngine {
        return this.prolog;
    }

    /**
     * Get the SAT engine instance.
     */
    getSATEngine(): SATEngine {
        return this.sat;
    }

    /**
     * Prove a conclusion from premises with automatic engine selection.
     */
    async prove(
        premises: string[],
        conclusion: string,
        options?: ManagerProveOptions
    ): Promise<ProveResult> {
        const engine = options?.engine ?? 'auto';

        // Explicit engine selection
        if (engine === 'prolog') {
            const result = await this.prolog.prove(premises, conclusion, options);
            return { ...result, engineUsed: this.prolog.name };
        }

        if (engine === 'sat') {
            const result = await this.sat.prove(premises, conclusion, options);
            return { ...result, engineUsed: this.sat.name };
        }

        // Auto mode: analyze formula structure
        return this.autoProve(premises, conclusion, options);
    }

    /**
     * Automatic engine selection based on formula structure.
     */
    private async autoProve(
        premises: string[],
        conclusion: string,
        options?: EngineProveOptions
    ): Promise<ProveResult> {
        const startTime = Date.now();
        // Construct AST for refutation: Premises & -Conclusion
        try {
            const premiseASTs = premises.map(p => parse(p));
            const conclusionAST = parse(conclusion);
            const negatedConclusion: ASTNode = {
                type: 'not',
                operand: conclusionAST
            };
            const allFormulas = [...premiseASTs, negatedConclusion];

            // Combine into a single AND tree if there are multiple formulas
            let combinedAST: ASTNode;
            if (allFormulas.length === 1) {
                combinedAST = allFormulas[0];
            } else {
                combinedAST = allFormulas.reduce((acc, curr) => ({
                    type: 'and',
                    left: acc,
                    right: curr
                }));
            }

            // Clausify to analyze structure
            const clausifyResult = clausifyAST(combinedAST);

            // If clausification fails (e.g. timeout) or returns no clauses, fallback to Prolog (safe default)
            if (!clausifyResult.success || !clausifyResult.clauses) {
                const result = await this.prolog.prove(premises, conclusion, options);
                return { ...result, engineUsed: this.prolog.name };
            }

            // Check if Horn (Prolog-compatible)
            if (isHornFormula(clausifyResult.clauses)) {
                const result = await this.prolog.prove(premises, conclusion, options);
                return { ...result, engineUsed: this.prolog.name };
            }

            // Non-Horn: use SAT solver with the already computed clauses
            const satResult = await this.sat.checkSat(clausifyResult.clauses);

            // Build result (similar to SATEngine.prove but using existing clauses/satResult)
             if (!satResult.sat) {
                // UNSAT means the conclusion follows from premises
                return {
                    ...buildProveResult({
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
                    }, options?.verbosity || 'standard'),
                    engineUsed: this.sat.name
                };
            } else {
                // SAT means we found a countermodel
                 return {
                    ...buildProveResult({
                        success: false,
                        result: 'failed',
                        message: `Cannot prove: ${conclusion}`,
                        error: 'Found satisfying assignment for premises ∧ ¬conclusion',
                        timeMs: Date.now() - startTime,
                        clauseCount: clausifyResult.clauses.length,
                        varCount: satResult.statistics?.variables,
                    }, options?.verbosity || 'standard'),
                    engineUsed: this.sat.name
                 };
            }

        } catch (e) {
            // Fallback to Prolog if anything goes wrong during analysis (e.g. parsing error)
            // though likely Prolog will also fail if parsing is the issue.
            const result = await this.prolog.prove(premises, conclusion, options);
            return { ...result, engineUsed: this.prolog.name };
        }
    }

    /**
     * Check satisfiability of clauses.
     * Automatically selects the appropriate engine.
     */
    async checkSat(clauses: Clause[], engine?: EngineSelection): Promise<SatResult> {
        const selectedEngine = engine ?? 'auto';

        if (selectedEngine === 'prolog') {
            return this.prolog.checkSat(clauses);
        }

        if (selectedEngine === 'sat') {
            return this.sat.checkSat(clauses);
        }

        // Auto: use Prolog for Horn, SAT otherwise
        if (isHornFormula(clauses)) {
            return this.prolog.checkSat(clauses);
        }

        return this.sat.checkSat(clauses);
    }

    /**
     * Get available engines and their capabilities.
     */
    getEngines(): { name: string; capabilities: EngineCapabilities }[] {
        return [
            { name: this.prolog.name, capabilities: this.prolog.capabilities },
            { name: this.sat.name, capabilities: this.sat.capabilities },
        ];
    }
}

/**
 * Create a new engine manager instance.
 */
export function createEngineManager(
    timeout?: number,
    inferenceLimit?: number
): EngineManager {
    return new EngineManager(timeout, inferenceLimit);
}

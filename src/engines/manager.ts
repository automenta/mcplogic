/**
 * Engine Manager
 * 
 * Orchestrates multiple reasoning engines with automatic selection.
 * Provides a unified interface for theorem proving with intelligent fallback.
 */

import { Clause } from '../types/clause.js';
import { ProveResult } from '../types/index.js';
import { clausify, isHornFormula } from '../logic/clausifier.js';
import { parse } from '../parser/index.js';
import { createAnd, createNot } from '../ast/index.js';
import {
    EngineCapabilities,
    EngineProveOptions,
    SatResult
} from './interface.js';
import { PrologEngine, createPrologEngine } from './prolog/index.js';
import { SATEngine, createSATEngine } from './sat/index.js';
import { Z3Engine } from './z3/index.js';
import { ClingoEngine } from './clingo/index.js';
import { containsArithmetic } from '../axioms/arithmetic.js';

/**
 * Engine selection mode
 */
export type EngineSelection = 'prolog' | 'sat' | 'z3' | 'clingo' | 'auto';

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
 * - Uses Z3 for arithmetic, equality, and complex FOL (SMT)
 * - Falls back to SAT for non-Horn clauses if Z3 unavailable/unsuitable
 */
export class EngineManager {
    private prolog: PrologEngine;
    private sat: SATEngine;
    private z3: Z3Engine;
    private clingo: ClingoEngine;

    constructor(
        timeout: number = 5000, // kept for compatibility signature
        inferenceLimit: number = 1000
    ) {
        this.prolog = createPrologEngine(inferenceLimit);
        this.sat = createSATEngine();
        this.z3 = new Z3Engine();
        this.clingo = new ClingoEngine();
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

    getZ3Engine(): Z3Engine {
        return this.z3;
    }

    getClingoEngine(): ClingoEngine {
        return this.clingo;
    }

    /**
     * Prove a conclusion from premises with automatic engine selection.
     */
    async prove(
        premises: string[],
        conclusion: string,
        options?: ManagerProveOptions
    ): Promise<ProveResult & { engineUsed?: string }> {
        const engine = options?.engine ?? 'auto';

        // Explicit engine selection
        switch (engine) {
            case 'prolog':
                const resProlog = await this.prolog.prove(premises, conclusion, options);
                return { ...resProlog, engineUsed: this.prolog.name };
            case 'sat':
                const resSat = await this.sat.prove(premises, conclusion, options);
                return { ...resSat, engineUsed: this.sat.name };
            case 'z3':
                const resZ3 = await this.z3.prove(premises, conclusion, options);
                return { ...resZ3, engineUsed: this.z3.name };
            case 'clingo':
                const resClingo = await this.clingo.prove(premises, conclusion, options);
                return { ...resClingo, engineUsed: this.clingo.name };
            case 'auto':
            default:
                return this.autoProve(premises, conclusion, options);
        }
    }

    /**
     * Automatic engine selection based on formula structure.
     */
    private async autoProve(
        premises: string[],
        conclusion: string,
        options?: EngineProveOptions
    ): Promise<ProveResult & { engineUsed?: string }> {
        try {
            // Build the AST to analyze structure
            const premiseNodes = premises.map(p => parse(p));
            const conclusionNode = parse(conclusion);

            // Check for Arithmetic
            const hasArithmetic = premiseNodes.some(containsArithmetic) || containsArithmetic(conclusionNode);
            if (hasArithmetic || options?.enableArithmetic) {
                // Z3 is best for arithmetic
                const res = await this.z3.prove(premises, conclusion, options);
                return { ...res, engineUsed: this.z3.name };
            }

            // Check for non-Horn structure via Clausification
            // Build refutation AST
            const negatedConclusion = createNot(conclusionNode);
            const allNodes = [...premiseNodes, negatedConclusion];
            const refutationAST = allNodes.length > 0
                ? allNodes.reduce((acc, node) => createAnd(acc, node))
                : negatedConclusion;

            const clausifyResult = clausify(refutationAST);

            // If clausification fails, fallback to Z3 (it handles raw AST)
            if (!clausifyResult.success || !clausifyResult.clauses) {
                const res = await this.z3.prove(premises, conclusion, options);
                return { ...res, engineUsed: this.z3.name };
            }

            // If Horn, Prolog is fastest
            if (isHornFormula(clausifyResult.clauses)) {
                const res = await this.prolog.prove(premises, conclusion, options);
                return { ...res, engineUsed: this.prolog.name };
            }

            // Non-Horn: Z3 is preferred over SAT (MiniSat) because Z3 is a stronger solver
            // But if Z3 fails (e.g. WASM issue), we might want fallback?
            // For now, prioritize Z3.
            try {
                const resZ3 = await this.z3.prove(premises, conclusion, options);
                if (resZ3.result !== 'error') {
                    return { ...resZ3, engineUsed: this.z3.name };
                }
            } catch (e) {
                // Z3 failed, fallback to SAT
            }

            // Fallback to SAT
            const resSat = await this.sat.prove(premises, conclusion, options);
            return { ...resSat, engineUsed: this.sat.name };

        } catch (e) {
            // If parsing fails or analysis fails, default to Prolog (robust) or Z3?
            // Prolog is the legacy default.
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

        if (selectedEngine === 'prolog') return this.prolog.checkSat(clauses);
        if (selectedEngine === 'sat') return this.sat.checkSat(clauses);
        if (selectedEngine === 'z3') return this.z3.checkSat(clauses);
        if (selectedEngine === 'clingo') return this.clingo.checkSat(clauses);

        // Auto
        if (isHornFormula(clauses)) {
            return this.prolog.checkSat(clauses);
        }
        // Use Z3 for SAT checks if possible, it's faster than MiniSat-in-JS usually
        // But for consistency with legacy, maybe SAT engine?
        // Let's use SAT engine for now as it's proven for this codebase's SAT tasks (Model Finding)
        return this.sat.checkSat(clauses);
    }

    /**
     * Get available engines and their capabilities.
     */
    getEngines(): { name: string; capabilities: EngineCapabilities }[] {
        return [
            { name: this.prolog.name, capabilities: this.prolog.capabilities },
            { name: this.sat.name, capabilities: this.sat.capabilities },
            { name: this.z3.name, capabilities: this.z3.capabilities },
            { name: this.clingo.name, capabilities: this.clingo.capabilities },
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

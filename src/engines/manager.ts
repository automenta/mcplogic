/**
 * Engine Manager
 * 
 * Orchestrates multiple reasoning engines with automatic selection.
 * Provides a unified interface for theorem proving with intelligent fallback.
 */

import { Clause } from '../types/clause.js';
import { ProveResult } from '../types/index.js';
import { clausify, isHornFormula } from '../clausifier.js';
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
    ): Promise<ProveResult & { engineUsed?: string }> {
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
    ): Promise<ProveResult & { engineUsed?: string }> {
        // Try to clausify to analyze structure
        const combined = [...premises, `-${conclusion}`].join(' & ');
        const clausifyResult = clausify(combined);

        // If clausification fails or formula is Horn, use Prolog
        if (!clausifyResult.success || !clausifyResult.clauses) {
            const result = await this.prolog.prove(premises, conclusion, options);
            return { ...result, engineUsed: this.prolog.name };
        }

        // Check if Horn (Prolog-compatible)
        if (isHornFormula(clausifyResult.clauses)) {
            const result = await this.prolog.prove(premises, conclusion, options);
            return { ...result, engineUsed: this.prolog.name };
        }

        // Non-Horn: use SAT solver
        const result = await this.sat.prove(premises, conclusion, options);
        return { ...result, engineUsed: this.sat.name };
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

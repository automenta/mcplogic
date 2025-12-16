import type { EvolutionStrategy } from '../types/evolution.js';
import type { IPerformanceDatabase } from './storage.js';

export class InputRouter {
    private db: IPerformanceDatabase;
    private defaultStrategy: EvolutionStrategy;

    constructor(db: IPerformanceDatabase, defaultStrategy: EvolutionStrategy) {
        this.db = db;
        this.defaultStrategy = defaultStrategy;
    }

    async selectStrategy(input: string): Promise<EvolutionStrategy> {
        // Simple keyword-based routing or just global best for now
        // In full implementation, we analyze 'input' to find best match in DB
        const bestId = await this.db.getBestStrategy('default');

        if (!bestId) {
            return this.defaultStrategy;
        }

        // We need a way to retrieve the actual strategy object.
        // The DB currently stores 'EvaluationResult', not the strategy definitions themselves.
        // This is a gap in the current architecture (strategies are transient in Optimizer or assumed known).
        // For Phase 5, we'll assume we can't easily fetch the full strategy object from just the ID
        // unless we store strategies separately.

        // LIMITATION: Currently returning default strategy as strategy persistence is not yet implemented.
        // This will be addressed in future phases when a proper StrategyStore is added.
        return this.defaultStrategy;
    }
}

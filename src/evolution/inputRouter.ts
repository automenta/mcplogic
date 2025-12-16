import type { TranslationStrategy } from '../types/evolution.js';
import type { IPerformanceDatabase } from './storage.js';

export class InputRouter {
    private db: IPerformanceDatabase;
    private defaultStrategy: TranslationStrategy;

    constructor(db: IPerformanceDatabase, defaultStrategy: TranslationStrategy) {
        this.db = db;
        this.defaultStrategy = defaultStrategy;
    }

    async selectStrategy(input: string): Promise<TranslationStrategy> {
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

        // HACK: For now, return default.
        // TODO: Implement StrategyStore or add strategy definition to DB.
        return this.defaultStrategy;
    }
}

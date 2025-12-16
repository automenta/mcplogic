import type { EvaluationResult } from '../types/evolution.js';
import * as fs from 'fs';

/**
 * Interface for the Performance Database.
 * Allows storing and retrieving evaluation results.
 */
export interface IPerformanceDatabase {
    saveResult(result: EvaluationResult): Promise<void>;
    getResults(strategyId: string): Promise<EvaluationResult[]>;
    getBestStrategy(inputClass: string): Promise<string | null>;
    getAllResults(): Promise<EvaluationResult[]>;
}

/**
 * Simple JSON-file based implementation of the Performance Database.
 * In a full production environment, this would be replaced by SQLite.
 */
export class JsonPerformanceDatabase implements IPerformanceDatabase {
    private filePath: string;
    private data: EvaluationResult[];

    constructor(storagePath: string = 'performance_results.json') {
        this.filePath = storagePath;
        this.data = [];
        this.load();
    }

    private load() {
        if (fs.existsSync(this.filePath)) {
            try {
                const content = fs.readFileSync(this.filePath, 'utf-8');
                this.data = JSON.parse(content);
            } catch (e) {
                console.error('Failed to load performance database:', e);
                this.data = [];
            }
        }
    }

    private save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.error('Failed to save performance database:', e);
        }
    }

    async saveResult(result: EvaluationResult): Promise<void> {
        this.data.push(result);
        this.save();
    }

    async getResults(strategyId: string): Promise<EvaluationResult[]> {
        return this.data.filter(r => r.strategyId === strategyId);
    }

    async getBestStrategy(_inputClass: string): Promise<string | null> {
        // Basic implementation: Find strategy with highest success rate
        // Note: 'inputClass' is currently ignored but will be used for granular routing in future iterations.

        const strategyStats = new Map<string, { successes: number, total: number }>();

        for (const res of this.data) {
             const stats = strategyStats.get(res.strategyId) || { successes: 0, total: 0 };
             stats.total++;
             if (res.success) {
                 stats.successes++;
             }
             strategyStats.set(res.strategyId, stats);
        }

        let bestStrategyId: string | null = null;
        let bestRate = -1;

        for (const [id, stats] of strategyStats.entries()) {
            const rate = stats.successes / stats.total;
            if (rate > bestRate) {
                bestRate = rate;
                bestStrategyId = id;
            }
        }

        return bestStrategyId;
    }

    async getAllResults(): Promise<EvaluationResult[]> {
        return [...this.data];
    }
}

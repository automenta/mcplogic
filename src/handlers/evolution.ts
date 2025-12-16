import type { Optimizer, IPerformanceDatabase, CurriculumGenerator } from '../evolution/index.js';
import type { EvolutionStrategy } from '../types/evolution.js';
import { createGenericError } from '../types/errors.js';

// Global state for evolution (in a real app, this would be injected)
let optimizerInstance: Optimizer | null = null;
let dbInstance: IPerformanceDatabase | null = null;
let curriculumGeneratorInstance: CurriculumGenerator | null = null;
let strategies: EvolutionStrategy[] = [];

/**
 * Initialize evolution components (called by server setup if needed, or lazily)
 */
export function initializeEvolution(
    optimizer: Optimizer,
    db: IPerformanceDatabase,
    generator: CurriculumGenerator,
    initialStrategies: EvolutionStrategy[]
) {
    optimizerInstance = optimizer;
    dbInstance = db;
    curriculumGeneratorInstance = generator;
    strategies = initialStrategies;
}

export async function startEvolutionHandler(args: {
    generations?: number;
    population_size?: number;
}) {
    if (!optimizerInstance) {
        throw createGenericError('ENGINE_ERROR', 'Evolution engine not initialized');
    }

    // This is a long-running process. In a real MCP server, we might need async progress reporting.
    // For now, we will run it and return the result, assuming small generations or accept timeout.
    // Better: Run in background? But MCP doesn't support async background tasks well without notifications.
    // Let's assume it runs for a short burst.

    try {
        await optimizerInstance.run(strategies);
        return {
            message: 'Evolution cycle complete',
            generations: args.generations || 1
        };
    } catch (e) {
        throw createGenericError('ENGINE_ERROR', `Evolution failed: ${(e as Error).message}`);
    }
}

export async function listStrategiesHandler(args: {}) {
    if (!dbInstance) {
        // Return in-memory strategies if DB not ready
        return { strategies };
    }

    // Merge active strategies with historical bests?
    // For now, just return the current population
    return { strategies };
}

export async function getBestStrategyHandler(args: { input?: string }) {
    if (!dbInstance) {
        throw createGenericError('ENGINE_ERROR', 'Performance DB not initialized');
    }

    // Logic to pick best strategy based on input classification
    // For now, global best
    const bestId = await dbInstance.getBestStrategy('default');
    const strategy = strategies.find(s => s.id === bestId);

    if (!strategy) {
        return { message: 'No best strategy found yet, using default', strategy: strategies[0] };
    }

    return { strategy };
}

export async function generateCasesHandler(args: { domain: string; count?: number }) {
    if (!curriculumGeneratorInstance) {
        throw createGenericError('ENGINE_ERROR', 'Curriculum Generator not initialized');
    }

    try {
        const cases = await curriculumGeneratorInstance.generateNewCases(args.domain, args.count || 5);
        return {
            success: true,
            count: cases.length,
            cases
        };
    } catch (e) {
        throw createGenericError('ENGINE_ERROR', `Case generation failed: ${(e as Error).message}`);
    }
}

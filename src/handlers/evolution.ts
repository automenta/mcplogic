import type { Optimizer, IPerformanceDatabase, CurriculumGenerator } from '../evolution/index.js';
import type { EvolutionStrategy } from '../types/evolution.js';
import { createGenericError } from '../types/errors.js';

export interface EvolutionState {
    strategies: EvolutionStrategy[];
}

export async function startEvolutionHandler(
    args: {
        generations?: number;
        population_size?: number;
    },
    optimizer: Optimizer,
    state: EvolutionState
) {
    if (!optimizer) {
        throw createGenericError('ENGINE_ERROR', 'Evolution engine not initialized');
    }

    try {
        // Pass a no-op progress handler or one that logs to server logs/stderr if needed.
        const progressHandler = (msg: string) => {
             // console.error(msg); // Optional: enable for server-side logging
        };

        const newPopulation = await optimizer.run(state.strategies, progressHandler);

        // Update state
        state.strategies = newPopulation;

        return {
            message: 'Evolution cycle complete',
            generations: args.generations || 1,
            strategies_count: state.strategies.length,
            best_strategy_id: state.strategies[0]?.id
        };
    } catch (e) {
        throw createGenericError('ENGINE_ERROR', `Evolution failed: ${(e as Error).message}`);
    }
}

export async function listStrategiesHandler(
    args: {},
    strategies: EvolutionStrategy[]
) {
    return { strategies };
}

export async function getBestStrategyHandler(
    args: { input?: string },
    db: IPerformanceDatabase,
    strategies: EvolutionStrategy[]
) {
    if (!db) {
        throw createGenericError('ENGINE_ERROR', 'Performance DB not initialized');
    }

    // Logic to pick best strategy based on input classification
    // For now, global best
    const bestId = await db.getBestStrategy('default');
    const strategy = strategies.find(s => s.id === bestId);

    if (!strategy) {
        return { message: 'No best strategy found yet, using default', strategy: strategies[0] };
    }

    return { strategy };
}

export async function generateCasesHandler(
    args: { domain: string; count?: number },
    generator: CurriculumGenerator
) {
    if (!generator) {
        throw createGenericError('ENGINE_ERROR', 'Curriculum Generator not initialized');
    }

    try {
        const cases = await generator.generateNewCases(args.domain, args.count || 5);
        return {
            success: true,
            count: cases.length,
            cases
        };
    } catch (e) {
        throw createGenericError('ENGINE_ERROR', `Case generation failed: ${(e as Error).message}`);
    }
}

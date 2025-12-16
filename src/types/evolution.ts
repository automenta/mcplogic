// === Evolution Engine (Phase 5) ===

/**
 * Represents a strategy for translating Natural Language to FOL.
 * This is the "genome" that the evolution engine optimizes.
 */
export interface TranslationStrategy {
    id: string;
    description: string;
    // Template for the prompt sent to the LLM
    promptTemplate: string;
    // Parameters for the LLM generation (temperature, etc.)
    parameters: Record<string, unknown>;
    // Metadata about performance history
    metadata: {
        successRate: number;
        inferenceCount: number;
        generation: number;
        parent?: string;
    };
}

/**
 * Result of evaluating a strategy against a test case.
 */
export interface EvaluationResult {
    strategyId: string;
    caseId: string;
    success: boolean;
    metrics: {
        accuracy: number;
        latencyMs: number;
        tokenCount: number;
    };
    trace?: string[];
}

/**
 * A test case for evaluating translation strategies.
 */
export interface EvaluationCase {
    id: string;
    input: string; // Natural language input
    expected: string[]; // Expected FOL formulas (canonical)
    type: 'premise' | 'goal';
}

/**
 * Configuration for the Evolution Engine.
 */
export interface EvolutionConfig {
    populationSize: number;
    generations: number;
    mutationRate: number;
    elitismCount: number;
}

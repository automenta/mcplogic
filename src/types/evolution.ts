// === Evolution Engine (Phase 5) ===

/**
 * Represents a strategy for translating Natural Language to FOL.
 * This is the "genome" that the evolution engine optimizes.
 */
export interface EvolutionStrategy {
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
        // Hash for integrity/deduplication
        hash?: string;
        // Cost metrics
        avgLatencyMs?: number;
        avgCost?: number;
    };
}

/**
 * Result of evaluating a strategy against a test case.
 */
export interface EvaluationResult {
    id: string; // Unique run ID
    strategyId: string;
    strategyHash: string;
    caseId: string;
    success: boolean;
    metrics: {
        accuracy: number;
        latencyMs: number;
        tokenCount: number;
        // Detailed metrics
        syntaxValid?: boolean;
        semanticMatch?: boolean;
    };
    cost: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    rawOutput: string;
    trace?: string[];
    timestamp: number;
    llmModelId: string;
}

/**
 * A test case for evaluating translation strategies.
 */
export interface EvaluationCase {
    id: string;
    domain?: string;
    input: string; // Natural language input
    expected: string[]; // Expected FOL formulas (canonical)
    type: 'premise' | 'goal';
    metadata?: Record<string, unknown>;
}

/**
 * Configuration for the Evolution Engine.
 */
export interface EvolutionConfig {
    populationSize: number;
    generations: number;
    mutationRate: number;
    elitismCount: number;
    evalCasesPath: string;
    storagePath?: string;
    llmModelId?: string;
}

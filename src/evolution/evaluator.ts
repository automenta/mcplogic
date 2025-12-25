import type { EvaluationCase, EvaluationResult, EvolutionStrategy } from '../types/evolution.js';
import type { IPerformanceDatabase } from './storage.js';
import type { LLMProvider } from '../types/llm.js';
import { randomUUID } from 'crypto';
// We will need to import the actual translator logic.
// For now, assuming we have a way to invoke a strategy.
// In the future, this should probably use `mcrService` or `HeuristicTranslator` directly if possible,
// but since the strategy defines the prompt, we might need a `StrategyRunner`.

export class Evaluator {
    private db: IPerformanceDatabase;
    private llm: LLMProvider;

    constructor(db: IPerformanceDatabase, llm: LLMProvider) {
        this.db = db;
        this.llm = llm;
    }

    async evaluate(strategy: EvolutionStrategy, testCase: EvaluationCase): Promise<EvaluationResult> {
        const startTime = Date.now();

        // 1. Construct prompt from strategy template and test case input
        const prompt = strategy.promptTemplate.replace('{{INPUT}}', testCase.input);

        // 2. Call LLM
        // Note: In a real implementation, we would handle parameters from strategy.parameters
        let response;
        try {
            response = await this.llm.complete([
                { role: 'user', content: prompt } // Simplified: usually system prompt is separate
            ]);
        } catch (e) {
            // Handle error
            return this.createFailureResult(strategy, testCase, startTime, (e as Error).message);
        }

        const latencyMs = Date.now() - startTime;
        const rawOutput = response.content;

        // 3. Parse and Validate
        // This logic needs to be robust. For now, we'll assume the output is directly the FOL
        // or a JSON that needs parsing.
        // We need a canonical way to compare FOL.

        // Use a heuristic comparison for now (e.g., string equality or set equality after normalization)
        const isSuccess = this.compareOutput(rawOutput, testCase.expected);

        const result: EvaluationResult = {
            id: randomUUID(),
            strategyId: strategy.id,
            strategyHash: strategy.metadata.hash || 'unknown', // Should be calculated
            caseId: testCase.id,
            success: isSuccess,
            metrics: {
                accuracy: isSuccess ? 1.0 : 0.0,
                latencyMs,
                tokenCount: (response.usage?.promptTokens || 0) + (response.usage?.completionTokens || 0),
                syntaxValid: true, // Placeholder
                semanticMatch: isSuccess
            },
            cost: {
                promptTokens: response.usage?.promptTokens || 0,
                completionTokens: response.usage?.completionTokens || 0,
                totalTokens: (response.usage?.promptTokens || 0) + (response.usage?.completionTokens || 0)
            },
            rawOutput,
            timestamp: Date.now(),
            llmModelId: 'default' // Should come from config
        };

        // 4. Store result
        await this.db.saveResult(result);

        return result;
    }

    private createFailureResult(strategy: EvolutionStrategy, testCase: EvaluationCase, startTime: number, errorMsg: string): EvaluationResult {
        return {
            id: randomUUID(),
            strategyId: strategy.id,
            strategyHash: strategy.metadata.hash || 'unknown',
            caseId: testCase.id,
            success: false,
            metrics: {
                accuracy: 0,
                latencyMs: Date.now() - startTime,
                tokenCount: 0,
                syntaxValid: false,
                semanticMatch: false
            },
            cost: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            rawOutput: `ERROR: ${errorMsg}`,
            timestamp: Date.now(),
            llmModelId: 'default'
        };
    }

    private compareOutput(raw: string, expected: string[]): boolean {
        // Very basic comparison: check if all expected formulas appear in the raw output
        // In reality, we need to parse the raw output into FOL AST and compare with expected ASTs
        // modulo variable renaming and ordering.

        // Normalization helper
        const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();

        const rawNormalized = normalize(raw);
        return expected.every(e => rawNormalized.includes(normalize(e)));
    }
}

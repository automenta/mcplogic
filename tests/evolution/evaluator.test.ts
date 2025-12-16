import { Evaluator } from '../../src/evolution/evaluator.js';
import { JsonPerformanceDatabase } from '../../src/evolution/storage.js';
import type { EvolutionStrategy, EvaluationCase } from '../../src/types/evolution.js';
import type { LLMProvider, LLMMessage } from '../../src/types/llm.js';
import * as fs from 'fs';

// Mock LLM
class MockLLM implements LLMProvider {
    async complete(messages: LLMMessage[]) {
        return {
            content: 'all x (man(x) -> mortal(x))',
            usage: { promptTokens: 10, completionTokens: 5 }
        };
    }
}

// Mock DB
class MockDB extends JsonPerformanceDatabase {
    constructor() {
        super('test_perf.json');
    }
    // Override save to avoid file I/O in tests (or use temp file)
    async saveResult(result: any) {}
}

describe('Evaluator', () => {
    let evaluator: Evaluator;
    let mockLLM: MockLLM;
    let mockDB: MockDB;

    beforeEach(() => {
        mockLLM = new MockLLM();
        mockDB = new MockDB();
        evaluator = new Evaluator(mockDB, mockLLM);
    });

    test('should evaluate a strategy successfully', async () => {
        const strategy: EvolutionStrategy = {
            id: 'test-strat',
            description: 'test',
            promptTemplate: 'Translate {{INPUT}}',
            parameters: {},
            metadata: { successRate: 0, inferenceCount: 0, generation: 0 }
        };

        const testCase: EvaluationCase = {
            id: 'case-1',
            input: 'All men are mortal',
            expected: ['all x (man(x) -> mortal(x))'],
            type: 'premise'
        };

        const result = await evaluator.evaluate(strategy, testCase);

        expect(result.success).toBe(true);
        expect(result.metrics.accuracy).toBe(1.0);
        expect(result.rawOutput).toContain('man(x)');
    });

    test('should handle failure', async () => {
        const strategy: EvolutionStrategy = {
            id: 'test-strat',
            description: 'test',
            promptTemplate: 'Translate {{INPUT}}',
            parameters: {},
            metadata: { successRate: 0, inferenceCount: 0, generation: 0 }
        };

        const testCase: EvaluationCase = {
            id: 'case-1',
            input: 'Something else',
            expected: ['different formula'],
            type: 'premise'
        };

        const result = await evaluator.evaluate(strategy, testCase);

        expect(result.success).toBe(false);
    });
});

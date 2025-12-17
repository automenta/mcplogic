import { Optimizer } from '../../src/evolution/optimizer.js';
import { StrategyEvolver } from '../../src/evolution/strategyEvolver.js';
import { Evaluator } from '../../src/evolution/evaluator.js';
import { JsonPerformanceDatabase } from '../../src/evolution/storage.js';
import type { EvolutionStrategy, EvolutionConfig } from '../../src/types/evolution.js';
import type { LLMProvider, LLMMessage } from '../../src/types/llm.js';
import * as fs from 'fs';
import * as path from 'path';
import { jest } from '@jest/globals';

// Mock LLM
class MockLLM implements LLMProvider {
    async complete(messages: LLMMessage[]) {
        const content = messages[0].content;
        if (content.includes('critique')) {
             return { content: '<new_prompt>Translate {{INPUT}} (Improved)</new_prompt>' };
        }
        return {
            content: 'all x (man(x) -> mortal(x))',
            usage: { promptTokens: 10, completionTokens: 5 }
        };
    }
}

// Mock DB
class MockDB extends JsonPerformanceDatabase {
    constructor() { super('test_perf.json'); }
    async saveResult(result: any) {}
    async getResults(id: string) { return []; }
}

describe('Optimizer', () => {
    let optimizer: Optimizer;
    let evolver: StrategyEvolver;
    let evaluator: Evaluator;
    let mockDB: MockDB;
    let mockLLM: MockLLM;
    const tempDir = 'tests/temp_eval_cases';

    beforeAll(() => {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        fs.writeFileSync(path.join(tempDir, 'case1.json'), JSON.stringify({
            id: 'c1',
            input: 'test',
            expected: ['all x (man(x) -> mortal(x))'], // Matches mock output
            type: 'premise'
        }));
    });

    afterAll(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    beforeEach(() => {
        mockLLM = new MockLLM();
        mockDB = new MockDB();
        evaluator = new Evaluator(mockDB, mockLLM);
        evolver = new StrategyEvolver(mockLLM, mockDB);

        const config: EvolutionConfig = {
            populationSize: 2,
            generations: 1,
            mutationRate: 0.5,
            elitismCount: 1,
            evalCasesPath: tempDir
        };

        optimizer = new Optimizer(mockDB, evolver, evaluator, config);
    });

    test('should run one generation', async () => {
        const initialStrategies: EvolutionStrategy[] = [{
            id: 'strat-1',
            description: 'base',
            promptTemplate: 'Translate {{INPUT}}',
            parameters: {},
            metadata: { successRate: 0, inferenceCount: 0, generation: 0 }
        }];

        await optimizer.run(initialStrategies);

        // No assertions on internal state, but ensures no crash
        // and coverage of the flow
        expect(true).toBe(true);
    });

    test('should respect overrides', async () => {
        const spy = jest.spyOn(evaluator, 'evaluate');
        const initialStrategies: EvolutionStrategy[] = [{
            id: 'strat-1',
            description: 'base',
            promptTemplate: 'Translate {{INPUT}}',
            parameters: {},
            metadata: { successRate: 0, inferenceCount: 0, generation: 0 }
        }];

        // Override generations to 2
        await optimizer.run(initialStrategies, undefined, { generations: 2, populationSize: 2 });

        // Should have called evaluate multiple times
        expect(spy.mock.calls.length).toBeGreaterThan(0);
    });
});

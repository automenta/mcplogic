import { startEvolutionHandler, listStrategiesHandler, generateCasesHandler, EvolutionState } from '../../src/handlers/evolution.js';
import { Optimizer } from '../../src/evolution/optimizer.js';
import { Evaluator } from '../../src/evolution/evaluator.js';
import { StrategyEvolver } from '../../src/evolution/strategyEvolver.js';
import { CurriculumGenerator } from '../../src/evolution/curriculumGenerator.js';
import { JsonPerformanceDatabase } from '../../src/evolution/storage.js';
import { StandardLLMProvider } from '../../src/llm/provider.js';
import { EvolutionStrategy } from '../../src/types/evolution.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock Provider for testing
class MockProvider extends StandardLLMProvider {
    async complete(messages: any[]) {
        return {
            content: 'Mock response',
            usage: { promptTokens: 0, completionTokens: 0 }
        };
    }
}

describe('Evolution Integration', () => {
    let mockLLM: MockProvider;
    let mockDB: JsonPerformanceDatabase;
    let evaluator: Evaluator;
    let evolver: StrategyEvolver;
    let generator: CurriculumGenerator;
    let optimizer: Optimizer;
    let initialState: EvolutionState;
    const tempDir = 'tests/temp_eval_integration';

    beforeAll(() => {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        fs.writeFileSync(path.join(tempDir, 'case1.json'), JSON.stringify({
            id: 'c1',
            input: 'test',
            expected: ['test'],
            type: 'premise'
        }));
    });

    afterAll(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    beforeEach(() => {
        mockLLM = new MockProvider();
        mockDB = new JsonPerformanceDatabase('tests/temp_db.json');
        evaluator = new Evaluator(mockDB, mockLLM);
        evolver = new StrategyEvolver(mockLLM, mockDB);
        generator = new CurriculumGenerator(mockLLM, mockDB, tempDir);

        optimizer = new Optimizer(mockDB, evolver, evaluator, {
            populationSize: 2,
            generations: 1,
            mutationRate: 0.1,
            elitismCount: 1,
            evalCasesPath: tempDir
        });

        const initialStrategy: EvolutionStrategy = {
            id: 'strat-1',
            description: 'base',
            promptTemplate: 'test',
            parameters: {},
            metadata: { successRate: 0, inferenceCount: 0, generation: 0 }
        };

        initialState = { strategies: [initialStrategy] };
    });

    afterEach(() => {
        if (fs.existsSync('tests/temp_db.json')) fs.unlinkSync('tests/temp_db.json');
    });

    test('listStrategiesHandler should return initial strategies', async () => {
        const result = await listStrategiesHandler({}, initialState.strategies);
        expect(result.strategies.length).toBe(1);
        expect(result.strategies[0].id).toBe('strat-1');
    });

    test('startEvolutionHandler should run without error and update strategies', async () => {
        const result = await startEvolutionHandler({ generations: 1 }, optimizer, initialState);
        expect(result.message).toContain('complete');

        // Verify strategies updated in state
        expect(initialState.strategies.length).toBe(2);
        const hasNewStrategy = initialState.strategies.some(s => s.id !== 'strat-1');
        expect(hasNewStrategy).toBe(true);
    });

    test('generateCasesHandler should return mocked cases', async () => {
        const result = await generateCasesHandler({ domain: 'test' }, generator);
        expect(result.success).toBe(true);
        expect(result.cases).toEqual([]);
    });
});

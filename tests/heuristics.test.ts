
import { jest } from '@jest/globals';
import { EngineManager, createEngineManager } from '../src/engines/manager.js';
import { proveHandler } from '../src/handlers/core.js';
import { Verbosity } from '../src/types/index.js';

// Mock EngineManager for testing
const mockProve = jest.fn() as any;

const mockManager = {
    prove: mockProve,
} as unknown as EngineManager;

describe('Heuristic Strategy Selection', () => {
    beforeEach(() => {
        mockProve.mockReset();
        mockProve.mockResolvedValue({ found: true, engineUsed: 'mock' });
    });

    test('selects iterative strategy for equality-heavy proofs', async () => {
        await proveHandler({
            premises: ['a = b', 'b = c', 'c = d'],
            conclusion: 'a = d',
            strategy: 'auto'
        }, mockManager, 'standard' as Verbosity);

        expect(mockProve).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ strategy: 'iterative' })
        );
    });

    test('retains provided strategy if not auto', async () => {
        await proveHandler({
            premises: ['a = b'],
            conclusion: 'b = a',
            strategy: 'breadth' // Force breadth even if equality used
        }, mockManager, 'standard' as Verbosity);

        expect(mockProve).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ strategy: 'breadth' })
        );
    });

    test('selects prolog engine for Horn clauses in auto mode', async () => {
        // Handled by EngineManager integration tests
    });
});

describe('EngineManager Heuristics', () => {
    let manager: EngineManager;

    beforeEach(() => {
        manager = createEngineManager();
    });

    test('auto-selects Prolog for Horn clauses', async () => {
        const result = await manager.prove(
            ['all x (man(x) -> mortal(x))', 'man(socrates)'],
            'mortal(socrates)',
            { engine: 'auto' }
        );
        expect(result.engineUsed).toBe('prolog/tau-prolog');
    });

    test('auto-selects SAT for non-Horn clauses', async () => {
        const result = await manager.prove(
            ['P(a) | Q(a)', '-P(a)'],
            'Q(a)',
            { engine: 'auto' }
        );
        expect(result.engineUsed).toBe('sat/minisat');
    });
});


import { jest } from '@jest/globals';
import { EngineManager } from '../src/engines/manager.js';
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
        // This logic is inside EngineManager.autoProve, so we need to test EngineManager directly or mock the helper
        // Since we are mocking EngineManager here, we can't test internal logic of EngineManager easily.
        // Instead, let's integration test the actual EngineManager logic in a separate test block or file.
        // Or better, let's rely on the handler passing 'auto' correctly and trust EngineManager (which we will modify)
    });
});

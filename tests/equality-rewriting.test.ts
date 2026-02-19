import { createLogicEngine } from '../src/engines/prolog/engine.js';

describe('Equality Rewriting (Knuth-Bendix)', () => {
    const engine = createLogicEngine();

    test('orients and proves simple equality', async () => {
        // c1 = c2. prove c2 = c1.
        const result = await engine.prove(
            ['constA = constB'],
            'constB = constA',
            { enableEquality: true, verbosity: 'detailed' }
        );
        if (result.result !== 'proved') {
            console.log('Program:\n', result.prologProgram);
            console.log('Result:', result);
        }
        expect(result.result).toBe('proved');
    });

    test('proves transitivity via normalization', async () => {
        const result = await engine.prove(
            ['constA = constB', 'constB = constC'],
            'constA = constC',
            { enableEquality: true }
        );
        expect(result.result).toBe('proved');
    });

    test('proves congruence via deep rewrite', async () => {
        const result = await engine.prove(
            ['constA = constB'],
            'func(constA) = func(constB)',
            { enableEquality: true }
        );
        expect(result.result).toBe('proved');
    });

    test('handles compound rewriting', async () => {
        const result = await engine.prove(
            ['constA = constB'],
            'g(f(constA), c) = g(f(constB), c)',
            { enableEquality: true }
        );
        expect(result.result).toBe('proved');
    });

    test('handles chain rewriting', async () => {
        const result = await engine.prove(
            ['constA = constB', 'constB = constC', 'constC = constD'],
            'constA = constD',
            { enableEquality: true }
        );
        expect(result.result).toBe('proved');
    });
});

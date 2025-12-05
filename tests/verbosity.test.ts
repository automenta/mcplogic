/**
 * Tests for verbosity control
 */

import { LogicEngine, createLogicEngine } from '../src/logicEngine.js';

describe('Verbosity Control', () => {
    let engine: LogicEngine;

    beforeEach(() => {
        engine = createLogicEngine();
    });

    describe('prove with minimal verbosity', () => {
        test('returns only success and result', async () => {
            const result = await engine.prove(
                ['man(socrates)', 'all x (man(x) -> mortal(x))'],
                'mortal(socrates)',
                { verbosity: 'minimal' }
            );

            expect(result.success).toBe(true);
            expect(result.result).toBe('proved');
            // Minimal should not include extras
            expect(result.message).toBeUndefined();
            expect(result.prologProgram).toBeUndefined();
            expect(result.statistics).toBeUndefined();
        });

        test('minimal failure has no extras', async () => {
            const result = await engine.prove(
                ['P(a)'],
                'Q(b)',
                { verbosity: 'minimal' }
            );

            expect(result.success).toBe(false);
            // May be 'failed' or 'error' depending on Prolog behavior
            expect(['failed', 'error']).toContain(result.result);
            expect(result.message).toBeUndefined();
        });
    });

    describe('prove with standard verbosity', () => {
        test('includes message and bindings', async () => {
            const result = await engine.prove(
                ['man(socrates)', 'all x (man(x) -> mortal(x))'],
                'mortal(socrates)',
                { verbosity: 'standard' }
            );

            expect(result.success).toBe(true);
            expect(result.message).toBeDefined();
            expect(result.message).toContain('Proved');
            // Standard should not include debug info
            expect(result.prologProgram).toBeUndefined();
            expect(result.statistics).toBeUndefined();
        });

        test('standard failure includes error or message', async () => {
            const result = await engine.prove(
                ['P(a)'],
                'Q(b)',
                { verbosity: 'standard' }
            );

            expect(result.success).toBe(false);
            // For failures, either message or error should be defined
            expect(result.message || result.error).toBeDefined();
        });
    });

    describe('prove with detailed verbosity', () => {
        test('includes Prolog program', async () => {
            const result = await engine.prove(
                ['man(socrates)', 'all x (man(x) -> mortal(x))'],
                'mortal(socrates)',
                { verbosity: 'detailed' }
            );

            expect(result.success).toBe(true);
            expect(result.prologProgram).toBeDefined();
            expect(result.prologProgram).toContain('man(socrates)');
            expect(result.prologProgram).toContain('mortal');
        });

        test('includes statistics', async () => {
            const result = await engine.prove(
                ['man(socrates)', 'all x (man(x) -> mortal(x))'],
                'mortal(socrates)',
                { verbosity: 'detailed' }
            );

            expect(result.statistics).toBeDefined();
            expect(result.statistics?.timeMs).toBeGreaterThanOrEqual(0);
        });

        test('includes proof steps', async () => {
            const result = await engine.prove(
                ['man(socrates)', 'all x (man(x) -> mortal(x))'],
                'mortal(socrates)',
                { verbosity: 'detailed' }
            );

            expect(result.proof).toBeDefined();
            expect(result.proof?.length).toBeGreaterThan(0);
        });
    });

    describe('default verbosity', () => {
        test('defaults to standard when not specified', async () => {
            const result = await engine.prove(
                ['man(socrates)', 'all x (man(x) -> mortal(x))'],
                'mortal(socrates)'
            );

            // Should have standard fields
            expect(result.message).toBeDefined();
            // Should not have detailed fields
            expect(result.prologProgram).toBeUndefined();
            expect(result.statistics).toBeUndefined();
        });
    });
});

describe('Response size comparison', () => {
    let engine: LogicEngine;

    beforeEach(() => {
        engine = createLogicEngine();
    });

    test('minimal response is smaller than standard', async () => {
        const premises = [
            'man(socrates)',
            'man(plato)',
            'man(aristotle)',
            'all x (man(x) -> mortal(x))',
            'all x (mortal(x) -> dies(x))',
        ];

        const minimal = await engine.prove(premises, 'dies(socrates)', { verbosity: 'minimal' });
        const standard = await engine.prove(premises, 'dies(socrates)', { verbosity: 'standard' });

        const minimalSize = JSON.stringify(minimal).length;
        const standardSize = JSON.stringify(standard).length;

        expect(minimalSize).toBeLessThan(standardSize);
    });

    test('standard response is smaller than detailed', async () => {
        const premises = [
            'man(socrates)',
            'man(plato)',
            'all x (man(x) -> mortal(x))',
        ];

        const standard = await engine.prove(premises, 'mortal(socrates)', { verbosity: 'standard' });
        const detailed = await engine.prove(premises, 'mortal(socrates)', { verbosity: 'detailed' });

        const standardSize = JSON.stringify(standard).length;
        const detailedSize = JSON.stringify(detailed).length;

        expect(standardSize).toBeLessThan(detailedSize);
    });
});

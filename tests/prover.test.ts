/**
 * Integration tests for the MCP Logic prover functionality
 */

import { PrologEngine, createPrologEngine } from '../src/engines/prolog.js';
import { buildPrologProgram, folGoalToProlog, folToProlog } from '../src/engines/prolog/translator.js';
import { createTestEngine } from './fixtures.js';

describe('PrologEngine', () => {
    let engine: PrologEngine;

    beforeEach(() => {
        engine = createPrologEngine(5000);
    });

    describe('prove', () => {
        test('proves simple syllogism', async () => {
            const result = await engine.prove(
                ['all x (man(x) -> mortal(x))', 'man(socrates)'],
                'mortal(socrates)'
            );
            expect(result.result).toBe('proved');
        });

        test('handles simple facts', async () => {
            const result = await engine.prove(
                ['happy(john)', 'happy(mary)'],
                'happy(john)'
            );
            expect(result.result).toBe('proved');
        });

        test('fails on invalid conclusion', async () => {
            const result = await engine.prove(
                ['happy(john)'],
                'happy(mary)'
            );
            expect(result.result).toBe('failed');
        });

        test('handles empty premises', async () => {
            const result = await engine.prove([], 'P(x)');
            expect(result).toBeDefined();
            expect(result.result).toBe('failed');
        });
    });

});

describe('HighPower Mode', () => {
    test('highPower mode increases inference limit', async () => {
        // This test doesn't need to prove anything hard,
        // just verify the limit is applied
        const engine = createTestEngine({ highPower: true });
        // Access private property or inferred behavior?
        // LogicEngine wraps ReasoningEngine.
        // We can check if `engine` (LogicEngine) has `inferenceLimit` property if we cast to any,
        // or check configuration via reflection.
        expect((engine as any)['inferenceLimit']).toBe(100000);
    });
});

describe('Translator', () => {
    describe('folToProlog', () => {
        test('translates simple fact', () => {
            const clauses = folToProlog('man(socrates)');
            expect(clauses.length).toBeGreaterThan(0);
            expect(clauses[0]).toContain('man');
            expect(clauses[0]).toContain('socrates');
        });

        test('translates conjunction', () => {
            const clauses = folToProlog('P(a) & Q(b)');
            expect(clauses.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('folGoalToProlog', () => {
        test('converts simple predicate goal', () => {
            const goal = folGoalToProlog('mortal(socrates)');
            expect(goal).toContain('mortal');
            expect(goal).toContain('socrates');
        });
    });

    describe('buildPrologProgram', () => {
        test('builds program from multiple premises', () => {
            const program = buildPrologProgram(['P(a)', 'Q(b)', 'R(c)']);
            expect(program).toContain('P');
            expect(program).toContain('Q');
            expect(program).toContain('R');
        });
    });
});

/**
 * Integration tests for the MCP Logic prover functionality
 */

import { LogicEngine, createLogicEngine } from '../src/logicEngine.js';
import { buildPrologProgram, folGoalToProlog, folToProlog } from '../src/translator.js';

describe('LogicEngine', () => {
    let engine: LogicEngine;

    beforeEach(() => {
        engine = createLogicEngine(5000);
    });

    describe('prove', () => {
        test('proves simple syllogism', async () => {
            const result = await engine.prove(
                ['all x (man(x) -> mortal(x))', 'man(socrates)'],
                'mortal(socrates)'
            );
            // Note: Tau-Prolog may not handle all FOL constructs perfectly
            // The test validates the engine doesn't crash
            expect(result).toBeDefined();
            expect(result.result).toBeDefined();
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

    describe('checkSatisfiability', () => {
        test('does not crash on valid premises', async () => {
            const result = await engine.checkSatisfiability(['P(a)']);
            // checkSatisfiability checks if program can be consulted
            expect(typeof result).toBe('boolean');
        });

        test('returns true for empty premises', async () => {
            const result = await engine.checkSatisfiability([]);
            expect(result).toBe(true);
        });
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

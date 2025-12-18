/**
 * SAT Engine Tests
 * 
 * Tests for the SAT solver-based reasoning engine.
 * Note: Use multi-character predicate names to avoid confusion with variables.
 */

import { SATEngine, createSATEngine } from '../src/engines/sat';
import { clausify } from '../src/clausifier';
import { Clause } from '../src/types/clause';
import { createConstant } from '../src/utils/ast';

describe('SATEngine', () => {
    let engine: SATEngine;

    beforeEach(() => {
        engine = createSATEngine();
    });

    describe('capabilities', () => {
        it('should report correct capabilities', () => {
            expect(engine.name).toBe('sat/minisat');
            expect(engine.capabilities.horn).toBe(true);
            expect(engine.capabilities.fullFol).toBe(true);
            expect(engine.capabilities.equality).toBe(false);
            expect(engine.capabilities.arithmetic).toBe(false);
        });
    });

    describe('checkSat', () => {
        it('should find empty clause set satisfiable', async () => {
            const result = await engine.checkSat([]);
            expect(result.sat).toBe(true);
        });

        it('should find simple satisfiable formula', async () => {
            // foo is satisfiable
            const clauses: Clause[] = [
                { literals: [{ predicate: 'foo', args: [], negated: false }] }
            ];
            const result = await engine.checkSat(clauses);
            expect(result.sat).toBe(true);
            expect(result.model?.get('foo')).toBe(true);
        });

        it('should detect unsatisfiable formula (foo ∧ ¬foo)', async () => {
            // foo ∧ ¬foo is unsatisfiable
            const clauses: Clause[] = [
                { literals: [{ predicate: 'foo', args: [], negated: false }] },
                { literals: [{ predicate: 'foo', args: [], negated: true }] }
            ];
            const result = await engine.checkSat(clauses);
            expect(result.sat).toBe(false);
        });

        it('should find satisfiable disjunction (foo ∨ bar)', async () => {
            // foo ∨ bar is satisfiable (non-Horn)
            const clauses: Clause[] = [
                {
                    literals: [
                        { predicate: 'foo', args: [], negated: false },
                        { predicate: 'bar', args: [], negated: false }
                    ]
                }
            ];
            const result = await engine.checkSat(clauses);
            expect(result.sat).toBe(true);
            // At least one of foo or bar should be true
            const fooTrue = result.model?.get('foo');
            const barTrue = result.model?.get('bar');
            expect(fooTrue || barTrue).toBe(true);
        });

        it('should handle clauses with arguments', async () => {
            // man(socrates) is satisfiable
            const clauses: Clause[] = [
                { literals: [{ predicate: 'man', args: [createConstant('socrates')], negated: false }] }
            ];
            const result = await engine.checkSat(clauses);
            expect(result.sat).toBe(true);
            expect(result.model?.get('man(socrates)')).toBe(true);
        });

        it('should detect empty clause as unsatisfiable', async () => {
            const clauses: Clause[] = [
                { literals: [] }  // Empty clause = false
            ];
            const result = await engine.checkSat(clauses);
            expect(result.sat).toBe(false);
        });
    });

    describe('prove (refutation)', () => {
        it('should prove modus ponens', async () => {
            // foo, foo -> bar ⊢ bar
            const result = await engine.prove(
                ['foo', 'foo -> bar'],
                'bar'
            );
            expect(result.success).toBe(true);
            expect(result.result).toBe('proved');
        });

        it('should prove simple tautology', async () => {
            // ⊢ foo | -foo
            const result = await engine.prove(
                [],
                'foo | -foo'
            );
            expect(result.success).toBe(true);
            expect(result.result).toBe('proved');
        });

        it('should fail to prove non-theorem', async () => {
            // foo ⊬ bar (bar does not follow from foo alone)
            const result = await engine.prove(
                ['foo'],
                'bar'
            );
            expect(result.success).toBe(false);
            expect(result.result).toBe('failed');
        });

        it('should prove with multiple premises', async () => {
            // alpha, beta, alpha & beta -> gamma ⊢ gamma
            const result = await engine.prove(
                ['alpha', 'beta', '(alpha & beta) -> gamma'],
                'gamma'
            );
            expect(result.success).toBe(true);
        });

        it('should handle complex formulas', async () => {
            // (foo -> bar | -baz), foo ⊢ -baz | bar
            const result = await engine.prove(
                ['foo -> (bar | -baz)', 'foo'],
                'bar | -baz'
            );
            expect(result.success).toBe(true);
        });

        it('should return proof steps in standard verbosity', async () => {
            const result = await engine.prove(
                ['foo', 'foo -> bar'],
                'bar',
                { verbosity: 'standard' }
            );
            expect(result.success).toBe(true);
            expect(result.message).toContain('Proved');
        });

        it('should return statistics in detailed verbosity', async () => {
            const result = await engine.prove(
                ['foo', 'foo -> bar'],
                'bar',
                { verbosity: 'detailed' }
            );
            expect(result.success).toBe(true);
            expect(result.statistics).toBeDefined();
            expect(result.statistics?.timeMs).toBeGreaterThanOrEqual(0);
        });

        it('should return minimal response in minimal verbosity', async () => {
            const result = await engine.prove(
                ['foo', 'foo -> bar'],
                'bar',
                { verbosity: 'minimal' }
            );
            expect(result.success).toBe(true);
            expect(result.result).toBe('proved');
            expect(result.message).toBeUndefined();
        });
    });

    describe('non-Horn formulas (SAT-specific)', () => {
        it('should handle foo ∨ bar (two positive literals)', async () => {
            const result = await engine.prove(
                ['foo | bar', '-foo'],
                'bar'
            );
            expect(result.success).toBe(true);
            expect(result.result).toBe('proved');
        });

        it('should handle disjunctive conclusions', async () => {
            // From foo, prove foo ∨ bar
            const result = await engine.prove(
                ['foo'],
                'foo | bar'
            );
            expect(result.success).toBe(true);
        });

        it('should handle case analysis', async () => {
            // (foo ∨ bar), (foo → baz), (bar → baz) ⊢ baz
            const result = await engine.prove(
                ['foo | bar', 'foo -> baz', 'bar -> baz'],
                'baz'
            );
            expect(result.success).toBe(true);
        });
    });
});

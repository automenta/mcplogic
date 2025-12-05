/**
 * Tests for Arithmetic Support
 */

import {
    containsArithmetic,
    isArithmeticPredicate,
    isArithmeticOperator,
    getArithmeticAxioms,
    arithmeticToProlog,
    getArithmeticSetup,
    isNumericConstant,
    parseNumber,
} from '../src/arithmetic';
import { parse } from '../src/parser';
import { LogicEngine } from '../src/logicEngine';

describe('Arithmetic Support', () => {
    describe('containsArithmetic', () => {
        it('should detect arithmetic predicates', () => {
            const ast = parse('lt(x, y)');
            expect(containsArithmetic(ast)).toBe(true);
        });

        it('should detect arithmetic in nested formula', () => {
            const ast = parse('P(x) & gt(x, y)');
            expect(containsArithmetic(ast)).toBe(true);
        });

        it('should return false when no arithmetic', () => {
            const ast = parse('P(x) & Q(y)');
            expect(containsArithmetic(ast)).toBe(false);
        });

        it('should detect arithmetic under quantifier', () => {
            const ast = parse('all x (lt(x, y) -> P(x))');
            expect(containsArithmetic(ast)).toBe(true);
        });
    });

    describe('isArithmeticPredicate', () => {
        it('should recognize lt', () => {
            expect(isArithmeticPredicate('lt')).toBe(true);
        });

        it('should recognize gt', () => {
            expect(isArithmeticPredicate('gt')).toBe(true);
        });

        it('should recognize lte/gte', () => {
            expect(isArithmeticPredicate('lte')).toBe(true);
            expect(isArithmeticPredicate('gte')).toBe(true);
        });

        it('should not recognize regular predicates', () => {
            expect(isArithmeticPredicate('P')).toBe(false);
            expect(isArithmeticPredicate('mortal')).toBe(false);
        });
    });

    describe('isArithmeticOperator', () => {
        it('should recognize plus/add', () => {
            expect(isArithmeticOperator('plus')).toBe(true);
            expect(isArithmeticOperator('add')).toBe(true);
        });

        it('should recognize minus/sub', () => {
            expect(isArithmeticOperator('minus')).toBe(true);
            expect(isArithmeticOperator('sub')).toBe(true);
        });

        it('should recognize times/mul', () => {
            expect(isArithmeticOperator('times')).toBe(true);
            expect(isArithmeticOperator('mul')).toBe(true);
        });

        it('should recognize divide/div', () => {
            expect(isArithmeticOperator('divide')).toBe(true);
            expect(isArithmeticOperator('div')).toBe(true);
        });

        it('should recognize mod', () => {
            expect(isArithmeticOperator('mod')).toBe(true);
        });

        it('should not recognize regular functions', () => {
            expect(isArithmeticOperator('f')).toBe(false);
            expect(isArithmeticOperator('g')).toBe(false);
        });
    });

    describe('getArithmeticAxioms', () => {
        it('should include comparison predicates', () => {
            const axioms = getArithmeticAxioms();
            expect(axioms.some(a => a.includes('lt(X, Y)'))).toBe(true);
            expect(axioms.some(a => a.includes('gt(X, Y)'))).toBe(true);
            expect(axioms.some(a => a.includes('lte(X, Y)'))).toBe(true);
            expect(axioms.some(a => a.includes('gte(X, Y)'))).toBe(true);
        });

        it('should include arithmetic function predicates', () => {
            const axioms = getArithmeticAxioms();
            expect(axioms.some(a => a.includes('plus(X, Y, Z)'))).toBe(true);
            expect(axioms.some(a => a.includes('minus(X, Y, Z)'))).toBe(true);
            expect(axioms.some(a => a.includes('times(X, Y, Z)'))).toBe(true);
            expect(axioms.some(a => a.includes('divide(X, Y, Z)'))).toBe(true);
        });

        it('should include helper predicates', () => {
            const axioms = getArithmeticAxioms();
            expect(axioms.some(a => a.includes('succ('))).toBe(true);
            expect(axioms.some(a => a.includes('abs('))).toBe(true);
            expect(axioms.some(a => a.includes('min('))).toBe(true);
            expect(axioms.some(a => a.includes('max('))).toBe(true);
        });
    });

    describe('arithmeticToProlog', () => {
        it('should convert plus to infix', () => {
            const ast: any = {
                type: 'function', name: 'plus', args: [
                    { type: 'constant', name: 'a' },
                    { type: 'constant', name: 'b' },
                ]
            };
            expect(arithmeticToProlog(ast)).toBe('(a + b)');
        });

        it('should convert minus to infix', () => {
            const ast: any = {
                type: 'function', name: 'minus', args: [
                    { type: 'constant', name: 'a' },
                    { type: 'constant', name: 'b' },
                ]
            };
            expect(arithmeticToProlog(ast)).toBe('(a - b)');
        });

        it('should handle variables', () => {
            const ast: any = {
                type: 'function', name: 'plus', args: [
                    { type: 'variable', name: 'x' },
                    { type: 'constant', name: 'a' },
                ]
            };
            expect(arithmeticToProlog(ast)).toBe('(X + a)');
        });
    });

    describe('getArithmeticSetup', () => {
        it('should return non-empty string', () => {
            const setup = getArithmeticSetup();
            expect(setup.length).toBeGreaterThan(0);
        });

        it('should include all axioms joined', () => {
            const setup = getArithmeticSetup();
            expect(setup).toContain('lt(X, Y)');
            expect(setup).toContain('plus(X, Y, Z)');
        });
    });

    describe('isNumericConstant', () => {
        it('should recognize integers', () => {
            expect(isNumericConstant('123')).toBe(true);
            expect(isNumericConstant('0')).toBe(true);
            expect(isNumericConstant('-42')).toBe(true);
        });

        it('should recognize floats', () => {
            expect(isNumericConstant('3.14')).toBe(true);
            expect(isNumericConstant('-0.5')).toBe(true);
        });

        it('should reject non-numbers', () => {
            expect(isNumericConstant('abc')).toBe(false);
            expect(isNumericConstant('12abc')).toBe(false);
        });
    });

    describe('parseNumber', () => {
        it('should parse integers', () => {
            expect(parseNumber('42')).toBe(42);
            expect(parseNumber('-10')).toBe(-10);
        });

        it('should parse floats', () => {
            expect(parseNumber('3.14')).toBe(3.14);
        });

        it('should return null for non-numbers', () => {
            expect(parseNumber('abc')).toBeNull();
        });
    });

    describe('LogicEngine with arithmetic', () => {
        let engine: LogicEngine;

        beforeEach(() => {
            engine = new LogicEngine(5000, 1000);
        });

        // Note: Direct numeric evaluation tests require the Prolog engine
        // to receive numeric values, which happens when using raw Prolog syntax.
        // The FOL parser doesn't currently support numeric literals.
        // These tests verify the enableArithmetic option loads the axioms.

        it('should load arithmetic axioms without error', async () => {
            // Just verify we can create a session with arithmetic enabled
            const result = await engine.prove(
                [],
                'P', // Simple predicate that won't match
                { enableArithmetic: true }
            );
            // The proof fails (no P defined) but engine works
            expect(result.result).toBe('failed');
        });

        it('should include arithmetic axioms in program', async () => {
            // Verify that arithmetic axioms are prepended to programs
            const result = await engine.prove(
                ['P(x)'],  // Simple premise
                'P(x)',    // Simple query - should match
                { enableArithmetic: true, verbosity: 'detailed' }
            );
            // Verify the Prolog program includes arithmetic axioms
            expect(result.prologProgram).toBeDefined();
            expect(result.prologProgram).toContain('lt(X, Y)');
            expect(result.prologProgram).toContain('succ(');
        });
    });
});

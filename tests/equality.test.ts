/**
 * Tests for Equality Axiom Generation
 */

import {
    generateEqualityAxioms,
    containsEquality,
    generateMinimalEqualityAxioms,
    getEqualityBridge,
} from '../src/axioms/equality';
import { extractSignature, FormulaSignature as Signature } from '../src/utils/ast';
import { parse } from '../src/parser';

describe('Equality Axioms', () => {
    describe('generateEqualityAxioms', () => {
        it('should generate reflexivity axiom (via eq_d)', () => {
            const sig: Signature = {
                functions: new Map(),
                predicates: new Map(),
                constants: new Set(),
                variables: new Set(),
            };
            const axioms = generateEqualityAxioms(sig);
            expect(axioms.some(a => a.includes('eq_d(X, X, _).'))).toBe(true);
        });

        it('should generate symmetry axiom (via eq_step)', () => {
            const sig: Signature = {
                functions: new Map(),
                predicates: new Map(),
                constants: new Set(),
                variables: new Set(),
            };
            const axioms = generateEqualityAxioms(sig);
            expect(axioms.some(a => a.includes('eq_step(X, Y, _) :- eq_fact(Y, X).'))).toBe(true);
        });

        it('should generate transitivity axiom (via eq_d recursion)', () => {
            const sig: Signature = {
                functions: new Map(),
                predicates: new Map(),
                constants: new Set(),
                variables: new Set(),
            };
            const axioms = generateEqualityAxioms(sig);
            // eq_d(X, Y, D) :- D > 0, ... eq_step(X, Z, D1) ... eq_d(Z, Y, D1).
            expect(axioms.some(a =>
                a.includes('eq_d(X, Y, D) :-') &&
                a.includes('eq_step(X, Z, D1)') &&
                a.includes('eq_d(Z, Y, D1)')
            )).toBe(true);
        });

        it('should generate function congruence axioms (via eq_step)', () => {
            const sig: Signature = {
                functions: new Map([['f', 1]]),
                predicates: new Map(),
                constants: new Set(),
                variables: new Set(),
            };
            const axioms = generateEqualityAxioms(sig);
            // eq_step(f(X1), f(Y1), D) :- eq_d(X1, Y1, D).
            expect(axioms.some(a =>
                a.includes('eq_step(f(X1), f(Y1), D)') &&
                a.includes('eq_d(X1, Y1, D)')
            )).toBe(true);
        });

        it('should generate multi-arity function congruence', () => {
            const sig: Signature = {
                functions: new Map([['g', 2]]),
                predicates: new Map(),
                constants: new Set(),
                variables: new Set(),
            };
            const axioms = generateEqualityAxioms(sig);
            // eq_step(g(X1, X2), g(Y1, Y2), D) :- eq_d(X1, Y1, D), eq_d(X2, Y2, D).
            expect(axioms.some(a =>
                a.includes('eq_step(g(X1, X2), g(Y1, Y2), D)') &&
                a.includes('eq_d(X1, Y1, D)') &&
                a.includes('eq_d(X2, Y2, D)')
            )).toBe(true);
        });

        it('should generate predicate substitution axioms', () => {
            const sig: Signature = {
                functions: new Map(),
                predicates: new Map([['P', 1]]),
                constants: new Set(),
                variables: new Set(),
            };
            const axioms = generateEqualityAxioms(sig);
            // P(Y1) :- eq_d(X1, Y1, 5), P(X1).
            expect(axioms.some(a =>
                a.startsWith('P(Y1) :-') &&
                a.includes('eq_d(X1, Y1, 5)') &&
                a.includes('P(X1)')
            )).toBe(true);
        });
    });

    describe('PrologEngine with equality', () => {
        let prologEngine: any;

        beforeEach(async () => {
            const { PrologEngine } = await import('../src/engines/prolog');
            prologEngine = new PrologEngine(5000, 1000);
        });

        it('should inject base equality axioms (eq_d) when enabled', async () => {
            const result = await prologEngine.prove(
                [],
                'eq(alice, alice)',
                { enableEquality: true, verbosity: 'detailed' }
            );
            expect(result.prologProgram).toBeDefined();
            expect(result.prologProgram).toContain('eq_d(X, X, _)');
        });

        it('should inject bridge connecting eq to eq_d', async () => {
            const result = await prologEngine.prove(
                ['eq(alice, bob)'],
                'eq(bob, alice)',
                { enableEquality: true, verbosity: 'detailed' }
            );
            expect(result.prologProgram).toBeDefined();
            // eq(X, Y) :- eq_d(X, Y, 5).
            expect(result.prologProgram).toContain('eq(X, Y) :- eq_d(X, Y, 5)');
        });

        it('should not inject equality axioms when disabled', async () => {
            const result = await prologEngine.prove(
                ['alice = bob'],
                'P(x)',
                { enableEquality: false, verbosity: 'detailed' }
            );
            expect(result.prologProgram).toBeDefined();
            expect(result.prologProgram).not.toContain('eq_d(X, X, _)');
        });
    });

    describe('containsEquality', () => {
        it('should detect equality in simple formula', () => {
            const ast = parse('a = b');
            expect(containsEquality(ast)).toBe(true);
        });
        it('should return false when no equality', () => {
            const ast = parse('P(x) & Q(y)');
            expect(containsEquality(ast)).toBe(false);
        });
    });

    describe('generateMinimalEqualityAxioms', () => {
        it('should return empty for formulas without equality', () => {
            const asts = [parse('P(x) & Q(y)')];
            const axioms = generateMinimalEqualityAxioms(asts);
            expect(axioms).toHaveLength(0);
        });

        it('should generate axioms when equality is used', () => {
            const asts = [parse('x = y'), parse('P(x)')];
            const axioms = generateMinimalEqualityAxioms(asts);
            expect(axioms.length).toBeGreaterThan(0);
            expect(axioms.some(a => a.includes('P('))).toBe(true);
        });
    });
});

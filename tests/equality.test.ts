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
        it('should generate reflexivity axiom', () => {
            const sig: Signature = {
                functions: new Map(),
                predicates: new Map(),
                constants: new Set(),
                variables: new Set(),
            };
            const axioms = generateEqualityAxioms(sig);
            expect(axioms.some(a => a.includes('eq(X, X).'))).toBe(true);
        });

        it('should generate symmetry axiom', () => {
            const sig: Signature = {
                functions: new Map(),
                predicates: new Map(),
                constants: new Set(),
                variables: new Set(),
            };
            const axioms = generateEqualityAxioms(sig);
            expect(axioms.some(a => a.includes('eq(X, Y)') && a.includes('eq(Y, X)'))).toBe(true);
        });

        it('should generate transitivity axiom', () => {
            const sig: Signature = {
                functions: new Map(),
                predicates: new Map(),
                constants: new Set(),
                variables: new Set(),
            };
            const axioms = generateEqualityAxioms(sig);
            expect(axioms.some(a =>
                a.includes('eq(X, Z)') &&
                a.includes('eq(X, Y)') &&
                a.includes('eq(Y, Z)')
            )).toBe(true);
        });

        it('should generate function congruence axioms', () => {
            const sig: Signature = {
                functions: new Map([['f', 1]]),
                predicates: new Map(),
                constants: new Set(),
                variables: new Set(),
            };
            const axioms = generateEqualityAxioms(sig);
            // eq(f(X1), f(Y1)) :- eq(X1, Y1).
            expect(axioms.some(a =>
                a.includes('eq(f(X1), f(Y1))') &&
                a.includes('eq(X1, Y1)')
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
            // eq(g(X1, X2), g(Y1, Y2)) :- eq(X1, Y1), eq(X2, Y2).
            expect(axioms.some(a =>
                a.includes('g(X1, X2)') &&
                a.includes('g(Y1, Y2)') &&
                a.includes('eq(X1, Y1)') &&
                a.includes('eq(X2, Y2)')
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
            // P(Y1) :- eq(X1, Y1), P(X1).
            expect(axioms.some(a =>
                a.startsWith('P(Y1) :-') &&
                a.includes('eq(X1, Y1)') &&
                a.includes('P(X1)')
            )).toBe(true);
        });

        it('should skip congruence when disabled', () => {
            const sig: Signature = {
                functions: new Map([['f', 1]]),
                predicates: new Map(),
                constants: new Set(),
                variables: new Set(),
            };
            const axioms = generateEqualityAxioms(sig, { includeCongruence: false });
            expect(axioms.some(a => a.includes('f(X1)'))).toBe(false);
        });

        it('should skip substitution when disabled', () => {
            const sig: Signature = {
                functions: new Map(),
                predicates: new Map([['P', 1]]),
                constants: new Set(),
                variables: new Set(),
            };
            const axioms = generateEqualityAxioms(sig, { includeSubstitution: false });
            expect(axioms.some(a => a.startsWith('P(Y1)'))).toBe(false);
        });
    });

    describe('containsEquality', () => {
        it('should detect equality in simple formula', () => {
            const ast = parse('a = b');
            expect(containsEquality(ast)).toBe(true);
        });

        it('should detect equality in nested formula', () => {
            const ast = parse('P(x) & (a = b)');
            expect(containsEquality(ast)).toBe(true);
        });

        it('should detect equality under quantifier', () => {
            const ast = parse('all x (x = x)');
            expect(containsEquality(ast)).toBe(true);
        });

        it('should return false when no equality', () => {
            const ast = parse('P(x) & Q(y)');
            expect(containsEquality(ast)).toBe(false);
        });

        it('should detect equality in implication', () => {
            const ast = parse('P(x) -> x = y');
            expect(containsEquality(ast)).toBe(true);
        });

        it('should detect equality under negation', () => {
            const ast = parse('-(a = b)');
            expect(containsEquality(ast)).toBe(true);
        });
    });

    describe('extractSignature', () => {
        it('should extract predicates with correct arity', () => {
            const ast = parse('P(x, y) & Q(z)');
            const sig = extractSignature([ast]);
            expect(sig.predicates.get('P')).toBe(2);
            expect(sig.predicates.get('Q')).toBe(1);
        });

        it('should extract functions with correct arity', () => {
            const ast = parse('P(f(x), g(x, y))');
            const sig = extractSignature([ast]);
            expect(sig.functions.get('f')).toBe(1);
            expect(sig.functions.get('g')).toBe(2);
        });

        it('should extract constants', () => {
            const ast = parse('P(socrates)');
            const sig = extractSignature([ast]);
            expect(sig.constants.has('socrates')).toBe(true);
        });

        it('should handle complex nested formulas', () => {
            const ast = parse('all x exists y (P(x, f(y)) -> Q(g(x, y)))');
            const sig = extractSignature([ast]);
            expect(sig.predicates.get('P')).toBe(2);
            expect(sig.predicates.get('Q')).toBe(1);
            expect(sig.functions.get('f')).toBe(1);
            expect(sig.functions.get('g')).toBe(2);
        });
    });

    describe('extractSignature (multiple)', () => {
        it('should combine signatures from multiple formulas', () => {
            const asts = [
                parse('P(x)'),
                parse('Q(x, y)'),
                parse('R(f(x))'),
            ];
            const sig = extractSignature(asts);
            expect(sig.predicates.size).toBe(3);
            expect(sig.functions.size).toBe(1);
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
            // Should have P substitution axiom
            expect(axioms.some(a => a.includes('P('))).toBe(true);
        });

        it('should include function congruence when functions used', () => {
            const asts = [parse('f(x) = f(y)')];
            const axioms = generateMinimalEqualityAxioms(asts);
            expect(axioms.some(a =>
                a.includes('f(X1)') && a.includes('f(Y1)')
            )).toBe(true);
        });
    });

    describe('getEqualityBridge', () => {
        it('should return Prolog unification bridge', () => {
            const bridge = getEqualityBridge();
            expect(bridge.some(b => b.includes('eq(X, Y)') && b.includes('X = Y'))).toBe(true);
        });

        it('should include inequality helper', () => {
            const bridge = getEqualityBridge();
            expect(bridge.some(b => b.includes('neq'))).toBe(true);
        });
    });

    describe('PrologEngine with equality', () => {
        let engine: PrologEngine;

        beforeEach(async () => {
            const { PrologEngine } = await import('../src/engines/prolog');
            engine = new PrologEngine(5000, 1000);
        });

        it('should inject base equality axioms when enabled', async () => {
            // Verify that base equality axioms are always injected when enableEquality=true
            const result = await engine.prove(
                [],
                'eq(alice, alice)',
                { enableEquality: true, verbosity: 'detailed' }
            );
            expect(result.prologProgram).toBeDefined();
            // Check that base axioms are present
            expect(result.prologProgram).toContain('eq(X, X)');
            expect(result.prologProgram).toContain('eq(X, Y)');
        });

        it('should inject bridge connecting eq to Prolog unification', async () => {
            const result = await engine.prove(
                ['eq(alice, bob)'],
                'eq(bob, alice)',
                { enableEquality: true, verbosity: 'detailed' }
            );
            expect(result.prologProgram).toBeDefined();
            // Check bridge axiom exists
            expect(result.prologProgram).toContain('X = Y');
        });

        it('should include equality axioms in program when detailed', async () => {
            // Must include equality formula to trigger axiom generation
            const result = await engine.prove(
                ['alice = bob'],  // Equality triggers axiom injection
                'eq(bob, alice)',
                { enableEquality: true, verbosity: 'detailed' }
            );
            expect(result.prologProgram).toBeDefined();
            expect(result.prologProgram).toContain('eq(X, X)');
        });

        it('should not inject equality axioms when disabled', async () => {
            const result = await engine.prove(
                ['alice = bob'],
                'P(x)',
                { enableEquality: false, verbosity: 'detailed' }
            );
            expect(result.prologProgram).toBeDefined();
            expect(result.prologProgram).not.toContain('eq(X, X)');
        });
    });
});

/**
 * Equality Axioms Generator
 * 
 * Generates axioms for first-class equality reasoning:
 * - Reflexivity: ∀x. x = x
 * - Symmetry: ∀x∀y. x = y → y = x
 * - Transitivity: ∀x∀y∀z. x = y ∧ y = z → x = z
 * - Congruence: For each function f, ∀x∀y. x = y → f(x) = f(y)
 * - Substitution: For each predicate P, ∀x∀y. x = y ∧ P(x) → P(y)
 */

import type { ASTNode } from '../types/index.js';
import { extractSignature, FormulaSignature } from '../utils/ast-modules/index.js';

/**
 * Options for equality axiom generation.
 */
export interface EqualityAxiomsOptions {
    /** Maximum iterations for recursive equality rules (default: 100) */
    maxIterations?: number;
    /** Whether to include congruence axioms for functions (default: true) */
    includeCongruence?: boolean;
    /** Whether to include substitution axioms for predicates (default: true) */
    includeSubstitution?: boolean;
}

/**
 * Generate equality axioms as Prolog clauses.
 * 
 * @param signature - Function and predicate signatures for congruence axioms
 * @param options - Generation options
 * @returns Array of Prolog clause strings
 */
export function generateEqualityAxioms(
    signature: FormulaSignature,
    options: EqualityAxiomsOptions = {}
): string[] {
    const maxIter = options.maxIterations ?? 5; // Default depth 5 to prevent stack overflow
    const includeCongruence = options.includeCongruence !== false;
    const includeSubstitution = options.includeSubstitution !== false;

    const axioms: string[] = [];

    // Main equality interface
    axioms.push(`eq(X, Y) :- eq_d(X, Y, ${maxIter}).`);

    // Depth-limited equality (Transitive Closure)
    // Base case: Reflexivity
    axioms.push('eq_d(X, X, _).');

    // Recursive step: Transitivity via eq_step
    // eq_d(X, Y, D) :- D > 0, D1 is D - 1, eq_step(X, Z, D1), Z \== X, eq_d(Z, Y, D1).
    axioms.push('eq_d(X, Y, D) :- D > 0, D1 is D - 1, eq_step(X, Z, D1), Z \\\\== X, eq_d(Z, Y, D1).');

    // eq_step: Single step of equality
    // 1. Unification (Bridge) - Removed to prevent trivial loops, handled by eq_d reflexivity
    // axioms.push('eq_step(X, Y, _) :- X = Y.');

    // 2. User facts (eq_fact)
    axioms.push('eq_step(X, Y, _) :- eq_fact(X, Y).');

    // 3. Symmetry of user facts
    axioms.push('eq_step(X, Y, _) :- eq_fact(Y, X).');

    // Congruence axioms for functions
    if (includeCongruence) {
        for (const [fn, arity] of signature.functions) {
            if (arity > 0) {
                const axiom = generateFunctionCongruence(fn, arity);
                axioms.push(axiom);
            }
        }
    }

    // Substitution axioms for predicates
    if (includeSubstitution) {
        for (const [pred, arity] of signature.predicates) {
            if (pred !== 'eq' && pred !== 'eq_fact' && pred !== 'eq_d' && pred !== 'eq_step' && arity > 0) {
                const axiom = generatePredicateSubstitution(pred, arity, maxIter);
                axioms.push(axiom);
            }
        }
    }

    return axioms;
}

/**
 * Generate congruence axiom for a function.
 * 
 * eq_step(f(X...), f(Y...), D) :- eq_d(X, Y, D)...
 */
function generateFunctionCongruence(fn: string, arity: number): string {
    const xs = Array.from({ length: arity }, (_, i) => `X${i + 1}`);
    const ys = Array.from({ length: arity }, (_, i) => `Y${i + 1}`);
    const equalities = xs.map((x, i) => `eq_d(${x}, ${ys[i]}, D)`).join(', ');
    const leftTerm = `${fn}(${xs.join(', ')})`;
    const rightTerm = `${fn}(${ys.join(', ')})`;
    return `eq_step(${leftTerm}, ${rightTerm}, D) :- ${equalities}.`;
}

/**
 * Generate substitution axiom for a predicate.
 * 
 * P(Y...) :- eq_d(X, Y, MaxDepth), P(X...).
 */
function generatePredicateSubstitution(pred: string, arity: number, maxDepth: number): string {
    const xs = Array.from({ length: arity }, (_, i) => `X${i + 1}`);
    const ys = Array.from({ length: arity }, (_, i) => `Y${i + 1}`);
    // We use full depth for substitution to allow reasoning
    const equalities = xs.map((x, i) => `eq_d(${x}, ${ys[i]}, ${maxDepth})`).join(', ');
    const original = `${pred}(${xs.join(', ')})`;
    const substituted = `${pred}(${ys.join(', ')})`;
    return `${substituted} :- ${equalities}, ${original}.`;
}

export { containsEquality } from '../utils/ast-modules/index.js';
import { containsEquality } from '../utils/ast-modules/index.js';

export function generateMinimalEqualityAxioms(
    formulas: ASTNode[],
    options: EqualityAxiomsOptions = {}
): string[] {
    if (!formulas.some(containsEquality)) {
        return [];
    }
    const signature = extractSignature(formulas);
    return generateEqualityAxioms(signature, options);
}

export function getEqualityBridge(): string[] {
    return [
        '% Bridge handled by eq_step',
        'neq(X, Y) :- X \\\\== Y.',
    ];
}

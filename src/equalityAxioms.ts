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

import { ASTNode } from './parser.js';

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
 * Signature of functions and predicates in a formula.
 */
export interface Signature {
    /** Function symbols: name → arity */
    functions: Map<string, number>;
    /** Predicate symbols: name → arity */
    predicates: Map<string, number>;
    /** Constant symbols */
    constants: Set<string>;
}

/**
 * Generate equality axioms as Prolog clauses.
 * 
 * @param signature - Function and predicate signatures for congruence axioms
 * @param options - Generation options
 * @returns Array of Prolog clause strings
 */
export function generateEqualityAxioms(
    signature: Signature,
    options: EqualityAxiomsOptions = {}
): string[] {
    const maxIter = options.maxIterations ?? 100;
    const includeCongruence = options.includeCongruence !== false;
    const includeSubstitution = options.includeSubstitution !== false;

    const axioms: string[] = [];

    // Reflexivity: eq(X, X).
    axioms.push('eq(X, X).');

    // Symmetry with iteration guard: eq(X, Y) :- eq(Y, X), X \\== Y.
    // Using \\== to prevent infinite loop on reflexive case
    axioms.push('eq(X, Y) :- eq(Y, X), X \\\\== Y.');

    // Transitivity with iteration guard
    // eq(X, Z) :- eq(X, Y), eq(Y, Z), X \\== Z.
    axioms.push('eq(X, Z) :- eq(X, Y), eq(Y, Z), X \\\\== Z, Y \\\\== X, Y \\\\== Z.');

    // Alternative: Use a depth-limited version for safety
    axioms.push(`% Depth-limited equality for complex cases`);
    axioms.push(`eq_depth(X, X, _).`);
    axioms.push(`eq_depth(X, Y, D) :- D > 0, D1 is D - 1, eq(X, Z), eq_depth(Z, Y, D1), X \\\\== Y.`);

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
            if (pred !== 'eq' && arity > 0) {
                const axiom = generatePredicateSubstitution(pred, arity);
                axioms.push(axiom);
            }
        }
    }

    return axioms;
}

/**
 * Generate congruence axiom for a function.
 * 
 * For f with arity n:
 * eq(f(X1,...,Xn), f(Y1,...,Yn)) :- eq(X1,Y1), ..., eq(Xn,Yn).
 */
function generateFunctionCongruence(fn: string, arity: number): string {
    const xs = Array.from({ length: arity }, (_, i) => `X${i + 1}`);
    const ys = Array.from({ length: arity }, (_, i) => `Y${i + 1}`);
    const equalities = xs.map((x, i) => `eq(${x}, ${ys[i]})`).join(', ');
    const leftTerm = `${fn}(${xs.join(', ')})`;
    const rightTerm = `${fn}(${ys.join(', ')})`;
    return `eq(${leftTerm}, ${rightTerm}) :- ${equalities}.`;
}

/**
 * Generate substitution axiom for a predicate.
 * 
 * For P with arity n:
 * P(Y1,...,Yn) :- eq(X1,Y1), ..., eq(Xn,Yn), P(X1,...,Xn).
 * 
 * This allows substituting equals in predicate arguments.
 */
function generatePredicateSubstitution(pred: string, arity: number): string {
    const xs = Array.from({ length: arity }, (_, i) => `X${i + 1}`);
    const ys = Array.from({ length: arity }, (_, i) => `Y${i + 1}`);
    const equalities = xs.map((x, i) => `eq(${x}, ${ys[i]})`).join(', ');
    const original = `${pred}(${xs.join(', ')})`;
    const substituted = `${pred}(${ys.join(', ')})`;
    return `${substituted} :- ${equalities}, ${original}.`;
}

/**
 * Check if an AST contains equality (=) usage.
 */
export function containsEquality(node: ASTNode): boolean {
    switch (node.type) {
        case 'equals':
            return true;

        case 'and':
        case 'or':
        case 'implies':
        case 'iff':
            return containsEquality(node.left!) || containsEquality(node.right!);

        case 'not':
            return containsEquality(node.operand!);

        case 'forall':
        case 'exists':
            return containsEquality(node.body!);

        case 'predicate':
            // Check if any argument contains equality (shouldn't happen but be safe)
            return node.args?.some(containsEquality) ?? false;

        default:
            return false;
    }
}

/**
 * Extract function and predicate signatures from an AST.
 */
export function extractSignature(node: ASTNode): Signature {
    const functions = new Map<string, number>();
    const predicates = new Map<string, number>();
    const constants = new Set<string>();

    function visit(n: ASTNode): void {
        switch (n.type) {
            case 'predicate':
                predicates.set(n.name!, n.args?.length ?? 0);
                n.args?.forEach(visit);
                break;

            case 'function':
                functions.set(n.name!, n.args?.length ?? 0);
                n.args?.forEach(visit);
                break;

            case 'constant':
                constants.add(n.name!);
                break;

            case 'and':
            case 'or':
            case 'implies':
            case 'iff':
            case 'equals':
                visit(n.left!);
                visit(n.right!);
                break;

            case 'not':
                visit(n.operand!);
                break;

            case 'forall':
            case 'exists':
                visit(n.body!);
                break;
        }
    }

    visit(node);
    return { functions, predicates, constants };
}

/**
 * Extract signatures from multiple ASTs.
 */
export function extractSignatures(nodes: ASTNode[]): Signature {
    const combined: Signature = {
        functions: new Map(),
        predicates: new Map(),
        constants: new Set(),
    };

    for (const node of nodes) {
        const sig = extractSignature(node);
        for (const [name, arity] of sig.functions) {
            combined.functions.set(name, arity);
        }
        for (const [name, arity] of sig.predicates) {
            combined.predicates.set(name, arity);
        }
        for (const c of sig.constants) {
            combined.constants.add(c);
        }
    }

    return combined;
}

/**
 * Generate a minimal set of equality axioms for a specific use case.
 * Only generates axioms for the functions/predicates actually used.
 */
export function generateMinimalEqualityAxioms(
    formulas: ASTNode[],
    options: EqualityAxiomsOptions = {}
): string[] {
    // Check if any formula uses equality
    if (!formulas.some(containsEquality)) {
        return []; // No equality axioms needed
    }

    const signature = extractSignatures(formulas);
    return generateEqualityAxioms(signature, options);
}

/**
 * Wrap Prolog equality (=) with our eq predicate for proper reasoning.
 * This allows using Prolog's built-in unification alongside our axioms.
 */
export function getEqualityBridge(): string[] {
    return [
        '% Bridge between Prolog unification and logic equality',
        'eq(X, Y) :- X = Y.',  // Use Prolog unification
        '% Inequality',
        'neq(X, Y) :- X \\\\== Y.',  // Inequality using not-identical
    ];
}

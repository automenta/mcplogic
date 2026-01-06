/**
 * Clausifier - CNF Transformation
 * 
 * Converts arbitrary First-Order Logic formulas to Conjunctive Normal Form (CNF).
 * Implements the standard clausification algorithm:
 * 1. Eliminate biconditionals (↔)
 * 2. Eliminate implications (→)
 * 3. Push negations inward (NNF)
 * 4. Standardize variables (unique names per quantifier)
 * 5. Skolemize (eliminate existential quantifiers)
 * 6. Drop universal quantifiers
 * 7. Distribute OR over AND (CNF)
 * 8. Extract clauses
 */

import { parse } from './parser.js';
import { countNodes, astToString } from './utils/ast.js';
import type { ASTNode } from './types/index.js';
import {
    Literal,
    Clause,
    ClausifyOptions,
    ClausifyResult,
    createSkolemEnv,
    isTautology,
} from './utils/clause.js';
import {
    toNNF,
    standardizeVariables,
    skolemize,
    dropUniversals,
    distribute,
} from './utils/transform.js';
import { createClausificationError, createGenericError } from './types/errors.js';

/** Default clausification options */
const DEFAULT_OPTIONS: Required<ClausifyOptions> = {
    maxClauses: 10000,
    maxClauseSize: 50,
    timeout: 5000,
};

/**
 * Clausify a FOL formula string.
 * 
 * @param formula - The FOL formula to clausify
 * @param options - Clausification options
 * @returns ClausifyResult with clauses or error
 */
export function clausify(formula: string, options: ClausifyOptions = {}): ClausifyResult {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
        const ast = parse(formula);
        const originalSize = countNodes(ast);

        // Step 1-3: Convert to Negation Normal Form
        const nnf = toNNF(ast);

        // Step 4: Standardize variables
        const standardized = standardizeVariables(nnf);

        // Step 5: Skolemize
        const skolemEnv = createSkolemEnv();
        const skolemized = skolemize(standardized, skolemEnv);

        // Step 6: Drop universal quantifiers
        const quantifierFree = dropUniversals(skolemized);

        // Step 7-8: Convert to CNF and extract clauses
        const clauses = toCNF(quantifierFree, opts, startTime);

        // Filter tautologies
        const filteredClauses = clauses.filter(c => !isTautology(c));

        const timeMs = Date.now() - startTime;
        const maxClauseSize = filteredClauses.reduce(
            (max, c) => Math.max(max, c.literals.length),
            0
        );

        return {
            success: true,
            clauses: filteredClauses,
            skolemFunctions: new Map(skolemEnv.generatedSkolems),
            statistics: {
                originalSize,
                clauseCount: filteredClauses.length,
                maxClauseSize,
                timeMs,
            },
        };
    } catch (e) {
        const timeMs = Date.now() - startTime;
        const error = e instanceof Error ? e : createGenericError('CLAUSIFICATION_ERROR', String(e));

        return {
            success: false,
            error: createClausificationError(error.message).error,
            statistics: {
                originalSize: 0,
                clauseCount: 0,
                maxClauseSize: 0,
                timeMs,
            },
        };
    }
}

/**
 * Convert a quantifier-free NNF formula to CNF and extract clauses.
 */
export function toCNF(
    node: ASTNode,
    options: Required<ClausifyOptions>,
    startTime: number
): Clause[] {
    // First, distribute OR over AND to get CNF
    const cnfAst = distribute(node, options, startTime);

    // Extract clauses from the CNF AST
    return extractClauses(cnfAst);
}

/**
 * Extract clauses from a CNF AST.
 * The AST should be a conjunction of disjunctions of literals.
 */
function extractClauses(node: ASTNode): Clause[] {
    const clauses: Clause[] = [];

    function extractConjuncts(n: ASTNode): void {
        if (n.type === 'and') {
            extractConjuncts(n.left!);
            extractConjuncts(n.right!);
        } else {
            // This should be a disjunction (or single literal)
            const literals = extractDisjuncts(n);
            clauses.push({ literals });
        }
    }

    function extractDisjuncts(n: ASTNode): Literal[] {
        if (n.type === 'or') {
            return [...extractDisjuncts(n.left!), ...extractDisjuncts(n.right!)];
        } else {
            return [nodeToLiteral(n)];
        }
    }

    extractConjuncts(node);
    return clauses;
}

/**
 * Convert an AST node to a literal.
 */
function nodeToLiteral(node: ASTNode): Literal {
    if (node.type === 'not') {
        const inner = node.operand!;
        if (inner.type === 'predicate') {
            return {
                predicate: inner.name!,
                args: (inner.args || []).map(astToString),
                negated: true,
            };
        } else if (inner.type === 'equals') {
            // ¬(a = b) represented as special predicate
            return {
                predicate: '=',
                args: [astToString(inner.left!), astToString(inner.right!)],
                negated: true,
            };
        }
        throw createClausificationError(`Cannot convert ${inner.type} to literal`);
    }

    if (node.type === 'predicate') {
        return {
            predicate: node.name!,
            args: (node.args || []).map(astToString),
            negated: false,
        };
    }

    if (node.type === 'equals') {
        return {
            predicate: '=',
            args: [astToString(node.left!), astToString(node.right!)],
            negated: false,
        };
    }

    throw createClausificationError(`Cannot convert ${node.type} to literal`);
}

/**
 * Check if a formula is already in Horn clause form.
 * A Horn clause has at most one positive literal.
 */
export function isHornFormula(clauses: Clause[]): boolean {
    for (const clause of clauses) {
        const positiveCount = clause.literals.filter(l => !l.negated).length;
        if (positiveCount > 1) return false;
    }
    return true;
}

export { clausesToDIMACS } from './utils/clause.js';
export {
    toNNF,
    standardizeVariables,
    skolemize,
    dropUniversals,
} from './utils/transform.js';

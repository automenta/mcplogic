import { ASTNode } from '../types/ast.js';
import { Clause, ClausifyOptions, Literal } from '../types/clause.js';
import { astToString } from './ast.js';
import { distribute } from './transform.js';
import { createClausificationError } from '../types/errors.js';

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

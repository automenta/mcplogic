/**
 * CNF Clause Utilities
 *
 * Helper functions for working with CNF clauses.
 * Moved from src/types/clause.ts
 */

import { Clause, Literal, SkolemEnv, DIMACSResult, ClausifyOptions, ClausifyResult } from '../types/clause.js';
import { astToString } from '../ast/index.js';
import { ASTNode } from '../types/ast.js';

export type {
    Clause,
    Literal,
    SkolemEnv,
    DIMACSResult,
    ClausifyOptions,
    ClausifyResult
};

/**
 * Create a new Skolem environment.
 */
export function createSkolemEnv(): SkolemEnv {
    return {
        counter: 0,
        skolemMap: new Map(),
        universalVars: [],
        generatedSkolems: new Map(),
    };
}

/**
 * Check if two literals are complementary (same predicate, opposite sign).
 */
export function areComplementary(l1: Literal, l2: Literal): boolean {
    if (l1.predicate !== l2.predicate) return false;
    if (l1.negated === l2.negated) return false;
    if (l1.args.length !== l2.args.length) return false;

    // Deep comparison of AST arguments
    // We can rely on astToString as a canonical representation for comparison
    // since we don't have a deepEquals utility handy and this is safe for terms.
    for (let i = 0; i < l1.args.length; i++) {
        if (astToString(l1.args[i]) !== astToString(l2.args[i])) {
            return false;
        }
    }
    return true;
}

/**
 * Check if a clause is a tautology (contains complementary literals).
 */
export function isTautology(clause: Clause): boolean {
    for (let i = 0; i < clause.literals.length; i++) {
        for (let j = i + 1; j < clause.literals.length; j++) {
            if (areComplementary(clause.literals[i], clause.literals[j])) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Format a literal as a string.
 */
export function literalToString(lit: Literal): string {
    const args = lit.args.map(astToString);
    const atom = args.length > 0
        ? `${lit.predicate}(${args.join(', ')})`
        : lit.predicate;
    return lit.negated ? `¬${atom}` : atom;
}

/**
 * Format a clause as a string (disjunction of literals).
 */
export function clauseToString(clause: Clause): string {
    if (clause.literals.length === 0) return '□'; // Empty clause = false
    return clause.literals.map(literalToString).join(' ∨ ');
}

/**
 * Format CNF as a string (conjunction of clauses).
 */
export function cnfToString(clauses: Clause[]): string {
    if (clauses.length === 0) return '⊤'; // No clauses = true
    return clauses.map(c => `(${clauseToString(c)})`).join(' ∧ ');
}

/**
 * Convert a literal to its unique atom key (without negation).
 */
export function atomToKey(lit: Literal): string {
    const args = lit.args.map(astToString);
    return args.length > 0
        ? `${lit.predicate}(${args.join(',')})`
        : lit.predicate;
}

/**
 * Convert clauses to DIMACS CNF format.
 *
 * DIMACS format is the standard input format for SAT solvers.
 * Each clause is a line of space-separated integers ending with 0.
 * Positive integers represent positive literals, negative represent negated.
 *
 * @param clauses - Array of clauses in CNF
 * @returns DIMACSResult with DIMACS string and variable mapping
 */
export function clausesToDIMACS(clauses: Clause[]): DIMACSResult {
    const varMap = new Map<string, number>();
    let nextVar = 1;

    // First pass: assign unique positive integers to each atom
    for (const clause of clauses) {
        for (const lit of clause.literals) {
            const key = atomToKey(lit);
            if (!varMap.has(key)) {
                varMap.set(key, nextVar++);
            }
        }
    }

    // Second pass: build DIMACS clauses
    const clauseLines: string[] = [];
    for (const clause of clauses) {
        const literals: number[] = [];
        for (const lit of clause.literals) {
            const key = atomToKey(lit);
            const varNum = varMap.get(key)!;
            literals.push(lit.negated ? -varNum : varNum);
        }
        clauseLines.push(literals.join(' ') + ' 0');
    }

    // Build DIMACS output
    const header = `p cnf ${varMap.size} ${clauses.length}`;
    const dimacs = [header, ...clauseLines].join('\n');

    return {
        dimacs,
        varMap,
        stats: {
            variables: varMap.size,
            clauses: clauses.length,
        },
    };
}

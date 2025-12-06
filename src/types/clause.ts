/**
 * CNF Clause Types
 * 
 * Types for representing formulas in Conjunctive Normal Form (CNF).
 * Used by the clausifier to transform arbitrary FOL into clause form.
 */

import { LogicError } from './errors.js';

/**
 * A literal is a predicate or its negation.
 * In CNF, clauses are disjunctions of literals.
 */
export interface Literal {
    /** Predicate name */
    predicate: string;
    /** Arguments (variable or constant names) */
    args: string[];
    /** Whether this literal is negated */
    negated: boolean;
}

/**
 * A clause is a disjunction of literals.
 * A CNF formula is a conjunction of clauses.
 */
export interface Clause {
    /** Literals in this clause (implicitly disjunctive) */
    literals: Literal[];
    /** Original formula this clause was derived from (for debugging) */
    origin?: string;
}

/**
 * Options for the clausification process.
 */
export interface ClausifyOptions {
    /** Maximum number of clauses before aborting (default: 10000) */
    maxClauses?: number;
    /** Maximum literals per clause before aborting (default: 50) */
    maxClauseSize?: number;
    /** Timeout in milliseconds (default: 5000) */
    timeout?: number;
}

/**
 * Result of clausification.
 */
export interface ClausifyResult {
    /** Whether clausification succeeded */
    success: boolean;
    /** The resulting clauses (if successful) */
    clauses?: Clause[];
    /** Skolem functions introduced during clausification (name → arity) */
    skolemFunctions?: Map<string, number>;
    /** Error information (if failed) */
    error?: LogicError;
    /** Statistics about the clausification */
    statistics: {
        /** Number of AST nodes in input formula */
        originalSize: number;
        /** Number of clauses produced */
        clauseCount: number;
        /** Maximum clause size (literals) */
        maxClauseSize: number;
        /** Time taken in milliseconds */
        timeMs: number;
    };
}

/**
 * Environment for Skolemization, tracking free variables and generated function names.
 */
export interface SkolemEnv {
    /** Counter for generating unique Skolem function names */
    counter: number;
    /** Map of existentially quantified variables to their Skolem terms */
    skolemMap: Map<string, { name: string; args: string[] }>;
    /** Currently bound universal variables (for creating Skolem function arguments) */
    universalVars: string[];
    /** Permanent record of all generated Skolem functions (name → arity) */
    generatedSkolems: Map<string, number>;
}

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
    return l1.args.every((arg, i) => arg === l2.args[i]);
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
    const atom = lit.args.length > 0
        ? `${lit.predicate}(${lit.args.join(', ')})`
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
 * Result of converting clauses to DIMACS format.
 */
export interface DIMACSResult {
    /** DIMACS CNF format string: "p cnf <vars> <clauses>\n<clause lines>" */
    dimacs: string;
    /** Mapping from atom strings to positive integer variable numbers */
    varMap: Map<string, number>;
    /** Statistics about the DIMACS output */
    stats: { variables: number; clauses: number };
}

/**
 * Convert a literal to its unique atom key (without negation).
 */
export function atomToKey(lit: Literal): string {
    return lit.args.length > 0
        ? `${lit.predicate}(${lit.args.join(',')})`
        : lit.predicate;
}


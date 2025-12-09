/**
 * Translator: Prover9 FOL Syntax ↔ Prolog Syntax
 * 
 * Converts between Prover9-style formulas and Tau-Prolog compatible format.
 */

import { parse } from './parser.js';
import type { ASTNode } from './types/index.js';
import {
    createClausificationError,
    createEngineError,
} from './types/errors.js';
import { clausify } from './clausifier.js';
import { Clause, Literal } from './types/clause.js';

/**
 * Convert a Prover9-style formula to Prolog
 * 
 * Prover9: all x (man(x) -> mortal(x))
 * Prolog:  mortal(X) :- man(X).
 * 
 * Uses clausification to handle Skolemization and normalization.
 * If the formula results in non-Horn clauses, it falls back to legacy translation
 * (which may produce meta-logical terms like (A;B) that are valid Prolog syntax
 * but not executable clauses).
 */
export function folToProlog(formula: string): string[] {
    // Use clausifier to handle Skolemization, NNF, and variable standardization
    const result = clausify(formula);

    if (!result.success || !result.clauses) {
        // Should not happen unless parser fails, which clausify catches
        throw createClausificationError(result.error?.message || 'Clausification failed');
    }

    try {
        return clausesToProlog(result.clauses);
    } catch (e) {
        // Not Horn clauses (e.g. A | B).
        // The Prolog engine cannot natively reason with non-Horn clauses as premises.
        // We throw a specific error so the EngineManager can switch to SAT if needed.
        throw createEngineError(
            'Formula is not a Horn clause (contains disjunctions in positive positions). ' +
            'The Prolog engine only supports Horn clauses. Use the SAT engine for general FOL.'
        );
    }
}

/**
 * Convert clauses to Prolog-compatible format.
 * Only works for Horn clauses.
 */
export function clausesToProlog(clauses: Clause[]): string[] {
    const prologClauses: string[] = [];

    for (const clause of clauses) {
        const positive = clause.literals.filter(l => !l.negated);
        const negative = clause.literals.filter(l => l.negated);

        if (positive.length === 0) {
            // Goal clause (all negative) - represents a query
            // :- p, q. means "prove p and q"
            const body = negative.map(l => literalToProlog(l, false)).join(', ');
            prologClauses.push(`:- ${body}.`);
        } else if (positive.length === 1) {
            const head = literalToProlog(positive[0], false);
            if (negative.length === 0) {
                // Fact
                prologClauses.push(`${head}.`);
            } else {
                // Rule
                const body = negative.map(l => literalToProlog(l, false)).join(', ');
                prologClauses.push(`${head} :- ${body}.`);
            }
        } else {
            // Not a Horn clause - cannot directly convert
            throw new Error('Cannot convert non-Horn clause to Prolog');
        }
    }

    return prologClauses;
}

/**
 * Convert a literal to Prolog format.
 */
function literalToProlog(lit: Literal, useNegation: boolean): string {
    const formatArg = (arg: string): string => {
        return formatPrologTerm(arg);
    };

    const atom = lit.args.length > 0
        ? `${lit.predicate}(${lit.args.map(formatArg).join(', ')})`
        : lit.predicate;

    if (useNegation && lit.negated) {
        return `\\+ ${atom}`;
    }
    return atom;
}

/**
 * Formats a term string (variable or constant) for Prolog.
 *
 * Rules:
 * - Variables (start with _ or uppercase) -> Uppercase
 * - Skolem constants (start with sk) -> Lowercase
 * - Free variables (single lowercase letter) -> Uppercase (implicit universal)
 * - Constants (lowercase or uppercase) -> Lowercase
 */
function formatPrologTerm(term: string): string {
    if (term.startsWith('_v')) {
        // It's a variable from Clausifier, ensure uppercase for Prolog
        return term.toUpperCase();
    } else if (term.startsWith('sk')) {
        // Skolem constant, ensure lowercase
        return term.toLowerCase();
    } else if (term.length === 1 && /^[a-z]/.test(term)) {
        // Single lowercase letter: Free variable (implicitly universal)
        return term.toUpperCase();
    } else if (/^[a-z]/.test(term)) {
        // Lowercase string (length > 1): Constant
        return term;
    } else {
        // Uppercase string or other: Constant
        // Example: Socrates -> socrates
        return term.toLowerCase();
    }
}

function predicateToProlog(node: ASTNode): string {
    if (node.type !== 'predicate') {
        throw createEngineError(`Expected predicate, got ${node.type} during translation`);
    }

    if (!node.args || node.args.length === 0) {
        return node.name!;
    }

    const args = node.args.map(termToProlog).join(', ');
    return `${node.name}(${args})`;
}

function termToProlog(node: ASTNode): string {
    switch (node.type) {
        case 'variable':
            // Explicit variable node: must be uppercase in Prolog
            // Even if the name doesn't follow strict conventions, if the parser
            // identified it as a variable, we treat it as such.
            return node.name!.toUpperCase();
        case 'constant':
             // Explicit constant node: must be lowercase in Prolog
            return node.name!.toLowerCase();
        case 'function':
            const args = node.args!.map(termToProlog).join(', ');
            return `${node.name!.toLowerCase()}(${args})`;
        default:
            throw createEngineError(`Cannot convert ${node.type} to Prolog term`);
    }
}

/**
 * Convert arbitrary FOL to meta-representation in Prolog
 * This allows representing complex formulas that don't fit Horn clause form.
 */
function astToMetaProlog(node: ASTNode): string | null {
    switch (node.type) {
        case 'predicate':
            return predicateToProlog(node);

        case 'and':
            return `(${astToMetaProlog(node.left!)}, ${astToMetaProlog(node.right!)})`;

        case 'or':
            return `(${astToMetaProlog(node.left!)}; ${astToMetaProlog(node.right!)})`;

        case 'not':
            return `\\+ ${astToMetaProlog(node.operand!)}`;

        case 'implies':
            // P -> Q is equivalent to ¬P ∨ Q, but in Prolog we can represent as rule-like
            return `(${astToMetaProlog(node.left!)} -> ${astToMetaProlog(node.right!)}; true)`;

        case 'equals':
            return `${astToMetaProlog(node.left!)} = ${astToMetaProlog(node.right!)}`;

        case 'variable':
            return node.name!.toUpperCase();

        case 'constant':
            return node.name!.toLowerCase();

        case 'forall':
            // Universal quantification - in Prolog, typically handled by variables being universal in rules
            return astToMetaProlog(node.body!);

        case 'exists':
            // Existential - Prolog handles this through unification
            return astToMetaProlog(node.body!);

        default:
            return null;
    }
}

/**
 * Convert a Prolog query result back to FOL format
 */
export function prologResultToFol(result: Record<string, string>): Record<string, string> {
    const folResult: Record<string, string> = {};

    for (const [key, value] of Object.entries(result)) {
        // Convert Prolog uppercase var back to lowercase
        folResult[key.toLowerCase()] = value.toLowerCase();
    }

    return folResult;
}

/**
 * Create a Prolog query from a FOL goal
 */
export function folGoalToProlog(goal: string): string {
    const ast = parse(goal);

    // Check for universal quantifiers which Prolog cannot directly prove via goal query
    if (containsUniversal(ast)) {
        throw createEngineError(
            'Universal quantification (all/forall) in goals is not supported by the Prolog engine. ' +
            'Try using the SAT engine or refutation (negating the goal and checking for contradiction).'
        );
    }

    if (ast.type === 'predicate') {
        return predicateToProlog(ast) + '.';
    }

    // For complex goals, use meta-representation
    const meta = astToMetaProlog(ast);
    return meta ? meta + '.' : '';
}

/**
 * Check if AST contains universal quantifiers
 */
function containsUniversal(node: ASTNode): boolean {
    if (node.type === 'forall') return true;

    if (node.left && containsUniversal(node.left)) return true;
    if (node.right && containsUniversal(node.right)) return true;
    if (node.operand && containsUniversal(node.operand)) return true;
    if (node.body && containsUniversal(node.body)) return true;

    // Note: forall inside existential is also problematic for Prolog goals
    // unless Skolemized, but Prolog goals generally don't support quantifiers well.

    return false;
}

/**
 * Build a complete Prolog program from premises
 */
export function buildPrologProgram(premises: string[]): string {
    const allClauses: string[] = [];

    for (const premise of premises) {
        const clauses = folToProlog(premise);
        allClauses.push(...clauses);
    }

    return allClauses.join('\n');
}

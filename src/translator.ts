/**
 * Translator: Prover9 FOL Syntax ↔ Prolog Syntax
 * 
 * Converts between Prover9-style formulas and Tau-Prolog compatible format.
 */

import { parse } from './parser.js';
import type { ASTNode } from './types/index.js';
import { isHornClause } from './astUtils.js';
import { createError, LogicException } from './types/errors.js';
import { clausify, clausesToProlog } from './clausifier.js';

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
    // 1. Try to use clausifier (handles Skolemization, NNF, etc.)
    const result = clausify(formula);
    if (result.success && result.clauses) {
        try {
            return clausesToProlog(result.clauses);
        } catch (e) {
            // Not Horn clauses.
            // Fallback to legacy translation for backward compatibility
            // (though it likely produces inert meta-terms)
        }
    }

    // 2. Fallback to direct AST translation
    const ast = parse(formula);
    return translateToProlog(ast);
}

/**
 * Translate AST to Prolog clauses (Legacy/Fallback)
 */
function translateToProlog(node: ASTNode): string[] {
    const clauses: string[] = [];

    // Handle universally quantified implications (rules)
    if (isHornClause(node)) {
        const clause = extractHornClause(node);
        if (clause) {
            clauses.push(clause);
            return clauses;
        }
    }

    // Handle simple predicates (facts)
    if (node.type === 'predicate') {
        clauses.push(predicateToProlog(node) + '.');
        return clauses;
    }

    // Handle existentially quantified formulas - Legacy behavior
    if (node.type === 'exists') {
        // Warning: This legacy path does NOT skolemize correctly for premises.
        // It relies on implicit Prolog variables which are universally quantified in facts.
        // Only reached if clausification fails.
        return translateToProlog(node.body!);
    }

    // Handle forall with non-implication body
    if (node.type === 'forall') {
        // Strip outer quantifiers and translate body
        return translateToProlog(node.body!);
    }

    // Handle conjunctions (multiple facts/rules)
    if (node.type === 'and') {
        clauses.push(...translateToProlog(node.left!));
        clauses.push(...translateToProlog(node.right!));
        return clauses;
    }

    // For other constructs, use meta-representation
    // This represents the formula as Prolog-evaluable logic
    const meta = astToMetaProlog(node);
    if (meta) {
        clauses.push(meta + '.');
    }

    return clauses;
}

/**
 * Extract Horn clause as Prolog rule
 */
function extractHornClause(node: ASTNode): string | null {
    // Collect quantified variables
    const quantifiedVars: string[] = [];
    let current = node;

    while (current.type === 'forall') {
        quantifiedVars.push(current.variable!);
        current = current.body!;
    }

    if (current.type !== 'implies') {
        return null;
    }

    const body = current.left!;
    const head = current.right!;

    // Convert head
    const headProlog = predicateToProlog(head);

    // Convert body
    const bodyProlog = conjunctionToProlog(body);

    return `${headProlog} :- ${bodyProlog}.`;
}

function predicateToProlog(node: ASTNode): string {
    if (node.type !== 'predicate') {
        throw new LogicException(createError('PARSE_ERROR', `Expected predicate, got ${node.type}`));
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
            // Prolog variables are uppercase
            return node.name!.toUpperCase();
        case 'constant':
            // Prolog constants are lowercase
            return node.name!.toLowerCase();
        case 'function':
            const args = node.args!.map(termToProlog).join(', ');
            return `${node.name!.toLowerCase()}(${args})`;
        default:
            throw new LogicException(createError('PARSE_ERROR', `Cannot convert ${node.type} to Prolog term`));
    }
}

function conjunctionToProlog(node: ASTNode): string {
    if (node.type === 'predicate') {
        return predicateToProlog(node);
    }

    if (node.type === 'and') {
        const left = conjunctionToProlog(node.left!);
        const right = conjunctionToProlog(node.right!);
        return `${left}, ${right}`;
    }

    throw new LogicException(createError('PARSE_ERROR', `Cannot convert ${node.type} to Prolog body`));
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
        throw new LogicException(createError(
            'ENGINE_ERROR',
            'Universal quantification (all/forall) in goals is not supported by the Prolog engine. ' +
            'Try using the SAT engine or refutation (negating the goal and checking for contradiction).'
        ));
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

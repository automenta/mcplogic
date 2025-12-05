/**
 * Translator: Prover9 FOL Syntax ↔ Prolog Syntax
 * 
 * Converts between Prover9-style formulas and Tau-Prolog compatible format.
 */

import { ASTNode, parse } from './parser.js';

/**
 * Convert a Prover9-style formula to Prolog
 * 
 * Prover9: all x (man(x) -> mortal(x))
 * Prolog:  mortal(X) :- man(X).
 * 
 * For complex formulas, we represent them as meta-predicates.
 */
export function folToProlog(formula: string): string[] {
    const ast = parse(formula);
    return translateToProlog(ast);
}

/**
 * Translate AST to Prolog clauses
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

    // Handle existentially quantified formulas
    if (node.type === 'exists') {
        // In Prolog, existential is implicit in queries
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
 * Check if the node represents a Horn clause (forall vars. (body -> head))
 */
function isHornClause(node: ASTNode): boolean {
    // Unwrap quantifiers
    let current = node;
    while (current.type === 'forall') {
        current = current.body!;
    }

    // Must be an implication
    if (current.type !== 'implies') {
        return false;
    }

    // Head must be a single predicate
    if (current.right!.type !== 'predicate') {
        return false;
    }

    // Body must be a conjunction of predicates or a single predicate
    return isConjunctionOfPredicates(current.left!);
}

function isConjunctionOfPredicates(node: ASTNode): boolean {
    if (node.type === 'predicate') return true;
    if (node.type === 'and') {
        return isConjunctionOfPredicates(node.left!) && isConjunctionOfPredicates(node.right!);
    }
    return false;
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
        throw new Error(`Expected predicate, got ${node.type}`);
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
            throw new Error(`Cannot convert ${node.type} to Prolog term`);
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

    throw new Error(`Cannot convert ${node.type} to Prolog body`);
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

    if (ast.type === 'predicate') {
        return predicateToProlog(ast) + '.';
    }

    // For complex goals, use meta-representation
    const meta = astToMetaProlog(ast);
    return meta ? meta + '.' : '';
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

/**
 * Abstract Syntax Tree (AST) Types for FOL Formulas
 */

export type ASTNodeType =
    | 'forall'
    | 'exists'
    | 'implies'
    | 'iff'
    | 'and'
    | 'or'
    | 'not'
    | 'equals'
    | 'predicate'
    | 'constant'
    | 'variable'
    | 'function';

export interface ASTNode {
    type: ASTNodeType;
    name?: string;           // For predicates, functions, variables, constants
    variable?: string;       // For quantifiers
    args?: ASTNode[];        // For predicates, functions
    left?: ASTNode;          // For binary operators
    right?: ASTNode;         // For binary operators
    operand?: ASTNode;       // For not
    body?: ASTNode;          // For quantifiers
}

/**
 * Model Evaluation Utilities
 *
 * Logic for evaluating AST formulas against a finite model.
 * Extracted from ModelFinder.
 */

import type { ASTNode, Model } from '../types/index.js';

/**
 * Check if all formulas are satisfied in the model
 */
export function checkAllFormulas(
    asts: ASTNode[],
    model: Model
): boolean {
    for (const ast of asts) {
        if (!evaluate(ast, model, new Map())) {
            return false;
        }
    }
    return true;
}

/**
 * Evaluate a formula in a model under an assignment
 */
export function evaluate(
    node: ASTNode,
    model: Model,
    assignment: Map<string, number>
): boolean {
    switch (node.type) {
        case 'predicate': {
            const args = (node.args || []).map(a => evaluateTerm(a, model, assignment));
            const key = args.join(',');
            const extension = model.predicates.get(node.name!);
            return extension?.has(key) ?? false;
        }

        case 'and':
            return evaluate(node.left!, model, assignment) &&
                evaluate(node.right!, model, assignment);

        case 'or':
            return evaluate(node.left!, model, assignment) ||
                evaluate(node.right!, model, assignment);

        case 'not':
            return !evaluate(node.operand!, model, assignment);

        case 'implies':
            return !evaluate(node.left!, model, assignment) ||
                evaluate(node.right!, model, assignment);

        case 'iff':
            return evaluate(node.left!, model, assignment) ===
                evaluate(node.right!, model, assignment);

        case 'forall':
            return model.domain.every(d => {
                const newAssign = new Map(assignment);
                newAssign.set(node.variable!, d);
                return evaluate(node.body!, model, newAssign);
            });

        case 'exists':
            return model.domain.some(d => {
                const newAssign = new Map(assignment);
                newAssign.set(node.variable!, d);
                return evaluate(node.body!, model, newAssign);
            });

        case 'equals': {
            const left = evaluateTerm(node.left!, model, assignment);
            const right = evaluateTerm(node.right!, model, assignment);
            return left === right;
        }

        default:
            return false;
    }
}

/**
 * Evaluate a term to a domain element
 */
export function evaluateTerm(
    node: ASTNode,
    model: Model,
    assignment: Map<string, number>
): number {
    switch (node.type) {
        case 'variable':
            // Check assignment first (bound variables)
            if (assignment.has(node.name!)) {
                return assignment.get(node.name!)!;
            }
            // Then check model constants (free variables treated as constants)
            if (model.constants.has(node.name!)) {
                return model.constants.get(node.name!)!;
            }
            return 0;
        case 'constant':
            return model.constants.get(node.name!) ?? 0;
        case 'function': {
            const args = (node.args || []).map(a => evaluateTerm(a, model, assignment));
            const table = model.functions.get(node.name!);
            return table?.get(args.join(',')) ?? 0;
        }
        default:
            return 0;
    }
}

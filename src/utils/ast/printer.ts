import type { ASTNode } from '../../types/index.js';
import { createGenericError } from '../../types/errors.js';

/**
 * Pretty-print an AST back to FOL string
 */
export function astToString(node: ASTNode): string {
    switch (node.type) {
        case 'forall':
            return `all ${node.variable} (${astToString(node.body!)})`;
        case 'exists':
            return `exists ${node.variable} (${astToString(node.body!)})`;
        case 'implies':
            return `(${astToString(node.left!)} -> ${astToString(node.right!)})`;
        case 'iff':
            return `(${astToString(node.left!)} <-> ${astToString(node.right!)})`;
        case 'and':
            return `(${astToString(node.left!)} & ${astToString(node.right!)})`;
        case 'or':
            return `(${astToString(node.left!)} | ${astToString(node.right!)})`;
        case 'not':
            return `-${astToString(node.operand!)}`;
        case 'equals':
            return `${astToString(node.left!)} = ${astToString(node.right!)}`;
        case 'predicate':
            if (!node.args || node.args.length === 0) {
                return node.name!;
            }
            return `${node.name}(${node.args.map(astToString).join(', ')})`;
        case 'function':
            return `${node.name}(${node.args!.map(astToString).join(', ')})`;
        case 'variable':
        case 'constant':
            return node.name!;
        default:
            throw createGenericError('PARSE_ERROR', `Unknown node type: ${(node as any).type}`);
    }
}

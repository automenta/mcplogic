import type { ASTNode } from '../types/index.js';

/**
 * Generic AST Visitor
 */
export function traverse(node: ASTNode, visitor: (node: ASTNode) => void): void {
    visitor(node);

    if (node.args) {
        for (const arg of node.args) {
            traverse(arg, visitor);
        }
    }
    if (node.left) traverse(node.left, visitor);
    if (node.right) traverse(node.right, visitor);
    if (node.operand) traverse(node.operand, visitor);
    if (node.body) traverse(node.body, visitor);
}

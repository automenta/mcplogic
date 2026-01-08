import { ASTNode } from '../../types/index.js';

/**
 * Convert an AST to Negation Normal Form (NNF).
 *
 * In NNF:
 * - Negations only appear on atoms (predicates)
 * - Only AND, OR, and quantifiers remain
 * - Implications and biconditionals are eliminated
 */
export function toNNF(node: ASTNode): ASTNode {
    switch (node.type) {
        case 'iff': {
            // A ↔ B → (A → B) ∧ (B → A)
            const left = node.left!;
            const right = node.right!;
            const impl1: ASTNode = { type: 'implies', left, right };
            const impl2: ASTNode = { type: 'implies', left: right, right: left };
            return toNNF({ type: 'and', left: impl1, right: impl2 });
        }

        case 'implies': {
            // A → B → ¬A ∨ B
            const left = node.left!;
            const right = node.right!;
            const negLeft: ASTNode = { type: 'not', operand: left };
            return toNNF({ type: 'or', left: negLeft, right });
        }

        case 'not': {
            const operand = node.operand!;
            return pushNegation(operand);
        }

        case 'and':
            return {
                type: 'and',
                left: toNNF(node.left!),
                right: toNNF(node.right!),
            };

        case 'or':
            return {
                type: 'or',
                left: toNNF(node.left!),
                right: toNNF(node.right!),
            };

        case 'forall':
            return {
                type: 'forall',
                variable: node.variable,
                body: toNNF(node.body!),
            };

        case 'exists':
            return {
                type: 'exists',
                variable: node.variable,
                body: toNNF(node.body!),
            };

        case 'predicate':
        case 'equals':
        case 'constant':
        case 'variable':
        case 'function':
            return node;

        default:
            return node;
    }
}

/**
 * Push a negation inward (De Morgan's laws, quantifier negation).
 */
function pushNegation(node: ASTNode): ASTNode {
    switch (node.type) {
        case 'not':
            // Double negation elimination: ¬¬A → A
            return toNNF(node.operand!);

        case 'and':
            // De Morgan: ¬(A ∧ B) → ¬A ∨ ¬B
            return toNNF({
                type: 'or',
                left: { type: 'not', operand: node.left! },
                right: { type: 'not', operand: node.right! },
            });

        case 'or':
            // De Morgan: ¬(A ∨ B) → ¬A ∧ ¬B
            return toNNF({
                type: 'and',
                left: { type: 'not', operand: node.left! },
                right: { type: 'not', operand: node.right! },
            });

        case 'implies':
            // ¬(A → B) → A ∧ ¬B
            return toNNF({
                type: 'and',
                left: node.left!,
                right: { type: 'not', operand: node.right! },
            });

        case 'iff':
            // ¬(A ↔ B) → (A ∧ ¬B) ∨ (¬A ∧ B)
            return toNNF({
                type: 'or',
                left: {
                    type: 'and',
                    left: node.left!,
                    right: { type: 'not', operand: node.right! },
                },
                right: {
                    type: 'and',
                    left: { type: 'not', operand: node.left! },
                    right: node.right!,
                },
            });

        case 'forall':
            // ¬∀x.P → ∃x.¬P
            return toNNF({
                type: 'exists',
                variable: node.variable,
                body: { type: 'not', operand: node.body! },
            });

        case 'exists':
            // ¬∃x.P → ∀x.¬P
            return toNNF({
                type: 'forall',
                variable: node.variable,
                body: { type: 'not', operand: node.body! },
            });

        case 'predicate':
        case 'equals':
            // Negation on atom - this is NNF
            return { type: 'not', operand: node };

        default:
            return { type: 'not', operand: node };
    }
}

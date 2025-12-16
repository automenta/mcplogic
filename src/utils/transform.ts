/**
 * FOL Transformations
 *
 * Standard transformations for First-Order Logic ASTs.
 */

import { ASTNode } from '../types/index.js';
import { SkolemEnv } from './clause.js';
import { astToString } from './ast.js';
import { createClausificationError, createTimeoutError } from '../types/errors.js';
import { ClausifyOptions } from '../types/clause.js';

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

/**
 * Standardize variables - give each quantified variable a unique name.
 */
export function standardizeVariables(node: ASTNode): ASTNode {
    let counter = 0;
    const renaming = new Map<string, string>();

    function standardize(n: ASTNode): ASTNode {
        switch (n.type) {
            case 'forall':
            case 'exists': {
                const oldVar = n.variable!;
                const newVar = `_v${counter++}`;
                renaming.set(oldVar, newVar);
                const newBody = standardize(n.body!);
                renaming.delete(oldVar);
                return {
                    type: n.type,
                    variable: newVar,
                    body: newBody,
                };
            }

            case 'variable': {
                const renamed = renaming.get(n.name!);
                return renamed ? { type: 'variable', name: renamed } : n;
            }

            case 'and':
            case 'or':
            case 'implies':
            case 'iff':
                return {
                    type: n.type,
                    left: standardize(n.left!),
                    right: standardize(n.right!),
                };

            case 'not':
                return {
                    type: 'not',
                    operand: standardize(n.operand!),
                };

            case 'equals':
                return {
                    type: 'equals',
                    left: standardize(n.left!),
                    right: standardize(n.right!),
                };

            case 'predicate':
                return {
                    type: 'predicate',
                    name: n.name,
                    args: n.args?.map(standardize),
                };

            case 'function':
                return {
                    type: 'function',
                    name: n.name,
                    args: n.args?.map(standardize),
                };

            default:
                return n;
        }
    }

    return standardize(node);
}

/**
 * Skolemize - replace existentially quantified variables with Skolem functions.
 *
 * ∃x.P(x) → P(sk0) (if no universal vars in scope)
 * ∀y.∃x.P(x,y) → ∀y.P(sk1(y), y) (Skolem function of universal vars)
 */
export function skolemize(node: ASTNode, env: SkolemEnv): ASTNode {
    switch (node.type) {
        case 'forall': {
            // Add variable to universal scope
            env.universalVars.push(node.variable!);
            const newBody = skolemize(node.body!, env);
            env.universalVars.pop();
            return {
                type: 'forall',
                variable: node.variable,
                body: newBody,
            };
        }

        case 'exists': {
            // Replace with Skolem term
            const skolemName = `sk${env.counter++}`;
            const skolemArgs = [...env.universalVars];
            env.skolemMap.set(node.variable!, { name: skolemName, args: skolemArgs });
            // Permanently record this Skolem function
            env.generatedSkolems.set(skolemName, skolemArgs.length);

            // Continue with body (variable will be replaced)
            const newBody = skolemize(node.body!, env);
            env.skolemMap.delete(node.variable!);

            // Remove the quantifier, return just the body
            return newBody;
        }

        case 'variable': {
            const skolem = env.skolemMap.get(node.name!);
            if (skolem) {
                if (skolem.args.length === 0) {
                    // Skolem constant
                    return { type: 'constant', name: skolem.name };
                } else {
                    // Skolem function
                    return {
                        type: 'function',
                        name: skolem.name,
                        args: skolem.args.map(v => ({ type: 'variable', name: v })),
                    };
                }
            }
            return node;
        }

        case 'and':
        case 'or':
            return {
                type: node.type,
                left: skolemize(node.left!, env),
                right: skolemize(node.right!, env),
            };

        case 'not':
            return {
                type: 'not',
                operand: skolemize(node.operand!, env),
            };

        case 'equals':
            return {
                type: 'equals',
                left: skolemize(node.left!, env),
                right: skolemize(node.right!, env),
            };

        case 'predicate':
            return {
                type: 'predicate',
                name: node.name,
                args: node.args?.map(a => skolemize(a, env)),
            };

        case 'function':
            return {
                type: 'function',
                name: node.name,
                args: node.args?.map(a => skolemize(a, env)),
            };

        default:
            return node;
    }
}

/**
 * Drop universal quantifiers (all remaining variables are implicitly universal).
 */
export function dropUniversals(node: ASTNode): ASTNode {
    switch (node.type) {
        case 'forall':
            return dropUniversals(node.body!);

        case 'and':
        case 'or':
            return {
                type: node.type,
                left: dropUniversals(node.left!),
                right: dropUniversals(node.right!),
            };

        case 'not':
            return {
                type: 'not',
                operand: dropUniversals(node.operand!),
            };

        default:
            return node;
    }
}

/**
 * Distribute OR over AND to achieve CNF.
 * (A ∨ (B ∧ C)) → (A ∨ B) ∧ (A ∨ C)
 */
export function distribute(
    node: ASTNode,
    options: Required<ClausifyOptions>,
    startTime: number
): ASTNode {
    // Check timeout
    if (Date.now() - startTime > options.timeout) {
        throw createTimeoutError(options.timeout, 'Clausification');
    }

    switch (node.type) {
        case 'and':
            return {
                type: 'and',
                left: distribute(node.left!, options, startTime),
                right: distribute(node.right!, options, startTime),
            };

        case 'or': {
            const left = distribute(node.left!, options, startTime);
            const right = distribute(node.right!, options, startTime);

            // If either side is a conjunction, distribute
            if (left.type === 'and') {
                // (A ∧ B) ∨ C → (A ∨ C) ∧ (B ∨ C)
                return distribute(
                    {
                        type: 'and',
                        left: { type: 'or', left: left.left!, right },
                        right: { type: 'or', left: left.right!, right },
                    },
                    options,
                    startTime
                );
            }

            if (right.type === 'and') {
                // A ∨ (B ∧ C) → (A ∨ B) ∧ (A ∨ C)
                return distribute(
                    {
                        type: 'and',
                        left: { type: 'or', left, right: right.left! },
                        right: { type: 'or', left, right: right.right! },
                    },
                    options,
                    startTime
                );
            }

            return { type: 'or', left, right };
        }

        default:
            return node;
    }
}

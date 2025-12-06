/**
 * Clausifier - CNF Transformation
 * 
 * Converts arbitrary First-Order Logic formulas to Conjunctive Normal Form (CNF).
 * Implements the standard clausification algorithm:
 * 1. Eliminate biconditionals (↔)
 * 2. Eliminate implications (→)
 * 3. Push negations inward (NNF)
 * 4. Standardize variables (unique names per quantifier)
 * 5. Skolemize (eliminate existential quantifiers)
 * 6. Drop universal quantifiers
 * 7. Distribute OR over AND (CNF)
 * 8. Extract clauses
 */

import { parse, astToString } from './parser.js';
import type { ASTNode } from './types/index.js';
import {
    Literal,
    Clause,
    ClausifyOptions,
    ClausifyResult,
    SkolemEnv,
    createSkolemEnv,
    isTautology,
    DIMACSResult,
    atomToKey,
} from './types/clause.js';
import { createError } from './types/errors.js';

/** Default clausification options */
const DEFAULT_OPTIONS: Required<ClausifyOptions> = {
    maxClauses: 10000,
    maxClauseSize: 50,
    timeout: 5000,
};

/**
 * Clausify a FOL formula string.
 * 
 * @param formula - The FOL formula to clausify
 * @param options - Clausification options
 * @returns ClausifyResult with clauses or error
 */
export function clausify(formula: string, options: ClausifyOptions = {}): ClausifyResult {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
        const ast = parse(formula);
        const originalSize = countNodes(ast);

        // Step 1-3: Convert to Negation Normal Form
        const nnf = toNNF(ast);

        // Step 4: Standardize variables
        const standardized = standardizeVariables(nnf);

        // Step 5: Skolemize
        const skolemEnv = createSkolemEnv();
        const skolemized = skolemize(standardized, skolemEnv);

        // Step 6: Drop universal quantifiers
        const quantifierFree = dropUniversals(skolemized);

        // Step 7-8: Convert to CNF and extract clauses
        const clauses = toCNF(quantifierFree, opts, startTime);

        // Filter tautologies
        const filteredClauses = clauses.filter(c => !isTautology(c));

        const timeMs = Date.now() - startTime;
        const maxClauseSize = filteredClauses.reduce(
            (max, c) => Math.max(max, c.literals.length),
            0
        );

        return {
            success: true,
            clauses: filteredClauses,
            skolemFunctions: new Map(skolemEnv.generatedSkolems),
            statistics: {
                originalSize,
                clauseCount: filteredClauses.length,
                maxClauseSize,
                timeMs,
            },
        };
    } catch (e) {
        const timeMs = Date.now() - startTime;
        const error = e instanceof Error ? e : new Error(String(e));

        return {
            success: false,
            error: createError('CLAUSIFICATION_ERROR', error.message),
            statistics: {
                originalSize: 0,
                clauseCount: 0,
                maxClauseSize: 0,
                timeMs,
            },
        };
    }
}

/**
 * Count AST nodes for statistics.
 */
function countNodes(node: ASTNode): number {
    let count = 1;
    if (node.left) count += countNodes(node.left);
    if (node.right) count += countNodes(node.right);
    if (node.operand) count += countNodes(node.operand);
    if (node.body) count += countNodes(node.body);
    if (node.args) {
        for (const arg of node.args) {
            count += countNodes(arg);
        }
    }
    return count;
}

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
 * Convert a quantifier-free NNF formula to CNF and extract clauses.
 */
export function toCNF(
    node: ASTNode,
    options: Required<ClausifyOptions>,
    startTime: number
): Clause[] {
    // First, distribute OR over AND to get CNF
    const cnfAst = distribute(node, options, startTime);

    // Extract clauses from the CNF AST
    return extractClauses(cnfAst);
}

/**
 * Distribute OR over AND to achieve CNF.
 * (A ∨ (B ∧ C)) → (A ∨ B) ∧ (A ∨ C)
 */
function distribute(
    node: ASTNode,
    options: Required<ClausifyOptions>,
    startTime: number
): ASTNode {
    // Check timeout
    if (Date.now() - startTime > options.timeout) {
        throw new Error('Clausification timeout');
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

/**
 * Extract clauses from a CNF AST.
 * The AST should be a conjunction of disjunctions of literals.
 */
function extractClauses(node: ASTNode): Clause[] {
    const clauses: Clause[] = [];

    function extractConjuncts(n: ASTNode): void {
        if (n.type === 'and') {
            extractConjuncts(n.left!);
            extractConjuncts(n.right!);
        } else {
            // This should be a disjunction (or single literal)
            const literals = extractDisjuncts(n);
            clauses.push({ literals });
        }
    }

    function extractDisjuncts(n: ASTNode): Literal[] {
        if (n.type === 'or') {
            return [...extractDisjuncts(n.left!), ...extractDisjuncts(n.right!)];
        } else {
            return [nodeToLiteral(n)];
        }
    }

    extractConjuncts(node);
    return clauses;
}

/**
 * Convert an AST node to a literal.
 */
function nodeToLiteral(node: ASTNode): Literal {
    if (node.type === 'not') {
        const inner = node.operand!;
        if (inner.type === 'predicate') {
            return {
                predicate: inner.name!,
                args: (inner.args || []).map(termToString),
                negated: true,
            };
        } else if (inner.type === 'equals') {
            // ¬(a = b) represented as special predicate
            return {
                predicate: '=',
                args: [termToString(inner.left!), termToString(inner.right!)],
                negated: true,
            };
        }
        throw new Error(`Cannot convert ${inner.type} to literal`);
    }

    if (node.type === 'predicate') {
        return {
            predicate: node.name!,
            args: (node.args || []).map(termToString),
            negated: false,
        };
    }

    if (node.type === 'equals') {
        return {
            predicate: '=',
            args: [termToString(node.left!), termToString(node.right!)],
            negated: false,
        };
    }

    throw new Error(`Cannot convert ${node.type} to literal`);
}

/**
 * Convert a term AST to a string representation.
 */
function termToString(node: ASTNode): string {
    switch (node.type) {
        case 'variable':
        case 'constant':
            return node.name!;
        case 'function':
            return `${node.name}(${(node.args || []).map(termToString).join(',')})`;
        default:
            return astToString(node);
    }
}

/**
 * Check if a formula is already in Horn clause form.
 * A Horn clause has at most one positive literal.
 */
export function isHornFormula(clauses: Clause[]): boolean {
    for (const clause of clauses) {
        const positiveCount = clause.literals.filter(l => !l.negated).length;
        if (positiveCount > 1) return false;
    }
    return true;
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
    const atom = lit.args.length > 0
        ? `${lit.predicate}(${lit.args.map(a => a.toUpperCase()).join(', ')})`
        : lit.predicate;

    if (useNegation && lit.negated) {
        return `\\+ ${atom}`;
    }
    return atom;
}

/**
 * Convert clauses to DIMACS CNF format.
 * 
 * DIMACS format is the standard input format for SAT solvers.
 * Each clause is a line of space-separated integers ending with 0.
 * Positive integers represent positive literals, negative represent negated.
 * 
 * @param clauses - Array of clauses in CNF
 * @returns DIMACSResult with DIMACS string and variable mapping
 */
export function clausesToDIMACS(clauses: Clause[]): DIMACSResult {
    const varMap = new Map<string, number>();
    let nextVar = 1;

    // First pass: assign unique positive integers to each atom
    for (const clause of clauses) {
        for (const lit of clause.literals) {
            const key = atomToKey(lit);
            if (!varMap.has(key)) {
                varMap.set(key, nextVar++);
            }
        }
    }

    // Second pass: build DIMACS clauses
    const clauseLines: string[] = [];
    for (const clause of clauses) {
        const literals: number[] = [];
        for (const lit of clause.literals) {
            const key = atomToKey(lit);
            const varNum = varMap.get(key)!;
            literals.push(lit.negated ? -varNum : varNum);
        }
        clauseLines.push(literals.join(' ') + ' 0');
    }

    // Build DIMACS output
    const header = `p cnf ${varMap.size} ${clauses.length}`;
    const dimacs = [header, ...clauseLines].join('\n');

    return {
        dimacs,
        varMap,
        stats: {
            variables: varMap.size,
            clauses: clauses.length,
        },
    };
}

/**
 * Model Finder - Finite model enumeration
 * 
 * Equivalent to Mace4 - finds finite models or counterexamples.
 */

import { parse } from './parser.js';
import { Model, ModelResult, LogicException } from './types/index.js';
import type { ASTNode } from './types/index.js';
import { extractSignature } from './astUtils.js';

export type { Model, ModelResult };

/**
 * Model Finder for finite domains
 */
export class ModelFinder {
    private timeout: number;
    private maxDomainSize: number;

    constructor(timeout: number = 5000, maxDomainSize: number = 10) {
        this.timeout = timeout;
        this.maxDomainSize = maxDomainSize;
    }

    /**
     * Find a model satisfying the premises
     */
    async findModel(
        premises: string[],
        domainSize?: number
    ): Promise<ModelResult> {
        const startTime = Date.now();
        const startSize = domainSize || 2;
        const endSize = domainSize || this.maxDomainSize;

        try {
            // Parse all premises
            const asts = premises.map(p => parse(p));

            // Extract signature (predicates, constants)
            const baseSignature = extractSignature(asts);

            // Adapt signature for ModelFinder: functions are treated as predicates with arity + 1
            const signature = {
                predicates: new Map(baseSignature.predicates),
                constants: baseSignature.constants,
                variables: baseSignature.variables
            };

            for (const [name, arity] of baseSignature.functions) {
                signature.predicates.set(name, arity + 1);
            }

            // Try increasing domain sizes
            for (let size = startSize; size <= endSize; size++) {
                if (Date.now() - startTime > this.timeout) {
                    return { success: false, result: 'timeout' };
                }

                const model = this.tryDomainSize(asts, signature, size);
                if (model) {
                    return {
                        success: true,
                        result: 'model_found',
                        model,
                        interpretation: this.formatModel(model)
                    };
                }
            }

            return { success: false, result: 'no_model' };
        } catch (e) {
            // Unwrap LogicException for clean error messages
            const message = e instanceof LogicException ? e.error.message : (e instanceof Error ? e.message : String(e));
            return {
                success: false,
                result: 'error',
                error: message
            };
        }
    }

    /**
     * Find a counterexample (model where premises true but conclusion false)
     */
    async findCounterexample(
        premises: string[],
        conclusion: string,
        domainSize?: number
    ): Promise<ModelResult> {
        // A counterexample is a model of premises ∧ ¬conclusion
        const negatedConclusion = `-(${conclusion.replace(/\.$/, '')})`;

        const result = await this.findModel(
            [...premises, negatedConclusion],
            domainSize
        );

        if (result.success) {
            result.interpretation = `Counterexample found: The premises are satisfied but the conclusion '${conclusion}' is FALSE in this model.`;
        }

        return result;
    }

    /**
     * Try to find a model of given domain size
     */
    private tryDomainSize(
        asts: ASTNode[],
        signature: {
            predicates: Map<string, number>;
            constants: Set<string>;
            variables: Set<string>;
        },
        size: number
    ): Model | null {
        const domain = Array.from({ length: size }, (_, i) => i);

        // Assign constants to domain elements
        const constantAssignments = this.enumerateConstantAssignments(
            Array.from(signature.constants),
            domain
        );

        for (const constants of constantAssignments) {
            // Enumerate predicate interpretations
            const predicateInterpretations = this.enumeratePredicateInterpretations(
                signature.predicates,
                domain
            );

            for (const predicates of predicateInterpretations) {
                const model: Model = {
                    domainSize: size,
                    domain,
                    predicates,
                    constants,
                    interpretation: ''
                };

                if (this.checkAllFormulas(asts, model)) {
                    model.interpretation = this.formatModel(model);
                    return model;
                }
            }
        }

        return null;
    }

    /**
     * Enumerate all possible constant assignments
     */
    private *enumerateConstantAssignments(
        constants: string[],
        domain: number[]
    ): Generator<Map<string, number>> {
        if (constants.length === 0) {
            yield new Map();
            return;
        }

        const [first, ...rest] = constants;
        for (const value of domain) {
            for (const restAssignment of this.enumerateConstantAssignments(rest, domain)) {
                const assignment = new Map(restAssignment);
                assignment.set(first, value);
                yield assignment;
            }
        }
    }

    /**
     * Enumerate all possible predicate interpretations
     */
    private *enumeratePredicateInterpretations(
        predicates: Map<string, number>,
        domain: number[]
    ): Generator<Map<string, Set<string>>> {
        const predList = Array.from(predicates.entries());
        yield* this.enumeratePredicateHelper(predList, domain, new Map());
    }

    private *enumeratePredicateHelper(
        predicates: Array<[string, number]>,
        domain: number[],
        current: Map<string, Set<string>>
    ): Generator<Map<string, Set<string>>> {
        if (predicates.length === 0) {
            yield new Map(current);
            return;
        }

        const [[name, arity], ...rest] = predicates;
        const tuples = this.allTuples(domain, arity);
        const subsets = this.allSubsets(tuples);

        for (const subset of subsets) {
            const next = new Map(current);
            next.set(name, new Set(subset.map(t => t.join(','))));
            yield* this.enumeratePredicateHelper(rest, domain, next);
        }
    }

    /**
     * Generate all n-tuples from domain
     */
    private allTuples(domain: number[], n: number): number[][] {
        if (n === 0) return [[]];
        const result: number[][] = [];
        const smaller = this.allTuples(domain, n - 1);
        for (const tuple of smaller) {
            for (const elem of domain) {
                result.push([...tuple, elem]);
            }
        }
        return result;
    }

    /**
     * Generate all subsets of a set
     */
    private *allSubsets<T>(set: T[]): Generator<T[]> {
        const n = set.length;
        const total = 1 << n;
        for (let mask = 0; mask < total; mask++) {
            const subset: T[] = [];
            for (let i = 0; i < n; i++) {
                if (mask & (1 << i)) {
                    subset.push(set[i]);
                }
            }
            yield subset;
        }
    }

    /**
     * Check if all formulas are satisfied in the model
     */
    private checkAllFormulas(
        asts: ASTNode[],
        model: Model
    ): boolean {
        for (const ast of asts) {
            if (!this.evaluate(ast, model, new Map())) {
                return false;
            }
        }
        return true;
    }

    /**
     * Evaluate a formula in a model under an assignment
     */
    private evaluate(
        node: ASTNode,
        model: Model,
        assignment: Map<string, number>
    ): boolean {
        switch (node.type) {
            case 'predicate': {
                const args = (node.args || []).map(a => this.evaluateTerm(a, model, assignment));
                const key = args.join(',');
                const extension = model.predicates.get(node.name!);
                return extension?.has(key) ?? false;
            }

            case 'and':
                return this.evaluate(node.left!, model, assignment) &&
                    this.evaluate(node.right!, model, assignment);

            case 'or':
                return this.evaluate(node.left!, model, assignment) ||
                    this.evaluate(node.right!, model, assignment);

            case 'not':
                return !this.evaluate(node.operand!, model, assignment);

            case 'implies':
                return !this.evaluate(node.left!, model, assignment) ||
                    this.evaluate(node.right!, model, assignment);

            case 'iff':
                return this.evaluate(node.left!, model, assignment) ===
                    this.evaluate(node.right!, model, assignment);

            case 'forall':
                return model.domain.every(d => {
                    const newAssign = new Map(assignment);
                    newAssign.set(node.variable!, d);
                    return this.evaluate(node.body!, model, newAssign);
                });

            case 'exists':
                return model.domain.some(d => {
                    const newAssign = new Map(assignment);
                    newAssign.set(node.variable!, d);
                    return this.evaluate(node.body!, model, newAssign);
                });

            case 'equals': {
                const left = this.evaluateTerm(node.left!, model, assignment);
                const right = this.evaluateTerm(node.right!, model, assignment);
                return left === right;
            }

            default:
                return false;
        }
    }

    /**
     * Evaluate a term to a domain element
     */
    private evaluateTerm(
        node: ASTNode,
        model: Model,
        assignment: Map<string, number>
    ): number {
        switch (node.type) {
            case 'variable':
                return assignment.get(node.name!) ?? 0;
            case 'constant':
                return model.constants.get(node.name!) ?? 0;
            case 'function':
                // For now, treat functions as returning 0
                // A full implementation would need function interpretations
                return 0;
            default:
                return 0;
        }
    }

    /**
     * Format model as human-readable string
     */
    private formatModel(model: Model): string {
        const lines: string[] = [];
        lines.push(`Domain size: ${model.domainSize}`);
        lines.push(`Domain: {${model.domain.join(', ')}}`);

        if (model.constants.size > 0) {
            lines.push('Constants:');
            for (const [name, value] of model.constants) {
                lines.push(`  ${name} = ${value}`);
            }
        }

        lines.push('Predicates:');
        for (const [name, extension] of model.predicates) {
            const tuples = Array.from(extension).map(s => `(${s})`).join(', ');
            lines.push(`  ${name}: {${tuples}}`);
        }

        return lines.join('\n');
    }
}

/**
 * Create a model finder instance
 */
export function createModelFinder(timeout?: number, maxDomainSize?: number): ModelFinder {
    return new ModelFinder(timeout, maxDomainSize);
}

/**
 * Model Finder - Finite model enumeration
 * 
 * Equivalent to Mace4 - finds finite models or counterexamples.
 */

import { parse } from './parser.js';
import { Model, ModelResult } from './types/index.js';
import type { ASTNode } from './types/index.js';
import { extractSignature } from './utils/ast.js';
import { createGenericError } from './types/errors.js';
import { allTuples, allSubsets, enumerateConstantAssignments } from './utils/combinatorics.js';
import { checkAllFormulas } from './utils/evaluation.js';

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
            const error = e instanceof Error ? e : createGenericError('ENGINE_ERROR', String(e));
            return {
                success: false,
                result: 'error',
                error: error.message
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
        const constantAssignments = enumerateConstantAssignments(
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

                if (checkAllFormulas(asts, model)) {
                    model.interpretation = this.formatModel(model);
                    return model;
                }
            }
        }

        return null;
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
        const tuples = allTuples(domain, arity);
        const subsets = allSubsets(tuples);

        for (const subset of subsets) {
            const next = new Map(current);
            next.set(name, new Set(subset.map(t => t.join(','))));
            yield* this.enumeratePredicateHelper(rest, domain, next);
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

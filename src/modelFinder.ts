/**
 * Model Finder - Finite model enumeration
 * 
 * Equivalent to Mace4 - finds finite models or counterexamples.
 */

import { parse } from './parser.js';
import { Model, ModelResult } from './types/index.js';
import type { ASTNode } from './types/index.js';
import { extractSignature, getUsedPredicates } from './utils/ast.js';
import { createGenericError } from './types/errors.js';
import { allTuples, allSubsets, enumerateConstantAssignments } from './utils/combinatorics.js';
import { checkAllFormulas } from './utils/evaluation.js';

export type { Model, ModelResult };

/**
 * Options for model finding
 */
export interface ModelOptions {
    maxDomainSize?: number;
}

/**
 * Model Finder for finite domains
 */
export class ModelFinder {
    private timeout: number;
    private maxDomainSize: number;
    private startTime: number = 0;

    constructor(timeout: number = 5000, maxDomainSize: number = 10) {
        this.timeout = timeout;
        this.maxDomainSize = maxDomainSize;
    }

    /**
     * Find a model satisfying the premises
     */
    async findModel(
        premises: string[],
        domainSize?: number,
        options?: ModelOptions
    ): Promise<ModelResult> {
        this.startTime = Date.now();
        const startSize = domainSize || 2;
        // Use override option or default
        const endSize = domainSize || options?.maxDomainSize || this.maxDomainSize;

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

            // Analyze dependencies for pruning
            const premiseDependencies = asts.map(ast => ({
                ast,
                dependencies: getUsedPredicates(ast)
            }));

            // Try increasing domain sizes
            for (let size = startSize; size <= endSize; size++) {
                if (Date.now() - this.startTime > this.timeout) {
                    return { success: false, result: 'timeout' };
                }

                const model = this.tryDomainSize(premiseDependencies, signature, size);
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
        domainSize?: number,
        options?: ModelOptions
    ): Promise<ModelResult> {
        // A counterexample is a model of premises ∧ ¬conclusion
        const negatedConclusion = `-(${conclusion.replace(/\.$/, '')})`;

        const result = await this.findModel(
            [...premises, negatedConclusion],
            domainSize,
            options
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
        premises: { ast: ASTNode; dependencies: Set<string> }[],
        signature: {
            predicates: Map<string, number>;
            constants: Set<string>;
            variables: Set<string>;
        },
        size: number
    ): Model | null {
        const domain = Array.from({ length: size }, (_, i) => i);

        // Assign constants to domain elements
        // Uses Symmetry Breaking (Least Number Heuristic) via enumerateConstantAssignments
        const constantAssignments = enumerateConstantAssignments(
            Array.from(signature.constants),
            domain
        );

        const predicateList = Array.from(signature.predicates.entries());

        for (const constants of constantAssignments) {
            // Check timeout check inside loops
            if (Date.now() - this.startTime > this.timeout) return null;

            // Check premises that don't depend on any predicates (only constants/equality)
            const constantOnlyPremises = premises.filter(p => p.dependencies.size === 0);
            const constantModel: Model = { domainSize: size, domain, predicates: new Map(), constants, interpretation: '' };

            if (!checkAllFormulas(constantOnlyPremises.map(p => p.ast), constantModel)) {
                continue; // Prune early
            }

            // Backtracking search for predicates
            const model = this.findPredicatesRecursive(
                domain,
                constants,
                predicateList,
                new Map(),
                premises
            );

            if (model) {
                model.interpretation = this.formatModel(model);
                return model;
            }
        }

        return null;
    }

    /**
     * Recursive backtracking search for predicate assignments
     */
    private findPredicatesRecursive(
        domain: number[],
        constants: Map<string, number>,
        remainingPredicates: [string, number][],
        currentPredicates: Map<string, Set<string>>,
        premises: { ast: ASTNode; dependencies: Set<string> }[]
    ): Model | null {
        // Check timeout
        if (Date.now() - this.startTime > this.timeout) return null;

        // Base case: all predicates assigned
        if (remainingPredicates.length === 0) {
            const model: Model = {
                domainSize: domain.length,
                domain,
                predicates: currentPredicates,
                constants,
                interpretation: ''
            };
            // Final check of all premises (redundant if pruning is perfect, but safe)
            if (checkAllFormulas(premises.map(p => p.ast), model)) {
                return model;
            }
            return null;
        }

        const [name, arity] = remainingPredicates[0];
        const rest = remainingPredicates.slice(1);

        // Identify premises we can check now (dependencies are subset of assigned + {name})
        const assignedNames = new Set(currentPredicates.keys());
        assignedNames.add(name);

        const checkablePremises = premises.filter(p => {
             // Check if all dependencies are in assignedNames
             for (const dep of p.dependencies) {
                 if (!assignedNames.has(dep)) return false;
             }
             return true;
        });

        // Generate all extensions for current predicate
        const tuples = allTuples(domain, arity);
        const subsets = allSubsets(tuples);

        for (const subset of subsets) {
            const nextPredicates = new Map(currentPredicates);
            nextPredicates.set(name, new Set(subset.map(t => t.join(','))));

            // PRUNING: Check satisfaction of premises that are fully assigned
            const partialModel: Model = {
                domainSize: domain.length,
                domain,
                predicates: nextPredicates,
                constants,
                interpretation: ''
            };

            if (checkAllFormulas(checkablePremises.map(p => p.ast), partialModel)) {
                const result = this.findPredicatesRecursive(
                    domain,
                    constants,
                    rest,
                    nextPredicates,
                    premises
                );
                if (result) return result;
            }
        }

        return null;
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

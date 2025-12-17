/**
 * Model Finder - Finite model enumeration
 * 
 * Equivalent to Mace4 - finds finite models or counterexamples.
 */

import { parse } from './parser.js';
import { Model, ModelResult, ModelOptions, DEFAULTS } from './types/index.js';
import type { ASTNode } from './types/index.js';
import { extractSignature, astToString, getFreeVariables } from './utils/ast.js';
import { createGenericError } from './types/errors.js';
import { checkAllFormulas } from './utils/evaluation.js';
import { symmetricMappings, allMappings, allFunctionTables, allTuples } from './utils/enumerate.js';
import { SATEngine } from './engines/sat.js';
import { groundFormula } from './utils/grounding.js';
import { clausify } from './clausifier.js';
import type { Literal } from './types/index.js';
import { areIsomorphic } from './utils/isomorphism.js';

export type { Model, ModelResult };

/**
 * Model Finder for finite domains
 */
export class ModelFinder {
    private timeout: number;
    private maxDomainSize: number;
    private satEngine = new SATEngine();

    constructor(timeout: number = 5000, maxDomainSize: number = 10) {
        this.timeout = timeout;
        this.maxDomainSize = maxDomainSize;
    }

    /**
     * Find a model satisfying the premises
     */
    async findModel(
        premises: string[],
        options?: ModelOptions
    ): Promise<ModelResult> {
        const opts = { ...DEFAULTS, ...options };
        const startTime = Date.now();
        const startSize = 1;
        const endSize = opts.maxDomainSize ?? this.maxDomainSize;

        try {
            // Parse all premises
            const asts = premises.map(p => parse(p));

            // Extract signature (predicates, constants, functions)
            const signature = extractSignature(asts);

            // Treat free variables as constants (Skolemization for model finding)
            // This allows users to write P(x) and find a model where P holds for some element named x
            // without explicit quantification, following Mace4 convention.
            const freeVars = new Set<string>();
            for (const ast of asts) {
                const free = getFreeVariables(ast);
                for (const v of free) {
                    freeVars.add(v);
                }
            }

            for (const v of freeVars) {
                signature.constants.add(v);
                signature.variables.delete(v);
            }

            // Try increasing domain sizes
            for (let size = startSize; size <= endSize; size++) {
                if (Date.now() - startTime > (opts.maxSeconds ?? 30) * 1000) {
                    return { success: false, result: 'timeout' };
                }

                const shouldUseSAT = opts.useSAT === true || (opts.useSAT === 'auto' && size > opts.satThreshold!);
                const count = opts.count ?? 1;
                const foundModels: Model[] = [];

                if (shouldUseSAT) {
                    const models = await this.findModelsSAT(premises, size, opts);
                    foundModels.push(...models);
                } else {
                    // Backtracking search
                    const models = this.findModelsBacktracking(asts, signature, size, opts, count);
                    foundModels.push(...models);
                }

                if (foundModels.length > 0) {
                    // Filter isomorphic models if we found multiple across sizes (though we currently restart per size)
                    // Note: findModelsBacktracking already handles isomorphism within a size if count > 1

                    return {
                        success: true,
                        result: 'model_found',
                        model: foundModels[0], // Primary model for backward compatibility
                        models: foundModels,
                        interpretation: this.formatModel(foundModels[0])
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
     * Find models using SAT solver
     */
    private async findModelsSAT(
        premises: string[],
        size: number,
        opts: ModelOptions
    ): Promise<Model[]> {
        // 1. Ground all premises
        const grounded = premises.map(p => {
            const ast = parse(p);
            return `(${astToString(groundFormula(ast, { domainSize: size }))})`;
        }).join(' & ');

        // 2. Clausify
        const result = clausify(grounded);
        if (!result.success || !result.clauses) return [];

        const clauses = [...result.clauses];
        const models: Model[] = [];
        const count = opts.count ?? 1;

        // 3. Loop: Solve, Record, Block
        while (models.length < count) {
            const satResult = await this.satEngine.checkSat(clauses);
            if (!satResult.sat) break;

            const model = this.decodeSATModel(satResult.model!, size);
            models.push(model);

            // Add blocking clause (negation of current model)
            const literals: Literal[] = [];
            for (const [key, val] of satResult.model!) {
                literals.push({
                    predicate: key,
                    args: [],
                    negated: val // If val=true, NOT key. If val=false, key.
                });
            }
            clauses.push({ literals });
        }

        return models;
    }

    /**
     * Decode SAT model into Model structure
     */
    private decodeSATModel(satModel: Map<string, boolean>, size: number): Model {
        const predicates = new Map<string, Set<string>>();

        for (const [varName, val] of satModel) {
            if (!val) continue;
            const m = varName.match(/^(\w+)(?:\(([^)]*)\))?$/);
            if (m) {
                const [, pred, argsStr] = m;
                // Constants like '0', '1' are also returned as true vars in some cases if they are propositions,
                // but usually predicates look like p(0,1).
                // We should be careful about internal vars generated by clausifier if any.
                if (pred.startsWith('$')) continue; // Skip internal vars

                if (!predicates.has(pred)) predicates.set(pred, new Set());
                predicates.get(pred)!.add(argsStr || '');
            }
        }

        return {
            domainSize: size,
            domain: Array.from({ length: size }, (_, i) => i),
            predicates,
            constants: new Map(), // Constants are folded into predicates or grounding
            functions: new Map(), // Functions are flattened to predicates
            interpretation: ''
        };
    }

    /**
     * Find a counterexample (model where premises true but conclusion false)
     */
    async findCounterexample(
        premises: string[],
        conclusion: string,
        options?: ModelOptions
    ): Promise<ModelResult> {
        // A counterexample is a model of premises ∧ ¬conclusion
        const negatedConclusion = `-(${conclusion.replace(/\.$/, '')})`;

        const result = await this.findModel(
            [...premises, negatedConclusion],
            options
        );

        if (result.success) {
            result.interpretation = `Counterexample found: The premises are satisfied but the conclusion '${conclusion}' is FALSE in this model.`;
        }

        return result;
    }

    /**
     * Try to find models of given domain size using backtracking
     */
    private findModelsBacktracking(
        asts: ASTNode[],
        signature: {
            predicates: Map<string, number>;
            functions: Map<string, number>;
            constants: Set<string>;
            variables: Set<string>;
        },
        size: number,
        options: ModelOptions,
        count: number
    ): Model[] {
        const domain = Array.from({ length: size }, (_, i) => i);
        const useSymmetry = options.enableSymmetry !== false; // Default to true if not specified
        const foundModels: Model[] = [];

        // Assign constants to domain elements
        const constantAssignments = this.enumerateConstants(
            Array.from(signature.constants),
            domain,
            useSymmetry
        );

        for (const constants of constantAssignments) {
            // Enumerate function interpretations
            const functionInterpretations = this.enumerateFunctions(
                signature.functions,
                domain
            );

            for (const functions of functionInterpretations) {
                // Enumerate predicate interpretations
                const predicateInterpretations = this.enumeratePredicates(
                    signature.predicates,
                    domain
                );

                for (const predicates of predicateInterpretations) {
                    const model: Model = {
                        domainSize: size,
                        domain,
                        predicates,
                        constants,
                        functions,
                        interpretation: ''
                    };

                    if (checkAllFormulas(asts, model)) {
                        // Check isomorphism against already found models
                        let isIso = false;
                        for (const existing of foundModels) {
                            if (areIsomorphic(model, existing)) {
                                isIso = true;
                                break;
                            }
                        }

                        if (!isIso) {
                            model.interpretation = this.formatModel(model);
                            foundModels.push(model);
                            if (foundModels.length >= count) {
                                return foundModels;
                            }
                        }
                    }
                }
            }
        }

        return foundModels;
    }

    /**
     * Enumerate all possible constant assignments
     */
    private *enumerateConstants(
        constants: string[],
        domain: number[],
        useSymmetry: boolean
    ): Generator<Map<string, number>> {
        if (useSymmetry) {
            yield* symmetricMappings(constants, domain.length);
        } else {
            yield* allMappings(constants, domain);
        }
    }

    /**
     * Enumerate all possible predicate interpretations
     */
    private *enumeratePredicates(
        predicates: Map<string, number>,
        domain: number[]
    ): Generator<Map<string, Set<string>>> {
        const predList = Array.from(predicates.entries());
        yield* this.enumPredsHelper(predList, domain, new Map());
    }

    private *enumPredsHelper(
        preds: [string, number][],
        domain: number[],
        current: Map<string, Set<string>>
    ): Generator<Map<string, Set<string>>> {
        if (preds.length === 0) { yield new Map(current); return; }
        const [[name, arity], ...rest] = preds;
        const tuples = [...allTuples(domain, arity)];
        const numSubsets = 1 << tuples.length;

        for (let mask = 0; mask < numSubsets; mask++) {
            const ext = new Set<string>();
            for (let i = 0; i < tuples.length; i++) {
                if (mask & (1 << i)) ext.add(tuples[i].join(','));
            }
            current.set(name, ext);
            yield* this.enumPredsHelper(rest, domain, current);
        }
    }

    /**
     * Enumerate all possible function interpretations
     */
    private *enumerateFunctions(
        functions: Map<string, number>,
        domain: number[]
    ): Generator<Map<string, Map<string, number>>> {
        const funcList = Array.from(functions.entries());
        yield* this.enumFuncsHelper(funcList, domain, new Map());
    }

    private *enumFuncsHelper(
        funcs: [string, number][],
        domain: number[],
        current: Map<string, Map<string, number>>
    ): Generator<Map<string, Map<string, number>>> {
        if (funcs.length === 0) { yield new Map(current); return; }
        const [[name, arity], ...rest] = funcs;
        for (const table of allFunctionTables(arity, domain)) {
            current.set(name, table);
            yield* this.enumFuncsHelper(rest, domain, current);
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

        if (model.functions.size > 0) {
            lines.push('Functions:');
            for (const [name, table] of model.functions) {
                const entries = Array.from(table.entries())
                    .map(([args, val]) => `(${args})->${val}`)
                    .join(', ');
                lines.push(`  ${name}: {${entries}}`);
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

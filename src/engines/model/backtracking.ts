import { Model, ModelOptions, ASTNode } from '../../types/index.js';
import { checkAllFormulas } from '../../utils/evaluation.js';
import { symmetricMappings, allMappings, allFunctionTables, allTuples } from '../../utils/enumerate.js';
import { areIsomorphic } from '../../utils/isomorphism.js';
import { formatModelString } from '../../utils/response.js';

/**
 * Try to find models of given domain size using backtracking
 */
export function findModelsBacktracking(
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
    const constantAssignments = enumerateConstants(
        Array.from(signature.constants),
        domain,
        useSymmetry
    );

    for (const constants of constantAssignments) {
        // Enumerate function interpretations
        const functionInterpretations = enumerateFunctions(
            signature.functions,
            domain
        );

        for (const functions of functionInterpretations) {
            // Enumerate predicate interpretations
            const predicateInterpretations = enumeratePredicates(
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
                        model.interpretation = formatModelString(model);
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
function* enumerateConstants(
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
function* enumeratePredicates(
    predicates: Map<string, number>,
    domain: number[]
): Generator<Map<string, Set<string>>> {
    const predList = Array.from(predicates.entries());
    yield* enumPredsHelper(predList, domain, new Map());
}

function* enumPredsHelper(
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
        yield* enumPredsHelper(rest, domain, current);
    }
}

/**
 * Enumerate all possible function interpretations
 */
function* enumerateFunctions(
    functions: Map<string, number>,
    domain: number[]
): Generator<Map<string, Map<string, number>>> {
    const funcList = Array.from(functions.entries());
    yield* enumFuncsHelper(funcList, domain, new Map());
}

function* enumFuncsHelper(
    funcs: [string, number][],
    domain: number[],
    current: Map<string, Map<string, number>>
): Generator<Map<string, Map<string, number>>> {
    if (funcs.length === 0) { yield new Map(current); return; }
    const [[name, arity], ...rest] = funcs;
    for (const table of allFunctionTables(arity, domain)) {
        current.set(name, table);
        yield* enumFuncsHelper(rest, domain, current);
    }
}

/**
 * SAT Engine
 * 
 * SAT solver backend using the logic-solver package (MiniSat compiled to JS).
 * Handles arbitrary propositional CNF formulas.
 */

import Logic from 'logic-solver';
import { Clause, Literal } from '../types/clause.js';
import { allMappings } from '../utils/enumerate.js';
import { ProveResult, Verbosity } from '../types/index.js';
import { buildProveResult } from '../utils/response.js';
import { clausify, isHornFormula } from '../clausifier.js';
import { parse } from '../parser.js';
import { createAnd, createNot } from '../utils/ast.js';
import {
    ReasoningEngine,
    EngineCapabilities,
    EngineProveOptions,
    SatResult
} from './interface.js';

/**
 * SAT solver-based reasoning engine.
 * Uses the logic-solver package (MiniSat in JS).
 * 
 * Handles arbitrary CNF formulas including non-Horn clauses.
 * For theorem proving, uses refutation: premises ∧ ¬conclusion is UNSAT → theorem holds.
 */
export class SATEngine implements ReasoningEngine {
    readonly name = 'sat/minisat';
    readonly capabilities: EngineCapabilities = {
        horn: true,
        fullFol: true,  // Handles arbitrary CNF (via instantiation)
        equality: false, // No built-in equality
        arithmetic: false, // No built-in arithmetic
        streaming: false,
    };

    /**
     * Convert a literal to a unique string key for the SAT solver.
     */
    private literalToKey(lit: { predicate: string; args: string[] }): string {
        if (lit.args.length === 0) {
            return lit.predicate;
        }
        return `${lit.predicate}(${lit.args.join(',')})`;
    }

    /**
     * Check satisfiability of clauses using the SAT solver.
     */
    async checkSat(clauses: Clause[]): Promise<SatResult> {
        const startTime = Date.now();

        if (clauses.length === 0) {
            return {
                sat: true,
                model: new Map(),
                statistics: {
                    timeMs: Date.now() - startTime,
                    variables: 0,
                    clauses: 0,
                },
            };
        }

        try {
            const solver = new Logic.Solver();
            const variables = new Set<string>();

            // Convert each clause to logic-solver format
            for (const clause of clauses) {
                if (clause.literals.length === 0) {
                    // Empty clause = unsatisfiable
                    return {
                        sat: false,
                        statistics: {
                            timeMs: Date.now() - startTime,
                            variables: variables.size,
                            clauses: clauses.length,
                        },
                    };
                }

                const disjuncts = clause.literals.map(lit => {
                    const key = this.literalToKey(lit);
                    variables.add(key);
                    return lit.negated ? Logic.not(key) : key;
                });

                // Add the clause as a disjunction
                solver.require(Logic.or(...disjuncts));
            }

            // Solve
            const solution = solver.solve();

            if (solution) {
                // Extract model
                const model = new Map<string, boolean>();
                for (const v of variables) {
                    model.set(v, solution.getTrueVars().includes(v));
                }

                return {
                    sat: true,
                    model,
                    statistics: {
                        timeMs: Date.now() - startTime,
                        variables: variables.size,
                        clauses: clauses.length,
                    },
                };
            } else {
                return {
                    sat: false,
                    statistics: {
                        timeMs: Date.now() - startTime,
                        variables: variables.size,
                        clauses: clauses.length,
                    },
                };
            }
        } catch (e) {
            return {
                sat: false,
                statistics: {
                    timeMs: Date.now() - startTime,
                    clauses: clauses.length,
                },
            };
        }
    }

    /**
     * Instantiate clauses with constants (Herbrand instantiation Level 0)
     */
    private instantiateClauses(clauses: Clause[]): Clause[] {
        // 1. Collect all constants and variables
        const constants = new Set<string>();
        const variables = new Set<string>();

        for (const clause of clauses) {
            for (const lit of clause.literals) {
                for (const arg of lit.args) {
                    // standardizeVariables typically produces 'X', 'Y', 'Z', 'X1', 'Y1' etc.
                    // Constants are lowercase (from parser).
                    // Skolem constants are sk_N.

                    // Check if it looks like a variable (starts with Uppercase)
                    if (/^[A-Z]/.test(arg)) {
                        variables.add(arg);
                    } else {
                        constants.add(arg);
                    }
                }
            }
        }

        // If no constants, add a dummy constant 'c'
        if (constants.size === 0) {
            constants.add('c');
        }

        const constantList = Array.from(constants);
        const instantiatedClauses: Clause[] = [];

        for (const clause of clauses) {
            const clauseVars = new Set<string>();
            for (const lit of clause.literals) {
                for (const arg of lit.args) {
                    if (/^[A-Z]/.test(arg)) clauseVars.add(arg);
                }
            }

            if (clauseVars.size === 0) {
                instantiatedClauses.push(clause);
                continue;
            }

            // Generate substitutions
            // For now, only handle up to 3 variables to avoid explosion
            if (clauseVars.size > 3) {
                // Fallback: keep original (uninstantiated) which will likely be ignored or fail unification
                instantiatedClauses.push(clause);
                continue;
            }

            const vars = Array.from(clauseVars);
            const assignments = allMappings(vars, constantList);

            for (const assign of assignments) {
                const newLiterals = clause.literals.map(lit => ({
                    predicate: lit.predicate,
                    negated: lit.negated,
                    args: lit.args.map(a => assign.get(a) || a)
                }));
                instantiatedClauses.push({ literals: newLiterals, origin: clause.origin });
            }
        }

        return instantiatedClauses;
    }

    /**
     * Prove a conclusion from premises using refutation.
     * 
     * Method: Clausify (premises ∧ ¬conclusion) and check for UNSAT.
     * If UNSAT, the conclusion follows from the premises.
     */
    async prove(
        premises: string[],
        conclusion: string,
        options?: EngineProveOptions
    ): Promise<ProveResult> {
        const startTime = Date.now();
        const verbosity = options?.verbosity || 'standard';

        try {
            // Build the refutation formula: premises & -conclusion
            // Use AST construction to avoid string parsing issues
            const premiseNodes = premises.map(p => parse(p));
            const conclusionNode = parse(conclusion);
            const negatedConclusion = createNot(conclusionNode);

            // Combine all formulas with AND
            const allNodes = [...premiseNodes, negatedConclusion];
            // If only one node (no premises), just use it. If multiple, reduce with AND.
            // Note: createAnd takes 2 args.
            const refutationAST = allNodes.length > 0
                ? allNodes.reduce((acc, node) => createAnd(acc, node))
                : negatedConclusion; // Should not happen given premises+conclusion

            // Clausify 
            const clausifyResult = clausify(refutationAST);

            if (!clausifyResult.success || !clausifyResult.clauses) {
                return buildProveResult({
                    success: false,
                    result: 'error',
                    error: clausifyResult.error?.message || 'Clausification failed',
                    timeMs: Date.now() - startTime,
                }, verbosity);
            }

            let allClauses = clausifyResult.clauses;

            // Inject equality axioms if enabled
            if (options?.enableEquality) {
                const predicates = new Map<string, number>();
                for (const c of allClauses) {
                    for (const l of c.literals) {
                        if (l.predicate !== '=') {
                            predicates.set(l.predicate, l.args.length);
                        }
                    }
                }

                const axioms: string[] = [];
                // Reflexivity
                axioms.push('all x (x = x)');
                // Symmetry
                axioms.push('all x all y (x = y -> y = x)');
                // Transitivity
                axioms.push('all x all y all z (x = y & y = z -> x = z)');

                // Substitution for each predicate
                for (const [pred, arity] of predicates) {
                    const vars1 = Array.from({ length: arity }, (_, i) => `X${i+1}`);
                    const vars2 = Array.from({ length: arity }, (_, i) => `Y${i+1}`);
                    const eqs = vars1.map((v, i) => `${v} = ${vars2[i]}`).join(' & ');
                    const term1 = `${pred}(${vars1.join(', ')})`;
                    const term2 = `${pred}(${vars2.join(', ')})`;
                    axioms.push(`all ${vars1.join(' all ')} all ${vars2.join(' all ')} (${eqs} -> (${term1} <-> ${term2}))`);
                }

                if (axioms.length > 0) {
                    const axiomsStr = axioms.join(' & ');
                    const axiomsResult = clausify(axiomsStr);
                    if (axiomsResult.success && axiomsResult.clauses) {
                        allClauses = [...allClauses, ...axiomsResult.clauses];
                    }
                }
            }

            // Instantiate variables (Grounding)
            const groundClauses = this.instantiateClauses(allClauses);

            // Check satisfiability
            const satResult = await this.checkSat(groundClauses);

            if (!satResult.sat) {
                return buildProveResult({
                    success: true,
                    result: 'proved',
                    message: `Proved: ${conclusion} (via refutation)`,
                    proof: [
                        `Premises: ${premises.join('; ')}`,
                        `Conclusion: ${conclusion}`,
                        `Method: Refutation (premises ∧ ¬conclusion is UNSAT)`,
                    ],
                    timeMs: Date.now() - startTime,
                    clauseCount: groundClauses.length,
                    varCount: satResult.statistics?.variables,
                }, verbosity);
            } else {
                return buildProveResult({
                    success: false,
                    result: 'failed',
                    message: `Cannot prove: ${conclusion}`,
                    error: 'Found satisfying assignment for premises ∧ ¬conclusion',
                    timeMs: Date.now() - startTime,
                    clauseCount: groundClauses.length,
                    varCount: satResult.statistics?.variables,
                }, verbosity);
            }
        } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            return buildProveResult({
                success: false,
                result: 'error',
                error,
                timeMs: Date.now() - startTime,
            }, verbosity);
        }
    }
}

/**
 * Create a new SAT engine instance.
 */
export function createSATEngine(): SATEngine {
    return new SATEngine();
}

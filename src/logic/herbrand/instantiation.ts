/**
 * Herbrand Instantiation Logic
 *
 * Provides utilities for instantiating clauses with constants (Herbrand universe).
 * Used by SAT-based engines to convert FOL to Propositional Logic.
 */

import type { Clause } from '../../types/clause.js';
import { astToString } from '../../ast/index.js';
import { allMappings } from '../../utils/math/enumerate.js';

/**
 * Instantiate clauses with constants (Herbrand instantiation Level 0).
 *
 * @param clauses - The clauses to instantiate
 * @returns Array of instantiated clauses (ground clauses)
 */
export function instantiateClauses(clauses: Clause[]): Clause[] {
    // 1. Collect all constants and variables
    const constants = new Set<string>();

    for (const clause of clauses) {
        for (const lit of clause.literals) {
            for (const arg of lit.args) {
                if (arg.type === 'constant') {
                    constants.add(arg.name!);
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
                if (arg.type === 'variable') {
                    clauseVars.add(arg.name!);
                }
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
                args: lit.args.map(a => {
                    if (a.type === 'variable' && assign.has(a.name!)) {
                        return { type: 'constant', name: assign.get(a.name!) } as const;
                    }
                    return a;
                })
            }));
            instantiatedClauses.push({ literals: newLiterals, origin: clause.origin });
        }
    }

    return instantiatedClauses;
}

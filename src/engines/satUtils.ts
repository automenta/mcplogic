/**
 * SAT Engine Utilities
 *
 * Helper functions for mapping CNF to SAT solver inputs.
 */

import Logic from 'logic-solver';
import { Clause } from '../types/clause.js';

/**
 * Convert a literal to a unique string key for the SAT solver.
 */
export function literalToKey(lit: { predicate: string; args: string[] }): string {
    if (lit.args.length === 0) {
        return lit.predicate;
    }
    return `${lit.predicate}(${lit.args.join(',')})`;
}

/**
 * Check satisfiability of clauses using the logic-solver package.
 */
export function solveSat(clauses: Clause[]): {
    sat: boolean;
    model: Map<string, boolean>;
    statistics: { variables: number; clauses: number };
} {
    if (clauses.length === 0) {
        return {
            sat: true,
            model: new Map(),
            statistics: { variables: 0, clauses: 0 }
        };
    }

    const solver = new Logic.Solver();
    const variables = new Set<string>();

    // Convert each clause to logic-solver format
    for (const clause of clauses) {
        if (clause.literals.length === 0) {
            // Empty clause = unsatisfiable
            return {
                sat: false,
                model: new Map(),
                statistics: { variables: variables.size, clauses: clauses.length }
            };
        }

        const disjuncts = clause.literals.map(lit => {
            const key = literalToKey(lit);
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
            statistics: { variables: variables.size, clauses: clauses.length }
        };
    } else {
        return {
            sat: false,
            model: new Map(),
            statistics: { variables: variables.size, clauses: clauses.length }
        };
    }
}

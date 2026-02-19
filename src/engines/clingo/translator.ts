import { Clause, Literal } from '../../types/clause.js';
import { ASTNode } from '../../types/ast.js';

/**
 * Translate a set of clauses to an ASP program.
 *
 * Each clause is a disjunction of literals:
 *   L1 | L2 | ... | ~M1 | ~M2 | ...
 *
 * In ASP this becomes a rule:
 *   L1 | L2 | ... :- M1, M2, ... .
 *
 * Where positive literals are in the head (disjunctive) and negative literals are in the body.
 * Note: ASP negation 'not' is default negation. Here we use it as classical negation in body?
 * Actually, for standard FOL -> ASP translation:
 *   P(x) | ~Q(x)  ==>  P(X) :- Q(X).
 *
 * So negative literals move to body as positive atoms.
 * Positive literals stay in head.
 *
 * If head is empty: :- M1, M2... (Constraint).
 * If body is empty: L1 | L2... . (Fact/Disjunction).
 */
export function clausesToASP(clauses: Clause[]): string {
    return clauses.map(clauseToASP).join('\n');
}

function clauseToASP(clause: Clause): string {
    const headLiterals: Literal[] = [];
    const bodyLiterals: Literal[] = [];

    for (const lit of clause.literals) {
        if (lit.negated) {
            // ~A -> A in body
            bodyLiterals.push(lit);
        } else {
            // A -> A in head
            headLiterals.push(lit);
        }
    }

    const headStr = headLiterals.map(l => literalToASP(l)).join(' | ');
    const bodyStr = bodyLiterals.map(l => literalToASP(l)).join(', ');

    if (headStr && bodyStr) {
        return `${headStr} :- ${bodyStr}.`;
    } else if (headStr) {
        return `${headStr}.`;
    } else if (bodyStr) {
        return `:- ${bodyStr}.`;
    } else {
        // Empty clause (false)
        return `:- .`; // Or explicit false? In ASP `:-.` is invalid syntax usually? `:-` requires body.
        // `:-` with empty body is unsatisfiable rule? No.
        // Constraint with empty body is `:- true.` which is always false.
        // So `:- .` is a contradiction.
        // Wait, standard ASP uses `:- body.`
        // If body is empty, `:- .`?
        // Best to use explicit `false` or `fail`:
        // `fail :- .` and `:- fail.` ?
        // Or just `:- 1=1.`
        return `:- 1=1.`;
    }
}

function literalToASP(lit: Literal): string {
    // Literal is predicate(args).
    const pred = lit.predicate;
    // ASP predicates must start with lowercase.
    const predName = toSafePredicateName(pred);

    if (!lit.args || lit.args.length === 0) {
        return predName;
    }

    const argsStr = lit.args.map(arg => termToASP(arg)).join(', ');
    return `${predName}(${argsStr})`;
}

function termToASP(node: ASTNode): string {
    switch (node.type) {
        case 'variable':
            // Variables must be uppercase.
            return toSafeVarName(node.name!);
        case 'constant':
            // Constants must be lowercase (or quoted).
            return toSafeConstName(node.name!);
        case 'function':
            // Functions: f(args)
            const funcName = toSafeConstName(node.name!); // functions are like constants in ASP term
            const args = node.args!.map(termToASP).join(', ');
            return `${funcName}(${args})`;
        default:
             // Should not happen in clauses
            return 'unknown';
    }
}

function toSafePredicateName(name: string): string {
    // Ensure starts with lowercase
    let safe = name.replace(/[^a-zA-Z0-9_]/g, '_');
    if (/^[A-Z]/.test(safe)) {
        safe = safe.charAt(0).toLowerCase() + safe.slice(1);
    }
    return safe;
}

function toSafeVarName(name: string): string {
    // Ensure starts with uppercase
    let safe = name.replace(/[^a-zA-Z0-9_]/g, '_');
    if (/^[a-z]/.test(safe)) {
        safe = safe.charAt(0).toUpperCase() + safe.slice(1);
    }
    return safe;
}

function toSafeConstName(name: string): string {
    // Ensure starts with lowercase
    let safe = name.replace(/[^a-zA-Z0-9_]/g, '_');
    if (/^[A-Z]/.test(safe)) {
        safe = safe.charAt(0).toLowerCase() + safe.slice(1);
    }
    // Handle numeric constants?
    if (/^-?\d+$/.test(name)) {
        return name;
    }
    return safe;
}

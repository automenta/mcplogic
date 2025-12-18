/**
 * Trace Utilities
 * 
 * Provides meta-interpreter for generating proof traces in Prolog.
 */

import { FormulaSignature } from '../../utils/ast.js';

/**
 * Meta-interpreter for tracing Prolog execution.
 * Handles user predicates via clause/2 and built-ins via call/1.
 */
export const META_INTERPRETER = `
:- use_module(library(lists)).

% Trace entry point
trace_goal(Goal) :-
    trace_step(Goal, 0).

trace_step(true, _) :- !.
trace_step((A, B), Depth) :- !,
    trace_step(A, Depth),
    trace_step(B, Depth).
trace_step(Goal, Depth) :-
    Goal \\= true,
    Goal \\= (_, _),
    (   predicate_property(Goal, built_in)
    ->  write('CALL (Built-in): '), write(Goal), nl,
        call(Goal),
        write('EXIT (Built-in): '), write(Goal), nl
    ;   write('CALL: '), write(Goal), nl,
        clause(Goal, Body),
        NewDepth is Depth + 1,
        trace_step(Body, NewDepth),
        write('EXIT: '), write(Goal), nl
    ).
`;

/**
 * Generate dynamic directives for all predicates in the signature.
 * Required for clause/2 to work on user predicates.
 */
export function generateDynamicDirectives(signature: FormulaSignature): string {
    const directives: string[] = [];
    for (const [name, arity] of signature.predicates) {
        // Skip internal predicates if any, though usually safe to make dynamic
        directives.push(`:- dynamic(${name}/${arity}).`);
    }
    return directives.join('\n');
}

/**
 * Parse trace output into structured steps
 */
export function parseTraceOutput(output: string): string[] {
    return output.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && (line.startsWith('CALL') || line.startsWith('EXIT')));
}

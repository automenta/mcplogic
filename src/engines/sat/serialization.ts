/**
 * SAT Serialization Utilities
 *
 * Handles serialization of literals to string keys for SAT solvers,
 * and parsing them back.
 */

import { Literal } from '../../types/clause.js';
import { astToString } from '../../ast/index.js';

/**
 * Convert a literal to a unique string key.
 * Format: predicate(arg1,arg2,...)
 */
export function literalToKey(lit: Literal): string {
    const argStrings = lit.args.map(astToString);
    if (argStrings.length === 0) {
        return lit.predicate;
    }
    return `${lit.predicate}(${argStrings.join(',')})`;
}

/**
 * Parsed key components
 */
export interface ParsedKey {
    predicate: string;
    args: string[];
}

/**
 * Parse a SAT key back into predicate and argument strings.
 * Note: Arguments are returned as strings (e.g. "a", "f(x)").
 */
export function parseKey(key: string): ParsedKey | null {
    const m = key.match(/^(\w+)(?:\(([^)]*)\))?$/);
    if (!m) return null;

    const [, pred, argsStr] = m;

    // Split args by comma, respecting nested parens if we were doing full parsing,
    // but here we expect ground terms which might just be constants.
    // If we have f(a,b), splitting by comma is risky if args contain commas.
    // However, in current grounding, args are usually simple constants.
    // If we want to be robust we should use a proper parser or ensuring args don't contain commas.
    // Given the context of "Level 0" instantiation where args are constants, simple split is okay for now.

    const args = argsStr ? argsStr.split(',').map(s => s.trim()) : [];

    return {
        predicate: pred,
        args
    };
}

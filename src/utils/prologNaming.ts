/**
 * Prolog Naming Utilities
 *
 * Functions to ensure consistent naming conventions between FOL/AST and Prolog.
 */

/**
 * Formats a term string (variable or constant) for Prolog.
 *
 * Rules:
 * - Variables (start with _ or uppercase) -> Uppercase
 * - Skolem constants (start with sk) -> Lowercase
 * - Free variables (single lowercase letter) -> Uppercase (implicit universal)
 * - Constants (lowercase or uppercase) -> Lowercase
 */
export function formatPrologTerm(term: string): string {
    if (term.startsWith('_v')) {
        // It's a variable from Clausifier, ensure uppercase for Prolog
        return term.toUpperCase();
    } else if (term.startsWith('sk')) {
        // Skolem constant, ensure lowercase
        return term.toLowerCase();
    } else if (term.length === 1 && /^[a-z]/.test(term)) {
        // Single lowercase letter: Free variable (implicitly universal)
        return term.toUpperCase();
    } else if (/^[a-z]/.test(term)) {
        // Lowercase string (length > 1): Constant
        return term;
    } else {
        // Uppercase string or other: Constant
        // Example: Socrates -> socrates
        return term.toLowerCase();
    }
}

/**
 * Convert a Prolog identifier back to FOL format (lowercase).
 */
export function prologToFolName(name: string): string {
    return name.toLowerCase();
}

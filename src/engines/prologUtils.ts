/**
 * Tau-Prolog Utility Functions
 *
 * Low-level interactions with the Tau-Prolog session.
 */

import pl from 'tau-prolog';
import type { Session, Answer, Term } from 'tau-prolog';

// Re-export type for compatibility
export type PrologSession = Session;

export interface PrologTerm {
    id: string;
    args?: PrologTerm[];
    indicator?: string;
    toString(): string;
}

/**
 * Format Prolog error from Tau-Prolog object
 */
export function formatError(err: unknown): string {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;

    const term = err as Term;
    // Check if it's a Term object (id, args)
    if (term.id && Array.isArray(term.args)) {
        // Typically error(term, context)
        return `${term.id}(${term.args.map(termToString).join(', ')})`;
    }

    if (typeof err === 'object' && 'toString' in err && typeof (err as any).toString === 'function') {
        return (err as any).toString();
    }
    return String(err);
}

/**
 * Convert Prolog term to string
 */
export function termToString(term: unknown): string {
    if (term === null || term === undefined) return '';
    if (typeof term === 'string') return term;
    if (typeof term === 'number') return String(term);

    const t = term as Term;
    // Tau-Prolog Term object has toString() but it might be missing in type def if custom

    if (typeof (term as any).toString === 'function') return (term as any).toString();
    if (t.id) return t.id;
    return String(term);
}

/**
 * Consult a Prolog program
 */
export function consult(session: Session, program: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
        session.consult(program, {
            success: () => resolve({ success: true }),
            error: (err: unknown) => resolve({
                success: false,
                error: formatError(err)
            })
        });
    });
}

/**
 * Run a Prolog query and collect answers
 */
export function query(session: Session, goal: string): Promise<{
    found: boolean;
    bindings?: Record<string, string>[];
    error?: string;
    hitLimit?: boolean;
}> {
    return new Promise((resolve) => {
        session.query(goal, {
            success: (_goal: Term) => {
                collectAnswers(session).then(resolve);
            },
            error: (err: unknown) => {
                resolve({ found: false, error: formatError(err) });
            }
        });
    });
}

/**
 * Collect all answers from a query
 */
function collectAnswers(session: Session): Promise<{
    found: boolean;
    bindings: Record<string, string>[];
    hitLimit?: boolean;
}> {
    return new Promise((resolve) => {
        const bindings: Record<string, string>[] = [];
        let hitLimit = false;

        const getNext = () => {
            session.answer({
                success: (answer: Answer | null) => {
                    if (answer) {
                        bindings.push(extractBindings(answer));
                        getNext(); // Get next answer
                    } else {
                        // Should not happen for success callback but safe fallback
                        resolve({ found: bindings.length > 0, bindings, hitLimit });
                    }
                },
                fail: () => {
                    resolve({ found: bindings.length > 0, bindings, hitLimit });
                },
                error: (_err: unknown) => {
                     // Normally we might want to report this, but here we treat it as end of answers
                    resolve({ found: bindings.length > 0, bindings, hitLimit });
                },
                limit: () => {
                    hitLimit = true;
                    resolve({ found: bindings.length > 0, bindings, hitLimit });
                }
            });
        };

        getNext();
    });
}

/**
 * Extract variable bindings from Prolog answer
 */
function extractBindings(answer: Answer): Record<string, string> {
    const bindings: Record<string, string> = {};

    if (answer && answer.links) {
        for (const [varName, value] of Object.entries(answer.links)) {
            bindings[varName] = termToString(value);
        }
    }

    return bindings;
}

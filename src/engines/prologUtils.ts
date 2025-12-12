/**
 * Prolog Utilities
 *
 * Shared utilities for working with Tau-Prolog.
 * Extracts low-level Prolog interaction logic from the Logic Engine.
 */

import type { Session } from 'tau-prolog';

/**
 * Convert Prolog term to string
 */
export function termToString(term: any): string {
    if (term === null || term === undefined) return '';
    if (typeof term === 'string') return term;
    if (typeof term === 'number') return String(term);
    if (term.id) return term.id;
    if (term.indicator) return `${term.id}/${term.indicator}`;
    return String(term);
}

/**
 * Format Prolog error
 */
export function formatPrologError(err: any): string {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (err.args?.length > 0) {
        return `${err.id || 'Error'}: ${err.args.map(termToString).join(', ')}`;
    }
    if (err.id) return err.id;
    return String(err);
}

/**
 * Extract variable bindings from Prolog answer
 */
export function extractBindings(answer: any): Record<string, string> {
    const bindings: Record<string, string> = {};

    if (answer && answer.links) {
        for (const [varName, value] of Object.entries(answer.links)) {
            bindings[varName] = termToString(value);
        }
    }

    return bindings;
}

/**
 * Consult a Prolog program in a session
 */
export function consultProgram(session: Session, program: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
        session.consult(program, {
            success: () => resolve({ success: true }),
            error: (err: any) => resolve({
                success: false,
                error: formatPrologError(err)
            })
        });
    });
}

/**
 * Run a Prolog query and collect answers
 */
export function runPrologQuery(session: Session, query: string): Promise<{
    found: boolean;
    bindings?: Record<string, string>[];
    error?: string;
    hitLimit?: boolean;
}> {
    return new Promise((resolve) => {
        session.query(query, {
            success: () => {
                collectAnswers(session).then(resolve);
            },
            error: (err: any) => {
                resolve({ found: false, error: formatPrologError(err) });
            }
        });
    });
}

/**
 * Collect all answers from a query
 */
async function collectAnswers(session: Session): Promise<{
    found: boolean;
    bindings: Record<string, string>[];
    hitLimit?: boolean;
}> {
    return new Promise((resolve) => {
        const bindings: Record<string, string>[] = [];
        let hitLimit = false;

        const getNext = () => {
            session.answer({
                success: (answer: any) => {
                    if (answer) {
                        bindings.push(extractBindings(answer));
                        getNext(); // Get next answer
                    } else {
                        resolve({ found: bindings.length > 0, bindings, hitLimit });
                    }
                },
                fail: () => {
                    resolve({ found: bindings.length > 0, bindings, hitLimit });
                },
                error: () => {
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

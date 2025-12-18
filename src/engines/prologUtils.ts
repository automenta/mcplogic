/**
 * Tau-Prolog Utility Functions
 *
 * Low-level interactions with the Tau-Prolog session.
 */

import pl from 'tau-prolog';

export interface PrologTerm {
    id: string;
    args?: PrologTerm[];
    indicator?: string;
    toString(): string;
}

export interface PrologAnswer {
    links: Record<string, PrologTerm>;
}

// In tau-prolog type definitions, session is a class, but we use it as type here
export type Session = pl.type.Session;

// Re-export type for compatibility
export type PrologSession = Session;

/**
 * Format Prolog error from Tau-Prolog object
 */
export function formatError(err: any): string {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    // Check if it's a Term object (id, args)
    if (err.id && Array.isArray(err.args)) {
        // Typically error(term, context)
        return `${err.id}(${err.args.map(termToString).join(', ')})`;
    }
    if (err.toString) return err.toString();
    return String(err);
}

/**
 * Convert Prolog term to string
 */
export function termToString(term: any): string {
    if (term === null || term === undefined) return '';
    if (typeof term === 'string') return term;
    if (typeof term === 'number') return String(term);
    // Tau-Prolog Term object has toString()
    if (term.toString) return term.toString();
    if (term.id) return term.id;
    return String(term);
}

/**
 * Consult a Prolog program
 */
export function consult(session: Session, program: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
        session.consult(program, {
            success: () => resolve({ success: true }),
            error: (err: any) => resolve({
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
            success: () => {
                collectAnswers(session).then(resolve);
            },
            error: (err: any) => {
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
                success: (answer: any) => { // Type as any because Tau-Prolog types are tricky
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
                error: (err: any) => {
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
function extractBindings(answer: any): Record<string, string> {
    const bindings: Record<string, string> = {};

    if (answer && answer.links) {
        for (const [varName, value] of Object.entries(answer.links)) {
            bindings[varName] = termToString(value);
        }
    }

    return bindings;
}

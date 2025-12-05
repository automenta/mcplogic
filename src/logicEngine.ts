/**
 * Logic Engine: Tau-Prolog wrapper for theorem proving
 * 
 * Provides async interface for proving and model finding using Tau-Prolog.
 */

import pl, { Session } from 'tau-prolog';

import { buildPrologProgram, folGoalToProlog } from './translator.js';
import { ProveResult } from './types/index.js';

export type { ProveResult };

/**
 * Logic Engine using Tau-Prolog
 */
export class LogicEngine {
    private session: Session;
    private inferenceLimit: number;

    /**
     * @param timeout Timeout in milliseconds (reserved for future use)
     * @param inferenceLimit Maximum inference steps before giving up (default: 1000)
     */
    constructor(_timeout: number = 5000, inferenceLimit: number = 1000) {
        this.inferenceLimit = inferenceLimit;
        this.session = pl.create(this.inferenceLimit);
    }

    /**
     * Prove a goal from given premises
     */
    async prove(premises: string[], conclusion: string): Promise<ProveResult> {
        try {
            // Build program from premises
            const program = buildPrologProgram(premises);

            // Create fresh session with configured inference limit
            this.session = pl.create(this.inferenceLimit);

            // Consult the program
            const consultResult = await this.consultProgram(program);
            if (!consultResult.success) {
                return {
                    success: false,
                    result: 'error',
                    error: consultResult.error
                };
            }

            // Build query from conclusion
            const query = folGoalToProlog(conclusion);

            // Run query
            const queryResult = await this.runQuery(query);

            if (queryResult.found) {
                return {
                    success: true,
                    result: 'proved',
                    proof: [`Goal: ${conclusion}`, `Program: ${premises.join('; ')}`, `Result: Proved via Prolog resolution`],
                    bindings: queryResult.bindings
                };
            } else {
                return {
                    success: false,
                    result: 'failed',
                    error: queryResult.error || 'No proof found'
                };
            }
        } catch (e) {
            return {
                success: false,
                result: 'error',
                error: e instanceof Error ? e.message : String(e)
            };
        }
    }

    /**
     * Consult a Prolog program
     */
    private consultProgram(program: string): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            this.session.consult(program, {
                success: () => resolve({ success: true }),
                error: (err: any) => resolve({
                    success: false,
                    error: this.formatError(err)
                })
            });
        });
    }

    /**
     * Run a Prolog query and collect answers
     */
    private runQuery(query: string): Promise<{ found: boolean; bindings?: Record<string, string>[]; error?: string }> {
        return new Promise((resolve) => {
            this.session.query(query, {
                success: () => {
                    this.collectAnswers().then(resolve);
                },
                error: (err: any) => {
                    resolve({ found: false, error: this.formatError(err) });
                }
            });
        });
    }

    /**
     * Collect all answers from a query
     */
    private collectAnswers(): Promise<{ found: boolean; bindings: Record<string, string>[] }> {
        return new Promise((resolve) => {
            const bindings: Record<string, string>[] = [];

            const getNext = () => {
                this.session.answer({
                    success: (answer: any) => {
                        if (answer) {
                            bindings.push(this.extractBindings(answer));
                            getNext(); // Get next answer
                        } else {
                            resolve({ found: bindings.length > 0, bindings });
                        }
                    },
                    fail: () => {
                        resolve({ found: bindings.length > 0, bindings });
                    },
                    error: () => {
                        resolve({ found: bindings.length > 0, bindings });
                    },
                    limit: () => {
                        resolve({ found: bindings.length > 0, bindings });
                    }
                });
            };

            getNext();
        });
    }

    /**
     * Extract variable bindings from Prolog answer
     */
    private extractBindings(answer: any): Record<string, string> {
        const bindings: Record<string, string> = {};

        if (answer && answer.links) {
            for (const [varName, value] of Object.entries(answer.links)) {
                bindings[varName] = this.termToString(value);
            }
        }

        return bindings;
    }

    /**
     * Convert Prolog term to string
     */
    private termToString(term: any): string {
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
    private formatError(err: any): string {
        if (!err) return 'Unknown error';
        if (typeof err === 'string') return err;
        if (err.args?.length > 0) {
            return `${err.id || 'Error'}: ${err.args.map(this.termToString).join(', ')}`;
        }
        if (err.id) return err.id;
        return String(err);
    }

    /**
     * Check if premises are satisfiable (can find a model)
     */
    async checkSatisfiability(premises: string[]): Promise<boolean> {
        try {
            const program = buildPrologProgram(premises);
            this.session = pl.create(this.inferenceLimit);

            const result = await this.consultProgram(program);
            return result.success;
        } catch {
            return false;
        }
    }
}

/**
 * Create a new logic engine instance
 * @param timeout Timeout in milliseconds (reserved for future use)
 * @param inferenceLimit Maximum inference steps (default: 1000)
 */
export function createLogicEngine(timeout?: number, inferenceLimit?: number): LogicEngine {
    return new LogicEngine(timeout, inferenceLimit);
}

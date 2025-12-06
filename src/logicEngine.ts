/**
 * Logic Engine: Tau-Prolog wrapper for theorem proving
 * 
 * Provides async interface for proving and model finding using Tau-Prolog.
 */

import pl, { Session } from 'tau-prolog';

import { buildPrologProgram, folGoalToProlog } from './translator.js';
import { getArithmeticSetup } from './arithmetic.js';
import { parse } from './parser.js';
import { extractSignature } from './astUtils.js';
import {
    generateEqualityAxioms,
    generateMinimalEqualityAxioms,
    getEqualityBridge
} from './equalityAxioms.js';
import {
    ProveResult,
    Verbosity,
    createInferenceLimitError,
    createEngineError,
} from './types/index.js';

export type { ProveResult };

/**
 * Options for prove operation
 */
export interface ProveOptions {
    verbosity?: Verbosity;
    /** Enable arithmetic support (default: false) */
    enableArithmetic?: boolean;
    /** Enable equality axioms (default: false) */
    enableEquality?: boolean;
}

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
    async prove(
        premises: string[],
        conclusion: string,
        options?: ProveOptions
    ): Promise<ProveResult> {
        const startTime = Date.now();
        const verbosity = options?.verbosity || 'standard';
        let prologProgram = '';
        let inferenceCount = 0;
        let hitInferenceLimit = false;

        try {
            // Build program from premises
            prologProgram = buildPrologProgram(premises);

            // Add arithmetic axioms if enabled
            if (options?.enableArithmetic) {
                const arithmeticSetup = getArithmeticSetup();
                prologProgram = arithmeticSetup + '\n' + prologProgram;
            }

            // Add equality axioms if enabled
            if (options?.enableEquality) {
                try {
                    const bridge = getEqualityBridge();
                    // Always include base equality axioms (reflexivity, symmetry, transitivity)
                    const emptySignature = extractSignature([]);
                    const baseAxioms = generateEqualityAxioms(emptySignature, {
                        includeCongruence: false,
                        includeSubstitution: false
                    });

                    // Add signature-specific axioms (congruence, substitution) only when = is used
                    const parsedFormulas = [...premises, conclusion].map(p => parse(p));
                    const signatureAxioms = generateMinimalEqualityAxioms(parsedFormulas);

                    const allAxioms = [...bridge, ...baseAxioms, ...signatureAxioms];
                    prologProgram = allAxioms.join('\n') + '\n' + prologProgram;
                } catch {
                    // If parsing fails for equality extraction, continue without equality axioms
                    // The main validation will catch syntax errors
                }
            }

            // Create fresh session with configured inference limit
            this.session = pl.create(this.inferenceLimit);

            // Consult the program
            const consultResult = await this.consultProgram(prologProgram);
            if (!consultResult.success) {
                return this.buildResult({
                    success: false,
                    result: 'error',
                    error: consultResult.error,
                    prologProgram,
                    timeMs: Date.now() - startTime,
                }, verbosity);
            }

            // Build query from conclusion
            const query = folGoalToProlog(conclusion);

            // Run query
            const queryResult = await this.runQuery(query);

            if (queryResult.hitLimit) {
                hitInferenceLimit = true;
            }

            if (queryResult.found) {
                return this.buildResult({
                    success: true,
                    result: 'proved',
                    message: `Proved: ${conclusion}`,
                    proof: [
                        `Goal: ${conclusion}`,
                        `Program: ${premises.join('; ')}`,
                        `Result: Proved via Prolog resolution`
                    ],
                    bindings: queryResult.bindings,
                    prologProgram,
                    timeMs: Date.now() - startTime,
                    inferenceCount,
                }, verbosity);
            } else {
                // If we hit the limit, use structured error
                if (hitInferenceLimit) {
                    const error = createInferenceLimitError(this.inferenceLimit, conclusion);
                    return this.buildResult({
                        success: false,
                        result: 'failed',
                        message: error.message,
                        error: error.message,
                        prologProgram,
                        timeMs: Date.now() - startTime,
                        inferenceCount: this.inferenceLimit,
                    }, verbosity);
                }

                return this.buildResult({
                    success: false,
                    result: 'failed',
                    message: 'No proof found',
                    error: queryResult.error || 'No proof found',
                    prologProgram,
                    timeMs: Date.now() - startTime,
                    inferenceCount,
                }, verbosity);
            }
        } catch (e) {
            const error = e instanceof Error ? e : createEngineError(String(e));
            return this.buildResult({
                success: false,
                result: 'error',
                error: error.message,
                prologProgram,
                timeMs: Date.now() - startTime,
                inferenceCount,
            }, verbosity);
        }
    }

    /**
     * Build result based on verbosity
     */
    private buildResult(
        data: {
            success: boolean;
            result: 'proved' | 'failed' | 'timeout' | 'error';
            message?: string;
            error?: string;
            proof?: string[];
            bindings?: Record<string, string>[];
            prologProgram?: string;
            timeMs: number;
            inferenceCount?: number;
        },
        verbosity: Verbosity
    ): ProveResult {
        const base: ProveResult = {
            success: data.success,
            result: data.result,
        };

        if (verbosity === 'minimal') {
            return base;
        }

        // Standard includes message, bindings, error
        base.message = data.message;
        base.bindings = data.bindings;
        base.error = data.error;
        base.proof = data.proof;

        if (verbosity === 'detailed') {
            base.prologProgram = data.prologProgram;
            base.statistics = {
                timeMs: data.timeMs,
                inferences: data.inferenceCount,
            };
        }

        return base;
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
    private runQuery(query: string): Promise<{
        found: boolean;
        bindings?: Record<string, string>[];
        error?: string;
        hitLimit?: boolean;
    }> {
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
    private collectAnswers(): Promise<{
        found: boolean;
        bindings: Record<string, string>[];
        hitLimit?: boolean;
    }> {
        return new Promise((resolve) => {
            const bindings: Record<string, string>[] = [];
            let hitLimit = false;

            const getNext = () => {
                this.session.answer({
                    success: (answer: any) => {
                        if (answer) {
                            bindings.push(this.extractBindings(answer));
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

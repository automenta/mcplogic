/**
 * Tau-Prolog Adapter
 *
 * Wraps low-level Tau-Prolog session management.
 */

import pl from 'tau-prolog';
import { PrologSession, consult, query, PrologAnswer } from '../prologUtils.js';

export interface PrologAdapter {
    consult(program: string): Promise<{ success: boolean; error?: string }>;
    query(goal: string): Promise<{
        found: boolean;
        bindings?: Record<string, string>[];
        error?: string;
        hitLimit?: boolean;
    }>;
    setStandardOutput(callback: (str: string) => void): void;
}

export class TauPrologAdapter implements PrologAdapter {
    private session: PrologSession;

    constructor(inferenceLimit: number) {
        this.session = pl.create(inferenceLimit);
    }

    async consult(program: string): Promise<{ success: boolean; error?: string }> {
        return consult(this.session, program);
    }

    async query(goal: string): Promise<{
        found: boolean;
        bindings?: Record<string, string>[];
        error?: string;
        hitLimit?: boolean;
    }> {
        return query(this.session, goal);
    }

    setStandardOutput(callback: (str: string) => void): void {
        const outputStream = {
            put: (char: string | number, _encoding: any) => {
                const str = typeof char === 'number' ? String.fromCharCode(char) : char;
                callback(str);
            },
            flush: () => { }
        };

        (this.session as any).standard_output = outputStream;

        const streams = (this.session as any).streams;
        if (streams) {
            ['standard_output', 'current_output', 'user_output'].forEach(alias => {
                if (streams[alias]) {
                    streams[alias].put = outputStream.put;
                }
            });
        }
    }
}

import type { Verbosity } from './responses.js';

export interface ReasoningOptions {
    verbosity?: Verbosity;
    maxSeconds?: number;
    maxInferences?: number;
    enableArithmetic?: boolean;
    enableEquality?: boolean;
    includeTrace?: boolean;
    /**
     * Callback for progress updates.
     * @param progress A number between 0 and 1 (if known) or undefined.
     * @param message A descriptive message about the current step.
     */
    onProgress?: (progress: number | undefined, message: string) => void;
}

export interface ProveOptions extends ReasoningOptions {
    strategy?: 'auto' | 'breadth' | 'depth' | 'iterative';
    engine?: 'auto' | 'prolog' | 'sat';
}

export interface ModelOptions extends ReasoningOptions {
    maxDomainSize?: number;
    enableSymmetry?: boolean;
    useSAT?: boolean | 'auto';
    satThreshold?: number;
    count?: number;
}

export const DEFAULTS = {
    maxSeconds: 30,
    maxInferences: 5000,
    maxDomainSize: 25,
    satThreshold: 8,
    highPowerMaxSeconds: 300,
    highPowerMaxInferences: 100000,
} as const;

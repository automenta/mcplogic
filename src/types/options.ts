import type { Verbosity } from './responses.js';

export interface ReasoningOptions {
    verbosity?: Verbosity;
    maxSeconds?: number;
    maxInferences?: number;
    enableArithmetic?: boolean;
    enableEquality?: boolean;
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
}

export const DEFAULTS = {
    maxSeconds: 30,
    maxInferences: 5000,
    maxDomainSize: 25,
    satThreshold: 8,
} as const;

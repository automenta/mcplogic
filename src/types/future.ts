/**
 * Type definitions for planned features.
 * These define the API contracts before implementation.
 */

// === High-Power Mode (Phase 1.1) ===
export interface HighPowerOptions {
    highPower?: boolean;
}

// === Ontology (Phase 4.1) ===
export interface Ontology {
    types: Set<string>;
    relationships: Set<string>;
    constraints: Set<string>;
    synonyms: Map<string, string>;
}

export interface OntologyConfig {
    types?: string[];
    relationships?: string[];
    constraints?: string[];
    synonyms?: Record<string, string>;
}

// === Agentic Reasoning (Phase 4.2) ===
export type AgentActionType = 'assert' | 'query' | 'conclude';

export interface AgentAction {
    type: AgentActionType;
    content: string;
    explanation?: string;
}

export interface ReasoningStep {
    action: AgentAction;
    result?: unknown;
    timestamp?: number;
}

export interface ReasoningResult {
    answer: string;
    steps: ReasoningStep[];
    confidence: number;
}

export interface ReasonOptions {
    maxSteps?: number;
    timeout?: number;
    verbose?: boolean;
}

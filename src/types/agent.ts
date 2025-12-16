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

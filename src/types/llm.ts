/**
 * LLM Provider and Translation interfaces.
 */

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
}

export interface LLMProvider {
    complete(messages: LLMMessage[]): Promise<LLMResponse>;
}

export interface TranslationStrategy {
    translate(text: string): Promise<TranslationResult>;
}

export interface TranslationResult {
    premises: string[];
    conclusion?: string;
    errors?: string[];
}

// === NL Translation (Phase 3.1) ===
export interface TranslateRequest {
    text: string;
    validate?: boolean;
}

export interface TranslateResult {
    success: boolean;
    premises: string[];
    conclusion?: string;
    raw?: string;
    errors?: string[];
}

import type { TranslationStrategy, TranslationResult, LLMProvider } from '../types/llm.js';
import type { EvolutionStrategy } from '../types/evolution.js';
import { HeuristicTranslator } from './translator.js';
import { parseLLMOutput } from './outputParser.js';

/**
 * A translator that uses an LLM and a specific prompt template (EvolutionStrategy)
 * to translate natural language to First-Order Logic.
 */
export class LLMTranslator implements TranslationStrategy {
    private provider: LLMProvider;
    private strategy: EvolutionStrategy;
    private fallback: HeuristicTranslator;

    constructor(provider: LLMProvider, strategy: EvolutionStrategy) {
        this.provider = provider;
        this.strategy = strategy;
        this.fallback = new HeuristicTranslator();
    }

    async translate(text: string): Promise<TranslationResult> {
        try {
            // 1. Prepare prompt
            const prompt = this.strategy.promptTemplate.replace('{{INPUT}}', text);

            // 2. Call LLM
            const response = await this.provider.complete([
                { role: 'user', content: prompt }
            ]);

            const rawOutput = response.content;

            // 3. Parse output
            const { premises, conclusion } = parseLLMOutput(rawOutput);
            const errors: string[] = [];

            return {
                premises,
                conclusion,
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (error) {
            return {
                premises: [],
                errors: [`LLM Translation failed: ${(error as Error).message}`]
            };
        }
    }
}

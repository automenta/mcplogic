import type { TranslationStrategy, TranslationResult, LLMProvider } from '../types/llm.js';
import type { EvolutionStrategy } from '../types/evolution.js';
import { HeuristicTranslator } from './translator.js';

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
            // We use a simple user message for now.
            // EvolutionStrategy parameters (temp, etc) would be used here if the Provider interface supported them per-call.
            const response = await this.provider.complete([
                { role: 'user', content: prompt }
            ]);

            const rawOutput = response.content;

            // 3. Parse output
            // This assumes the LLM outputs raw FOL lines or a specific format.
            // We might need a more robust parser depending on the strategy's expected output format.
            // For now, reuse HeuristicTranslator's parsing logic or simple line splitting?
            // Let's try to extract formulas.

            // If the strategy output is expected to be pure code/FOL, we can try to parse it.
            // A common pattern is to wrap output in ```prolog blocks.
            const codeBlockMatch = rawOutput.match(/```(?:prolog)?\s*([\s\S]*?)```/);
            const contentToParse = codeBlockMatch ? codeBlockMatch[1] : rawOutput;

            // Basic cleanup
            const lines = contentToParse
                .split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('%') && !l.startsWith('#')); // comments

            // Validation?
            // If we have a robust parser, we should use it.
            // For now, let's just return the lines as premises.

            // Limitation: We don't distinguish conclusion vs premises easily without markers.
            // We will assume everything is a premise unless marked "conclusion:" (similar to Heuristic)

            const premises: string[] = [];
            let conclusion: string | undefined;
            const errors: string[] = [];

            for (const line of lines) {
                if (line.toLowerCase().startsWith('conclusion:') || line.toLowerCase().startsWith('prove:')) {
                    conclusion = line.replace(/^(conclusion:|prove:)\s*/i, '');
                } else {
                    premises.push(line);
                }
            }

            return {
                premises,
                conclusion,
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (error) {
            // Fallback to heuristic if LLM fails? Or just report error?
            // Reporting error is safer for debugging evolution.
            return {
                premises: [],
                errors: [`LLM Translation failed: ${(error as Error).message}`]
            };
        }
    }
}

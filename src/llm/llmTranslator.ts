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
            const response = await this.provider.complete([
                { role: 'user', content: prompt }
            ]);

            const rawOutput = response.content;

            // 3. Parse output
            // Strategy:
            // a. Try to extract code blocks first.
            // b. If no blocks, process the whole text.
            // c. Filter lines that look like conversational filler.

            const codeBlockMatch = rawOutput.match(/```(?:prolog|logic|text)?\s*([\s\S]*?)```/);
            const contentToParse = codeBlockMatch ? codeBlockMatch[1] : rawOutput;

            const lines = contentToParse
                .split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('%') && !l.startsWith('#') && !l.startsWith('//')); // comments

            const premises: string[] = [];
            let conclusion: string | undefined;
            const errors: string[] = [];

            for (const line of lines) {
                // Check for conclusion markers
                if (/^(conclusion:|prove:|goal:)\s*/i.test(line)) {
                    conclusion = line.replace(/^(conclusion:|prove:|goal:)\s*/i, '');
                    continue;
                }

                // Heuristic filtering for conversational lines if we didn't find a code block
                // If we found a code block, we assume the LLM put valid stuff in it.
                // If we are parsing raw text, we need to be careful.
                if (!codeBlockMatch) {
                    // Skip lines that end with ':' (often headers like "Here is the logic:")
                    if (line.endsWith(':')) continue;

                    // Skip lines that look like sentences but don't have logic symbols or parens
                    // (Very rough heuristic: must have '(', ')', '=', '->', '<->', '&', '|', 'all ', 'exists ', or be very short assignment)
                    const hasLogicChars = /[()=&|<>]|all\s|exists\s/.test(line);

                    // If it doesn't have logic chars, and has spaces (implies sentence), skip it.
                    // Allows "P(a)" but skips "Sure thing."
                    if (!hasLogicChars && line.includes(' ')) {
                         continue;
                    }
                }

                premises.push(line);
            }

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

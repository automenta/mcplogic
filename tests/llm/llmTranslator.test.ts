import { LLMTranslator } from '../../src/llm/llmTranslator.js';
import type { EvolutionStrategy } from '../../src/types/evolution.js';
import type { LLMProvider, LLMMessage } from '../../src/types/llm.js';

// Mock Provider
class MockProvider implements LLMProvider {
    async complete(messages: LLMMessage[]) {
        const prompt = messages[0].content;
        if (prompt.includes('man(socrates)')) {
            return {
                content: 'man(socrates)',
                usage: { promptTokens: 10, completionTokens: 5 }
            };
        }
        if (prompt.includes('complex')) {
            return {
                content: '```prolog\nall x (P(x) -> Q(x))\n```',
                usage: { promptTokens: 10, completionTokens: 5 }
            };
        }
        return { content: '', usage: undefined };
    }
}

describe('LLMTranslator', () => {
    let provider: MockProvider;
    let strategy: EvolutionStrategy;
    let translator: LLMTranslator;

    beforeEach(() => {
        provider = new MockProvider();
        strategy = {
            id: 'test',
            description: 'test',
            promptTemplate: 'Translate {{INPUT}}',
            parameters: {},
            metadata: { successRate: 0, inferenceCount: 0, generation: 0 }
        };
        translator = new LLMTranslator(provider, strategy);
    });

    test('should translate simple sentence', async () => {
        // We mock the prompt replacement to match what the mock provider expects
        strategy.promptTemplate = 'Translate {{INPUT}} to FOL: man(socrates)';

        const result = await translator.translate('Socrates is a man');
        expect(result.premises).toContain('man(socrates)');
    });

    test('should extract from code blocks', async () => {
        strategy.promptTemplate = 'Translate complex {{INPUT}}';
        const result = await translator.translate('something');
        expect(result.premises).toContain('all x (P(x) -> Q(x))');
    });

    test('should handle failures gracefully', async () => {
        // Force provider error by using a different mock or just assuming empty response handling
        const emptyProvider = {
            complete: async () => { throw new Error('API Error'); }
        };
        const failTranslator = new LLMTranslator(emptyProvider, strategy);

        const result = await failTranslator.translate('fail');
        expect(result.errors).toBeDefined();
        expect(result.errors?.[0]).toContain('API Error');
    });
});

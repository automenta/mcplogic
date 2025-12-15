import { HeuristicTranslator } from '../src/llm/translator.js';

describe('HeuristicTranslator', () => {
    let translator: HeuristicTranslator;

    beforeEach(() => {
        translator = new HeuristicTranslator();
    });

    test('translates "is a" sentences', async () => {
        const result = await translator.translate('Socrates is a man');
        expect(result.premises).toEqual(['man(socrates)']);
    });

    test('translates "is" adjectives', async () => {
        const result = await translator.translate('Socrates is mortal');
        expect(result.premises).toEqual(['mortal(socrates)']);
    });

    test('translates "All X are Y"', async () => {
        const result = await translator.translate('All men are mortals');
        expect(result.premises).toEqual(['all x (man(x) -> mortal(x))']);
    });

    test('translates "Some X are Y"', async () => {
        const result = await translator.translate('Some men are mortals');
        expect(result.premises).toEqual(['exists x (man(x) & mortal(x))']);
    });

    test('translates "No X are Y"', async () => {
        const result = await translator.translate('No men are mortals');
        expect(result.premises).toEqual(['all x (man(x) -> -mortal(x))']);
    });

    test('translates transitive verbs', async () => {
        const result = await translator.translate('John loves Mary');
        expect(result.premises).toEqual(['love(john, mary)']);
    });

    test('translates If-Then', async () => {
        const result = await translator.translate('If raining then wet');
        expect(result.premises).toEqual(['raining -> wet']);
    });

    test('translates If-Then with comma', async () => {
        const result = await translator.translate('If raining, then wet');
        expect(result.premises).toEqual(['raining -> wet']);
    });

    test('extracts conclusion', async () => {
        const result = await translator.translate('Socrates is a man.\nTherefore Socrates is mortal');
        expect(result.premises).toEqual(['man(socrates)']);
        expect(result.conclusion).toBe('mortal(socrates)');
    });

    test('handles multiple lines', async () => {
        const text = `
            All men are mortals.
            Socrates is a man.
            Therefore Socrates is mortal.
        `;
        const result = await translator.translate(text);
        expect(result.premises).toHaveLength(2);
        expect(result.premises).toContain('all x (man(x) -> mortal(x))');
        expect(result.premises).toContain('man(socrates)');
        expect(result.conclusion).toBe('mortal(socrates)');
    });

    test('reports errors for unparseable lines', async () => {
        const result = await translator.translate('This is nonsense 123');
        expect(result.errors).toBeDefined();
        expect(result.errors?.length).toBeGreaterThan(0);
    });
});

import { TranslationStrategy, TranslationResult } from '../types/llm.js';
import { parse } from '../parser.js';

/**
 * A rule-based translator that handles standard English logical forms.
 * This satisfies the "offline model" requirement without needing a heavy NN.
 */
export class HeuristicTranslator implements TranslationStrategy {
    async translate(text: string): Promise<TranslationResult> {
        const lines = text.split(/[.\n]+/).map(l => l.trim()).filter(l => l);
        const premises: string[] = [];
        let conclusion: string | undefined;
        const errors: string[] = [];

        for (const line of lines) {
            // Check for conclusion markers
            if (line.match(/^(therefore|thus|hence|conclusion:|prove:)/i)) {
                const cleanLine = line.replace(/^(therefore|thus|hence|conclusion:|prove:)\s*/i, '');
                const form = this.parseSentence(cleanLine);
                if (form) {
                    conclusion = form;
                } else {
                    errors.push(`Could not translate conclusion: "${cleanLine}"`);
                }
                continue;
            }

            // Otherwise treat as premise
            const form = this.parseSentence(line);
            if (form) {
                premises.push(form);
            } else {
                errors.push(`Could not translate premise: "${line}"`);
            }
        }

        return { premises, conclusion, errors: errors.length > 0 ? errors : undefined };
    }

    private parseSentence(sentence: string): string | null {
        const s = sentence.toLowerCase().replace(/[^\w\s\(\),]/g, '');

        // 1. "Socrates is a man" -> man(socrates)
        // Regex: X is a Y
        const isA = s.match(/^(\w+) is a (\w+)$/);
        if (isA) {
            return `${isA[2]}(${isA[1]})`;
        }

        // 1b. "Socrates is mortal" -> mortal(socrates)
        const isAdj = s.match(/^(\w+) is (\w+)$/);
        if (isAdj) {
            return `${isAdj[2]}(${isAdj[1]})`;
        }

        // 2. "All men are mortal" -> all x (man(x) -> mortal(x))
        const allAre = s.match(/^all (\w+) are (\w+)$/);
        if (allAre) {
            const sub = this.singularize(allAre[1]);
            const pred = this.singularize(allAre[2]);
            return `all x (${sub}(x) -> ${pred}(x))`;
        }

        // 3. "Some men are mortal" -> exists x (man(x) & mortal(x))
        const someAre = s.match(/^some (\w+) are (\w+)$/);
        if (someAre) {
            const sub = this.singularize(someAre[1]);
            const pred = this.singularize(someAre[2]);
            return `exists x (${sub}(x) & ${pred}(x))`;
        }

        // 4. "No men are mortal" -> all x (man(x) -> -mortal(x))
        const noAre = s.match(/^no (\w+) are (\w+)$/);
        if (noAre) {
            const sub = this.singularize(noAre[1]);
            const pred = this.singularize(noAre[2]);
            return `all x (${sub}(x) -> -${pred}(x))`;
        }

        // 5. "If X then Y" (propositional/simple)
        // Handling variables is hard with regex, assuming propositional or 0-arity
        // "If raining then wet" -> raining -> wet
        const ifThen = s.match(/^if (.+) then (.+)$/);
        if (ifThen) {
            // Recursive? Too complex for regex.
            // Let's just handle simple atoms
            const p = ifThen[1].trim().replace(/\s+/g, '_');
            const q = ifThen[2].trim().replace(/\s+/g, '_');
            return `${p} -> ${q}`;
        }

        // 6. Simple atoms "It is raining" -> raining
        // "John loves Mary" -> loves(john, mary)
        const transitive = s.match(/^(\w+) (\w+s) (\w+)$/);
        if (transitive) {
            // loves -> love
            const rel = transitive[2].replace(/s$/, '');
            return `${rel}(${transitive[1]}, ${transitive[3]})`;
        }

        return null;
    }

    private singularize(word: string): string {
        // Handle common irregularities or just strip 's'
        // 'men' -> 'man'
        if (word === 'men') return 'man';
        if (word === 'women') return 'woman';
        if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
        return word;
    }
}

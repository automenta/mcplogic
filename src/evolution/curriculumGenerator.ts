import type { EvaluationCase } from '../types/evolution.js';
import type { LLMProvider } from '../types/llm.js';
import type { IPerformanceDatabase } from './storage.js';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

/**
 * Generates new evaluation cases to improve test coverage.
 */
export class CurriculumGenerator {
    private llm: LLMProvider;
    private db: IPerformanceDatabase;
    private outputDir: string;

    constructor(llm: LLMProvider, db: IPerformanceDatabase, outputDir: string) {
        this.llm = llm;
        this.db = db;
        this.outputDir = outputDir;
    }

    /**
     * Analyzes performance data and generates new test cases targeting weaknesses.
     */
    async generateNewCases(domain: string, count: number = 5): Promise<EvaluationCase[]> {
        // 1. Analyze weaknesses (placeholder)
        // ideally, look at DB for clusters of failures.
        // For now, simply ask LLM to generate tricky cases for the domain.

        const prompt = `Generate ${count} difficult test cases for translating Natural Language to First-Order Logic (FOL) in the domain of "${domain}".

        Focus on complex sentence structures, negations, and quantifiers.

        Return a JSON array of objects with this structure:
        {
           "input": "Natural language sentence",
           "expected": ["FOL formula 1", "FOL formula 2"],
           "type": "premise" (or "goal")
        }

        Return ONLY the JSON array.
        `;

        const response = await this.llm.complete([
            { role: 'user', content: prompt }
        ]);

        const cases = this.parseResponse(response.content);

        // Save to disk
        this.saveCases(cases, domain);

        return cases;
    }

    private parseResponse(content: string): EvaluationCase[] {
        try {
            // Basic JSON extraction
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) return [];

            const rawCases = JSON.parse(jsonMatch[0]);

            return rawCases.map((c: any) => ({
                id: randomUUID(),
                input: c.input,
                expected: c.expected,
                type: c.type || 'premise'
            }));
        } catch (e) {
            console.error("Failed to parse generated cases:", e);
            return [];
        }
    }

    private saveCases(cases: EvaluationCase[], domain: string) {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
        const filename = path.join(this.outputDir, `${domain}_generated_${Date.now()}.json`);
        fs.writeFileSync(filename, JSON.stringify(cases, null, 2));
    }
}

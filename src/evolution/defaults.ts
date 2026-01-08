import { EvolutionStrategy } from '../types/evolution.js';

export const HEURISTIC_STRATEGY: EvolutionStrategy = {
    id: 'heuristic-v1',
    description: 'Standard heuristic strategy (Regex-based)',
    promptTemplate: 'Translate the following to FOL:\n{{INPUT}}', // Unused for heuristic but required by type
    parameters: {},
    metadata: { successRate: 0, inferenceCount: 0, generation: 0 }
};

export const LLM_STRATEGY: EvolutionStrategy = {
    id: 'llm-default',
    description: 'LLM-based translation strategy',
    promptTemplate: `You are an expert in First-Order Logic (FOL).
Translate the following natural language text into First-Order Logic formulas using Prover9 syntax.

Syntax Rules:
- Quantifiers: 'all x', 'exists x'
- Operators: '&' (and), '|' (or), '->' (implies), '<->' (iff), '-' (not)
- Predicates: Lowercase start, e.g., 'man(x)', 'mortal(x)'
- Constants: Lowercase start, e.g., 'socrates'
- Variables: Single lowercase letters (x, y, z...) are free variables (implicitly universal) unless bound.
- Equality: '='

Output Format:
- Provide ONLY the list of formulas.
- Do not wrap in code blocks if possible, or use \`\`\`prolog or \`\`\`text.
- Separate formulas by newlines.
- If there is a clear conclusion/goal to prove, prefix it with "conclusion:".

Input:
{{INPUT}}
`,
    parameters: {},
    metadata: { successRate: 0, inferenceCount: 0, generation: 0 }
};

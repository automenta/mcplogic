/**
 * MCP Prompts - Reasoning Templates
 * 
 * Pre-built reasoning patterns as prompt templates for the MCP protocol.
 */

/**
 * Prompt argument definition
 */
export interface PromptArgument {
    name: string;
    description: string;
    required: boolean;
}

/**
 * Prompt definition
 */
export interface Prompt {
    name: string;
    description: string;
    arguments: PromptArgument[];
}

/**
 * Prompt message (for GetPrompt response)
 */
export interface PromptMessage {
    role: 'user' | 'assistant';
    content: {
        type: 'text';
        text: string;
    };
}

/**
 * GetPrompt response
 */
export interface GetPromptResult {
    description: string;
    messages: PromptMessage[];
}

/**
 * All available prompts
 */
export const PROMPTS: Prompt[] = [
    {
        name: 'prove-by-contradiction',
        description: 'Set up an indirect proof by assuming the negation of the statement',
        arguments: [
            { name: 'statement', description: 'The statement to prove', required: true },
        ],
    },
    {
        name: 'verify-equivalence',
        description: 'Prove logical equivalence A ↔ B by showing both directions',
        arguments: [
            { name: 'formula_a', description: 'First formula', required: true },
            { name: 'formula_b', description: 'Second formula', required: true },
        ],
    },
    {
        name: 'formalize',
        description: 'Guide natural language to first-order logic translation',
        arguments: [
            { name: 'natural_language', description: 'The statement to formalize', required: true },
            { name: 'domain_hint', description: 'Optional domain context (e.g., "mathematics", "law")', required: false },
        ],
    },
    {
        name: 'diagnose-unsat',
        description: 'Find a minimal unsatisfiable subset of premises',
        arguments: [
            { name: 'premises', description: 'JSON array of premises to analyze', required: true },
        ],
    },
    {
        name: 'explain-proof',
        description: 'Generate a human-readable explanation of a proof',
        arguments: [
            { name: 'premises', description: 'JSON array of premises', required: true },
            { name: 'conclusion', description: 'The conclusion that was proved', required: true },
        ],
    },
];

/**
 * Render a prompt template with arguments
 */
export function getPrompt(name: string, args: Record<string, string>): GetPromptResult | null {
    switch (name) {
        case 'prove-by-contradiction':
            return renderProveByContradiction(args['statement'] || '');
        case 'verify-equivalence':
            return renderVerifyEquivalence(args['formula_a'] || '', args['formula_b'] || '');
        case 'formalize':
            return renderFormalize(args['natural_language'] || '', args['domain_hint']);
        case 'diagnose-unsat':
            return renderDiagnoseUnsat(args['premises'] || '[]');
        case 'explain-proof':
            return renderExplainProof(args['premises'] || '[]', args['conclusion'] || '');
        default:
            return null;
    }
}

function renderProveByContradiction(statement: string): GetPromptResult {
    return {
        description: 'Proof by contradiction setup',
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `To prove "${statement}" by contradiction:

1. Assume the negation: -(${statement})
2. Add this negation to your premises
3. Derive a contradiction (prove "false" or "P & -P")
4. Conclude the original statement holds

Suggested tool call:
{
  "name": "prove",
  "arguments": {
    "premises": ["your_axioms...", "-(${statement})"],
    "conclusion": "false"
  }
}

If you find a contradiction, then "${statement}" is proved.`,
                },
            },
        ],
    };
}

function renderVerifyEquivalence(formulaA: string, formulaB: string): GetPromptResult {
    return {
        description: 'Equivalence verification',
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `To prove "${formulaA}" ↔ "${formulaB}":

You must prove BOTH directions:

**Direction 1: ${formulaA} → ${formulaB}**
{
  "name": "prove",
  "arguments": {
    "premises": ["${formulaA}"],
    "conclusion": "${formulaB}"
  }
}

**Direction 2: ${formulaB} → ${formulaA}**
{
  "name": "prove",
  "arguments": {
    "premises": ["${formulaB}"],
    "conclusion": "${formulaA}"
  }
}

If both directions succeed, the equivalence holds.`,
                },
            },
        ],
    };
}

function renderFormalize(naturalLanguage: string, domainHint?: string): GetPromptResult {
    const domainContext = domainHint
        ? `\n\n**Domain context:** ${domainHint}`
        : '';

    return {
        description: 'Natural language to FOL translation guide',
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `Formalize this statement in first-order logic:

"${naturalLanguage}"${domainContext}

**Translation guidelines:**

1. **Identify predicates:** What properties/relations are mentioned?
   - Unary predicates: P(x) for "x is P"
   - Binary predicates: R(x,y) for "x is R to y"

2. **Identify quantifiers:**
   - "All/Every/Each" → all x (...)
   - "Some/There exists" → exists x (...)
   - "No/None" → all x (P(x) -> -Q(x))

3. **Identify connectives:**
   - "and" → &
   - "or" → |
   - "if...then" / "implies" → ->
   - "if and only if" → <->
   - "not" → -

4. **Use lowercase** for predicates and constants

**Example:**
"All men are mortal" → all x (man(x) -> mortal(x))

Provide your formalization in FOL syntax, then verify with:
{
  "name": "check-well-formed",
  "arguments": { "statements": ["your_formula"] }
}`,
                },
            },
        ],
    };
}

function renderDiagnoseUnsat(premisesJson: string): GetPromptResult {
    return {
        description: 'Unsatisfiable premise diagnosis',
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `Diagnose unsatisfiability in these premises:

${premisesJson}

**Strategy to find minimal unsatisfiable subset:**

1. First, verify the full set is unsatisfiable:
{
  "name": "find-model",
  "arguments": { "premises": ${premisesJson} }
}

2. If no model found, use binary search:
   - Split premises in half
   - Test each half for satisfiability
   - The unsatisfiable half contains the conflict
   - Repeat until minimal subset found

3. Common conflict patterns:
   - Direct contradiction: P(a) and -P(a)
   - Implicit contradiction: all x P(x) with exists x -P(x)
   - Unsatisfiable chain: P->Q, Q->R, R->-P with P

Report the minimal unsatisfiable core when found.`,
                },
            },
        ],
    };
}

function renderExplainProof(premisesJson: string, conclusion: string): GetPromptResult {
    return {
        description: 'Proof explanation',
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `Explain the proof of "${conclusion}" from:

${premisesJson}

**To generate an explanation:**

1. First verify the proof exists:
{
  "name": "prove",
  "arguments": {
    "premises": ${premisesJson},
    "conclusion": "${conclusion}",
    "verbosity": "detailed"
  }
}

2. Use the detailed response to trace the reasoning:
   - What premises were used directly?
   - What intermediate conclusions were derived?
   - How did quantifiers get instantiated?

3. Structure your explanation as:
   - State the goal
   - List relevant premises
   - Show the logical chain step by step
   - Conclude with the result

**Example explanation:**
"We want to prove mortal(socrates).
From premise (1): man(socrates)
From premise (2): all x (man(x) -> mortal(x))
Instantiating x=socrates: man(socrates) -> mortal(socrates)
By modus ponens with (1): mortal(socrates) ✓"`,
                },
            },
        ],
    };
}

/**
 * List all prompts
 */
export function listPrompts(): Prompt[] {
    return PROMPTS;
}

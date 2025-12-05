/**
 * MCP Logic Server
 * 
 * MCP server providing 6 tools for first-order logic reasoning.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { LogicEngine, createLogicEngine } from './logicEngine.js';
import { validateFormulas } from './syntaxValidator.js';
import { CategoricalHelpers, monoidAxioms, groupAxioms } from './categoricalHelpers.js';
import { ModelFinder, createModelFinder } from './modelFinder.js';

/**
 * Create and configure the MCP server
 */
export function createServer(): Server {
    const server = new Server(
        {
            name: 'mcp-logic',
            version: '1.0.0',
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    // Initialize engines
    const logicEngine = createLogicEngine();
    const modelFinder = createModelFinder();
    const categoricalHelpers = new CategoricalHelpers();

    // Define available tools with enhanced descriptions (TODO 1.3) and configuration parameters (TODO 1.4)
    const tools: Tool[] = [
        {
            name: 'prove',
            description: `Prove a logical statement using resolution.

**When to use:** You have premises and want to verify a conclusion follows logically.
**When NOT to use:** You want to find counterexamples (use find-counterexample instead).

**Example:**
  premises: ["all x (man(x) -> mortal(x))", "man(socrates)"]
  conclusion: "mortal(socrates)"
  → Returns: { success: true, result: "proved" }

**Common issues:**
- "No proof found" often means inference limit reached, not that the theorem is false
- Try increasing inference_limit for complex proofs`,
            inputSchema: {
                type: 'object',
                properties: {
                    premises: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of logical premises in FOL syntax',
                    },
                    conclusion: {
                        type: 'string',
                        description: 'Statement to prove',
                    },
                    inference_limit: {
                        type: 'integer',
                        description: 'Max inference steps before giving up (default: 1000). Increase for complex proofs.',
                    },
                },
                required: ['premises', 'conclusion'],
            },
        },
        {
            name: 'check-well-formed',
            description: `Check if logical statements are well-formed with detailed syntax validation.

**When to use:** Before calling prove/find-model to catch syntax errors early.
**When NOT to use:** You already know the formula syntax is correct.

**Example:**
  statements: ["all x (P(x) -> Q(x))"]
  → Returns: { valid: true, statements: [...] }

**Common syntax issues:**
- Use lowercase for predicates/functions: man(x), not Man(x)
- Quantifiers: "all x (...)" or "exists x (...)"
- Operators: -> (implies), & (and), | (or), - (not), <-> (iff)`,
            inputSchema: {
                type: 'object',
                properties: {
                    statements: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Logical statements to check',
                    },
                },
                required: ['statements'],
            },
        },
        {
            name: 'find-model',
            description: `Find a finite model satisfying the given premises.

**When to use:** You want to show premises are satisfiable (have at least one model).
**When NOT to use:** You want to prove a conclusion follows (use prove instead).

**Example:**
  premises: ["exists x P(x)", "all x (P(x) -> Q(x))"]
  → Returns: { success: true, model: { domain: [0], predicates: {...} } }

**Performance notes:**
- Searches domains size 2 through max_domain_size (default: 10)
- Larger domains take exponentially longer
- Use domain_size to search a specific size only`,
            inputSchema: {
                type: 'object',
                properties: {
                    premises: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of logical premises',
                    },
                    domain_size: {
                        type: 'integer',
                        description: 'Specific domain size to search (skips incremental search)',
                    },
                    max_domain_size: {
                        type: 'integer',
                        description: 'Maximum domain size to try (default: 10). Larger values may timeout.',
                    },
                },
                required: ['premises'],
            },
        },
        {
            name: 'find-counterexample',
            description: `Find a counterexample showing the conclusion doesn't follow from premises.

**When to use:** You suspect a conclusion doesn't logically follow and want proof.
**When NOT to use:** You want to prove the conclusion (use prove instead).

**Example:**
  premises: ["P(a)"]
  conclusion: "P(b)"
  → Returns counterexample where P(a)=true but P(b)=false

**How it works:** Searches for a model satisfying premises ∧ ¬conclusion.
If found, proves the conclusion doesn't logically follow.`,
            inputSchema: {
                type: 'object',
                properties: {
                    premises: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of logical premises',
                    },
                    conclusion: {
                        type: 'string',
                        description: 'Conclusion to disprove',
                    },
                    domain_size: {
                        type: 'integer',
                        description: 'Specific domain size to search',
                    },
                    max_domain_size: {
                        type: 'integer',
                        description: 'Maximum domain size to try (default: 10)',
                    },
                },
                required: ['premises', 'conclusion'],
            },
        },
        {
            name: 'verify-commutativity',
            description: `Verify that a categorical diagram commutes by generating FOL premises and conclusion.

**When to use:** You have a categorical diagram and want to verify path equality.
**When NOT to use:** For non-categorical reasoning (use prove directly).

**Example:**
  path_a: ["f", "g"], path_b: ["h"]
  object_start: "A", object_end: "C"
  → Generates premises/conclusion for proving compose(f,g) = h

**Output:** Returns premises and conclusion to pass to the prove tool.`,
            inputSchema: {
                type: 'object',
                properties: {
                    path_a: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of morphism names in first path',
                    },
                    path_b: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of morphism names in second path',
                    },
                    object_start: {
                        type: 'string',
                        description: 'Starting object',
                    },
                    object_end: {
                        type: 'string',
                        description: 'Ending object',
                    },
                    with_category_axioms: {
                        type: 'boolean',
                        description: 'Include basic category theory axioms (default: true)',
                    },
                },
                required: ['path_a', 'path_b', 'object_start', 'object_end'],
            },
        },
        {
            name: 'get-category-axioms',
            description: `Get FOL axioms for category theory concepts.

**Available concepts:**
- category: Composition, identity, associativity axioms
- functor: Preserves composition and identity
- natural-transformation: Naturality condition
- monoid: Binary operation with identity and associativity
- group: Monoid with inverses

**Example:**
  concept: "monoid"
  → Returns axioms for monoid structure`,
            inputSchema: {
                type: 'object',
                properties: {
                    concept: {
                        type: 'string',
                        enum: ['category', 'functor', 'natural-transformation', 'monoid', 'group'],
                        description: "Which concept's axioms to retrieve",
                    },
                    functor_name: {
                        type: 'string',
                        description: 'For functor axioms: name of the functor (default: F)',
                    },
                },
                required: ['concept'],
            },
        },
    ];

    // Handle list_tools request
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools };
    });

    // Handle call_tool request
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        try {
            let result: object;

            switch (name) {
                case 'prove': {
                    const { premises, conclusion, inference_limit } = args as {
                        premises: string[];
                        conclusion: string;
                        inference_limit?: number;
                    };

                    // Validate syntax first
                    const allFormulas = [...premises, conclusion];
                    const validation = validateFormulas(allFormulas);

                    if (!validation.valid) {
                        result = { result: 'syntax_error', validation };
                        break;
                    }

                    // Create engine with custom inference limit if specified
                    const engine = inference_limit ? createLogicEngine(undefined, inference_limit) : logicEngine;
                    const proveResult = await engine.prove(premises, conclusion);
                    result = proveResult;
                    break;
                }

                case 'check-well-formed': {
                    const { statements } = args as { statements: string[] };
                    result = validateFormulas(statements);
                    break;
                }

                case 'find-model': {
                    const { premises, domain_size, max_domain_size } = args as {
                        premises: string[];
                        domain_size?: number;
                        max_domain_size?: number;
                    };
                    // Create finder with custom max domain size if specified
                    const finder = max_domain_size ? createModelFinder(undefined, max_domain_size) : modelFinder;
                    result = await finder.findModel(premises, domain_size);
                    break;
                }

                case 'find-counterexample': {
                    const { premises, conclusion, domain_size, max_domain_size } = args as {
                        premises: string[];
                        conclusion: string;
                        domain_size?: number;
                        max_domain_size?: number;
                    };
                    // Create finder with custom max domain size if specified
                    const finder = max_domain_size ? createModelFinder(undefined, max_domain_size) : modelFinder;
                    result = await finder.findCounterexample(premises, conclusion, domain_size);
                    break;
                }

                case 'verify-commutativity': {
                    const { path_a, path_b, object_start, object_end, with_category_axioms = true } = args as {
                        path_a: string[];
                        path_b: string[];
                        object_start: string;
                        object_end: string;
                        with_category_axioms?: boolean;
                    };

                    const { premises, conclusion } = categoricalHelpers.verifyCommutativity(
                        path_a,
                        path_b,
                        object_start,
                        object_end
                    );

                    let allPremises = premises;
                    if (with_category_axioms) {
                        allPremises = [...categoricalHelpers.categoryAxioms(), ...premises];
                    }

                    result = {
                        premises: allPremises,
                        conclusion,
                        note: "Use the 'prove' tool with these premises and conclusion to verify commutativity",
                    };
                    break;
                }

                case 'get-category-axioms': {
                    const { concept, functor_name = 'F' } = args as {
                        concept: string;
                        functor_name?: string;
                    };

                    let axioms: string[];

                    switch (concept) {
                        case 'category':
                            axioms = categoricalHelpers.categoryAxioms();
                            break;
                        case 'functor':
                            axioms = categoricalHelpers.functorAxioms(functor_name);
                            break;
                        case 'natural-transformation':
                            axioms = categoricalHelpers.naturalTransformationCondition();
                            break;
                        case 'monoid':
                            axioms = monoidAxioms();
                            break;
                        case 'group':
                            axioms = groupAxioms();
                            break;
                        default:
                            axioms = [];
                    }

                    result = { concept, axioms };
                    break;
                }

                default:
                    throw new Error(`Unknown tool: ${name}`);
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            error: errorMessage,
                            type: error instanceof Error ? error.constructor.name : 'Error',
                        }),
                    },
                ],
                isError: true,
            };
        }
    });

    return server;
}

/**
 * Run the MCP server
 */
export async function runServer(): Promise<void> {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Keep the server running
    await new Promise(() => { });
}

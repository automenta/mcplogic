/**
 * MCP Logic Server
 * 
 * MCP server providing tools for first-order logic reasoning.
 * Includes: prove, check-well-formed, find-model, find-counterexample,
 * verify-commutativity, get-category-axioms, and session management tools.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
    Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { listResources, getResourceContent } from './resources/index.js';
import { listPrompts, getPrompt } from './prompts/index.js';

// LogicEngine is now accessed via EngineManager
import { CategoricalHelpers } from './axioms/categorical.js';
import { createModelFinder } from './modelFinder.js';
import { createSessionManager } from './sessionManager.js';
import {
    LogicException,
    createGenericError,
    serializeLogicError,
    Verbosity,
} from './types/index.js';
import { createEngineManager, EngineSelection } from './engines/manager.js';
import * as Handlers from './handlers/index.js';
import * as LLMHandlers from './handlers/llm.js';

/**
 * Verbosity parameter schema for tools
 */
const verbositySchema = {
    type: 'string',
    enum: ['minimal', 'standard', 'detailed'],
    description: "Response verbosity: 'minimal' (token-efficient), 'standard' (default), 'detailed' (debug info)",
};

/**
 * Create and configure the MCP server
 */
export function createServer(): Server {
    const server = new Server(
        {
            name: 'mcp-logic',
            version: '1.1.0',
        },
        {
            capabilities: {
                tools: {},
                resources: {},
                prompts: {},
            },
        }
    );

    // Initialize engines and managers
    const modelFinder = createModelFinder();
    const categoricalHelpers = new CategoricalHelpers();
    const sessionManager = createSessionManager();
    const engineManager = createEngineManager();

    // Define available tools
    const tools: Tool[] = [
        // ==================== CORE REASONING TOOLS ====================
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
                    enable_arithmetic: {
                        type: 'boolean',
                        description: 'Enable arithmetic predicates (lt, gt, plus, minus, times, etc.). Default: false.',
                    },
                    enable_equality: {
                        type: 'boolean',
                        description: 'Auto-inject equality axioms (reflexivity, symmetry, transitivity, congruence). Default: false.',
                    },
                    highPower: {
                        type: 'boolean',
                        description: 'Enable extended limits (300s timeout, 100k inferences). Use for complex proofs.',
                    },
                    engine: {
                        type: 'string',
                        enum: ['prolog', 'sat', 'auto'],
                        description: "Reasoning engine: 'prolog' (Horn clauses), 'sat' (general FOL), 'auto' (select based on formula). Default: 'auto'.",
                    },
                    strategy: {
                        type: 'string',
                        enum: ['auto', 'iterative'],
                        description: "Search strategy: 'iterative' progressively increases inference limits (good for unknown complexity). Default: 'auto'.",
                    },
                    include_trace: {
                        type: 'boolean',
                        description: 'Include step-by-step inference trace in the output. Default: false.',
                    },
                    verbosity: verbositySchema,
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
                    verbosity: verbositySchema,
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
                    use_sat: {
                        type: ['boolean', 'string'],
                        enum: [true, false, 'auto'],
                        description: "Use SAT solver backend (recommended for domains > 10). Default: 'auto'.",
                    },
                    enable_symmetry: {
                        type: 'boolean',
                        description: 'Enable symmetry breaking optimization (reduces isomorphic models). Default: true.',
                    },
                    count: {
                        type: 'integer',
                        description: 'Number of non-isomorphic models to find (default: 1).',
                    },
                    verbosity: verbositySchema,
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
                    use_sat: {
                        type: ['boolean', 'string'],
                        enum: [true, false, 'auto'],
                        description: "Use SAT solver backend. Default: 'auto'.",
                    },
                    enable_symmetry: {
                        type: 'boolean',
                        description: 'Enable symmetry breaking optimization. Default: true.',
                    },
                    verbosity: verbositySchema,
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
                    verbosity: verbositySchema,
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
                    verbosity: verbositySchema,
                },
                required: ['concept'],
            },
        },

        // ==================== LLM TOOLS ====================
        {
            name: 'translate-text',
            description: `Translate natural language to First-Order Logic (FOL).

**When to use:** Converting user input into logical formulas.
**Features:**
- Handles basic standard English forms ("All X are Y", "A is B", "If P then Q")
- Works offline (heuristic-based)
- Validates generated formulas`,
            inputSchema: {
                type: 'object',
                properties: {
                    text: {
                        type: 'string',
                        description: 'Natural language text to translate',
                    },
                    validate: {
                        type: 'boolean',
                        description: 'Validate generated formulas (default: true)',
                    },
                },
                required: ['text'],
            },
        },

        // ==================== SESSION MANAGEMENT TOOLS ====================
        {
            name: 'create-session',
            description: `Create a new reasoning session for incremental knowledge base construction.

**When to use:** You want to build up premises incrementally and query multiple times.
**When NOT to use:** Single query with all premises known upfront (use prove directly).

**Example:**
  ttl_minutes: 30
  → Returns: { session_id: "uuid...", expires_at: ... }

**Notes:**
- Sessions auto-expire after TTL (default: 30 minutes)
- Maximum 1000 concurrent sessions
- Session ID must be passed to all session operations`,
            inputSchema: {
                type: 'object',
                properties: {
                    ttl_minutes: {
                        type: 'integer',
                        description: 'Session time-to-live in minutes (default: 30, max: 1440)',
                    },
                    verbosity: verbositySchema,
                },
                required: [],
            },
        },
        {
            name: 'assert-premise',
            description: `Add a formula to a session's knowledge base.

**When to use:** Building up premises incrementally in a session.

**Example:**
  session_id: "abc-123..."
  formula: "all x (man(x) -> mortal(x))"
  → Adds the formula to the session KB`,
            inputSchema: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Session ID from create-session',
                    },
                    formula: {
                        type: 'string',
                        description: 'FOL formula to add to the knowledge base',
                    },
                    verbosity: verbositySchema,
                },
                required: ['session_id', 'formula'],
            },
        },
        {
            name: 'query-session',
            description: `Query the accumulated knowledge base in a session.

**When to use:** After asserting premises, query for a conclusion.

**Example:**
  session_id: "abc-123..."
  goal: "mortal(socrates)"
  → Attempts to prove the goal from accumulated premises`,
            inputSchema: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Session ID from create-session',
                    },
                    goal: {
                        type: 'string',
                        description: 'FOL formula to prove from the knowledge base',
                    },
                    inference_limit: {
                        type: 'integer',
                        description: 'Max inference steps (default: 1000)',
                    },
                    verbosity: verbositySchema,
                },
                required: ['session_id', 'goal'],
            },
        },
        {
            name: 'retract-premise',
            description: `Remove a specific premise from a session's knowledge base.

**When to use:** You need to undo an assertion or explore alternative premises.

**Example:**
  session_id: "abc-123..."
  formula: "man(plato)"
  → Removes the exact formula if found`,
            inputSchema: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Session ID from create-session',
                    },
                    formula: {
                        type: 'string',
                        description: 'Exact formula to remove (must match what was asserted)',
                    },
                    verbosity: verbositySchema,
                },
                required: ['session_id', 'formula'],
            },
        },
        {
            name: 'list-premises',
            description: `List all premises in a session's knowledge base.

**When to use:** Review what has been asserted so far.

**Example:**
  session_id: "abc-123..."
  → Returns: { premises: ["all x (man(x) -> mortal(x))", "man(socrates)"] }`,
            inputSchema: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Session ID from create-session',
                    },
                    verbosity: verbositySchema,
                },
                required: ['session_id'],
            },
        },
        {
            name: 'clear-session',
            description: `Clear all premises from a session (keeps session alive).

**When to use:** Start fresh within the same session.

**Example:**
  session_id: "abc-123..."
  → Clears all premises, session remains valid`,
            inputSchema: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Session ID from create-session',
                    },
                    verbosity: verbositySchema,
                },
                required: ['session_id'],
            },
        },
        {
            name: 'delete-session',
            description: `Delete a session entirely.

**When to use:** Done with a session, want to free resources.

**Example:**
  session_id: "abc-123..."
  → Session is deleted and ID becomes invalid`,
            inputSchema: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Session ID to delete',
                    },
                    verbosity: verbositySchema,
                },
                required: ['session_id'],
            },
        },
    ];

    // Handle list_tools request
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools };
    });

    // ==================== MCP RESOURCES HANDLERS ====================

    // Handle list_resources request
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        return {
            resources: listResources().map(r => ({
                uri: r.uri,
                name: r.name,
                description: r.description,
                mimeType: r.mimeType,
            })),
        };
    });

    // Handle read_resource request
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const { uri } = request.params;
        const content = getResourceContent(uri);

        if (content === null) {
            throw createGenericError('PARSE_ERROR', `Resource not found: ${uri}`);
        }

        return {
            contents: [
                {
                    uri,
                    mimeType: 'text/plain',
                    text: content,
                },
            ],
        };
    });

    // ==================== MCP PROMPTS HANDLERS ====================

    // Handle list_prompts request
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
        return {
            prompts: listPrompts().map(p => ({
                name: p.name,
                description: p.description,
                arguments: p.arguments,
            })),
        };
    });

    // Handle get_prompt request
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        const { name, arguments: promptArgs } = request.params;
        const result = getPrompt(name, promptArgs || {});

        if (result === null) {
            throw createGenericError('PARSE_ERROR', `Prompt not found: ${name}`);
        }

        // Return in MCP format: description + messages array
        return {
            description: result.description,
            messages: result.messages,
        };
    });

    // Handle call_tool request
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const verbosity: Verbosity = (args as any)?.verbosity || 'standard';

        try {
            let result: object;

            switch (name) {
                // ==================== CORE REASONING TOOLS ====================
                case 'prove':
                    const progressToken = (request.params as any)._meta?.progressToken;
                    const onProgress = progressToken ? (progress: number | undefined, message: string) => {
                        server.notification({
                            method: 'notifications/progress',
                            params: {
                                progressToken,
                                data: {
                                    progress,
                                    total: 1.0,
                                    message
                                }
                            }
                        });
                    } : undefined;

                    result = await Handlers.proveHandler(args as any, engineManager, verbosity, onProgress);
                    break;

                case 'check-well-formed':
                    result = Handlers.checkWellFormedHandler(args as any);
                    break;

                case 'find-model':
                    result = await Handlers.findModelHandler(args as any, modelFinder, verbosity);
                    break;

                case 'find-counterexample':
                    result = await Handlers.findCounterexampleHandler(args as any, modelFinder, verbosity);
                    break;

                case 'verify-commutativity':
                    result = Handlers.verifyCommutativityHandler(args as any, categoricalHelpers);
                    break;

                case 'get-category-axioms':
                    result = Handlers.getCategoryAxiomsHandler(args as any, categoricalHelpers);
                    break;

                case 'translate-text':
                    result = await LLMHandlers.translateTextHandler(args as any);
                    break;

                // ==================== SESSION MANAGEMENT TOOLS ====================
                case 'create-session':
                    result = Handlers.createSessionHandler(args as any, sessionManager);
                    break;

                case 'assert-premise':
                    result = Handlers.assertPremiseHandler(args as any, sessionManager);
                    break;

                case 'query-session':
                    result = await Handlers.querySessionHandler(args as any, sessionManager, engineManager, verbosity);
                    break;

                case 'retract-premise':
                    result = Handlers.retractPremiseHandler(args as any, sessionManager);
                    break;

                case 'list-premises':
                    result = Handlers.listPremisesHandler(args as any, sessionManager, verbosity);
                    break;

                case 'clear-session':
                    result = Handlers.clearSessionHandler(args as any, sessionManager);
                    break;

                case 'delete-session':
                    result = Handlers.deleteSessionHandler(args as any, sessionManager);
                    break;

                default:
                    throw createGenericError('PARSE_ERROR', `Unknown tool: ${name}`);
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
            // Handle structured LogicException
            if (error instanceof LogicException) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(serializeLogicError(error.error), null, 2),
                        },
                    ],
                    isError: true,
                };
            }

            // Handle generic errors
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

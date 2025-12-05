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
    Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { LogicEngine, createLogicEngine } from './logicEngine.js';
import { validateFormulas } from './syntaxValidator.js';
import { CategoricalHelpers, monoidAxioms, groupAxioms } from './categoricalHelpers.js';
import { ModelFinder, createModelFinder } from './modelFinder.js';
import { SessionManager, createSessionManager } from './sessionManager.js';
import {
    LogicException,
    serializeLogicError,
    Verbosity,
    ProveResult,
    ModelResult,
} from './types/index.js';

/**
 * Verbosity parameter schema for tools
 */
const verbositySchema = {
    type: 'string',
    enum: ['minimal', 'standard', 'detailed'],
    description: "Response verbosity: 'minimal' (token-efficient), 'standard' (default), 'detailed' (debug info)",
};

/**
 * Build response based on verbosity level
 */
function buildProveResponse(result: ProveResult, verbosity: Verbosity = 'standard'): object {
    if (verbosity === 'minimal') {
        return {
            success: result.success,
            result: result.result,
        };
    }

    if (verbosity === 'standard') {
        return {
            success: result.success,
            result: result.result,
            message: result.message || (result.success ? 'Proof found' : result.error || 'No proof found'),
            ...(result.bindings && { bindings: result.bindings }),
        };
    }

    // detailed
    return {
        success: result.success,
        result: result.result,
        message: result.message || (result.success ? 'Proof found' : result.error || 'No proof found'),
        ...(result.bindings && { bindings: result.bindings }),
        ...(result.prologProgram && { prologProgram: result.prologProgram }),
        ...(result.inferenceSteps && { inferenceSteps: result.inferenceSteps }),
        ...(result.statistics && { statistics: result.statistics }),
        ...(result.proof && { proof: result.proof }),
    };
}

/**
 * Build model response based on verbosity level
 */
function buildModelResponse(result: ModelResult, verbosity: Verbosity = 'standard'): object {
    // Convert model predicates to serializable format
    const serializeModel = (model: ModelResult['model']) => {
        if (!model) return undefined;
        const predicates: Record<string, string[]> = {};
        for (const [name, tuples] of model.predicates) {
            predicates[name] = Array.from(tuples);
        }
        return {
            domainSize: model.domainSize,
            domain: model.domain,
            predicates,
            constants: Object.fromEntries(model.constants),
        };
    };

    if (verbosity === 'minimal') {
        return {
            success: result.success,
            result: result.result,
            ...(result.model && {
                model: {
                    predicates: (() => {
                        const p: Record<string, string[]> = {};
                        for (const [name, tuples] of result.model.predicates) {
                            p[name] = Array.from(tuples);
                        }
                        return p;
                    })()
                }
            }),
        };
    }

    if (verbosity === 'standard') {
        return {
            success: result.success,
            result: result.result,
            message: result.message || (result.success ? 'Model found' : result.error || 'No model found'),
            ...(result.model && { model: serializeModel(result.model) }),
            ...(result.interpretation && { interpretation: result.interpretation }),
        };
    }

    // detailed
    return {
        success: result.success,
        result: result.result,
        message: result.message || (result.success ? 'Model found' : result.error || 'No model found'),
        ...(result.model && { model: serializeModel(result.model) }),
        ...(result.interpretation && { interpretation: result.interpretation }),
        ...(result.statistics && { statistics: result.statistics }),
    };
}

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
            },
        }
    );

    // Initialize engines and managers
    const logicEngine = createLogicEngine();
    const modelFinder = createModelFinder();
    const categoricalHelpers = new CategoricalHelpers();
    const sessionManager = createSessionManager();

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

    // Handle call_tool request
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const verbosity: Verbosity = (args as any)?.verbosity || 'standard';

        try {
            let result: object;

            switch (name) {
                // ==================== CORE REASONING TOOLS ====================
                case 'prove': {
                    const { premises, conclusion, inference_limit, enable_arithmetic, enable_equality } = args as {
                        premises: string[];
                        conclusion: string;
                        inference_limit?: number;
                        enable_arithmetic?: boolean;
                        enable_equality?: boolean;
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
                    const proveResult = await engine.prove(premises, conclusion, {
                        verbosity,
                        enableArithmetic: enable_arithmetic,
                        enableEquality: enable_equality,
                    });
                    result = buildProveResponse(proveResult, verbosity);
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
                    const modelResult = await finder.findModel(premises, domain_size);
                    result = buildModelResponse(modelResult, verbosity);
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
                    const modelResult = await finder.findCounterexample(premises, conclusion, domain_size);
                    result = buildModelResponse(modelResult, verbosity);
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

                // ==================== SESSION MANAGEMENT TOOLS ====================
                case 'create-session': {
                    const { ttl_minutes } = args as { ttl_minutes?: number };
                    const ttlMs = ttl_minutes
                        ? Math.min(ttl_minutes, 1440) * 60 * 1000  // Max 24 hours
                        : undefined;

                    const session = sessionManager.create({ ttlMs });
                    const info = sessionManager.getInfo(session.id);

                    result = {
                        session_id: session.id,
                        created_at: new Date(info.createdAt).toISOString(),
                        expires_at: new Date(info.expiresAt).toISOString(),
                        ttl_minutes: Math.round(info.ttlMs / 60000),
                        active_sessions: sessionManager.count,
                    };
                    break;
                }

                case 'assert-premise': {
                    const { session_id, formula } = args as {
                        session_id: string;
                        formula: string;
                    };

                    // Validate formula syntax first
                    const validation = validateFormulas([formula]);
                    if (!validation.valid) {
                        result = {
                            success: false,
                            result: 'syntax_error',
                            validation,
                        };
                        break;
                    }

                    const session = sessionManager.assertPremise(session_id, formula);
                    result = {
                        success: true,
                        session_id: session.id,
                        premise_count: session.premises.length,
                        formula_added: formula,
                    };
                    break;
                }

                case 'query-session': {
                    const { session_id, goal, inference_limit } = args as {
                        session_id: string;
                        goal: string;
                        inference_limit?: number;
                    };

                    // Validate goal syntax
                    const validation = validateFormulas([goal]);
                    if (!validation.valid) {
                        result = { result: 'syntax_error', validation };
                        break;
                    }

                    const session = sessionManager.get(session_id);
                    const engine = inference_limit
                        ? createLogicEngine(undefined, inference_limit)
                        : logicEngine;

                    const proveResult = await engine.prove(session.premises, goal, { verbosity });
                    result = {
                        session_id: session.id,
                        premise_count: session.premises.length,
                        ...buildProveResponse(proveResult, verbosity),
                    };
                    break;
                }

                case 'retract-premise': {
                    const { session_id, formula } = args as {
                        session_id: string;
                        formula: string;
                    };

                    const removed = sessionManager.retractPremise(session_id, formula);
                    const session = sessionManager.get(session_id);

                    result = {
                        success: removed,
                        session_id: session.id,
                        premise_count: session.premises.length,
                        message: removed
                            ? `Removed: ${formula}`
                            : `Formula not found in session: ${formula}`,
                    };
                    break;
                }

                case 'list-premises': {
                    const { session_id } = args as { session_id: string };

                    const premises = sessionManager.listPremises(session_id);
                    const info = sessionManager.getInfo(session_id);

                    result = {
                        session_id,
                        premise_count: premises.length,
                        premises,
                        ...(verbosity === 'detailed' && {
                            created_at: new Date(info.createdAt).toISOString(),
                            expires_at: new Date(info.expiresAt).toISOString(),
                        }),
                    };
                    break;
                }

                case 'clear-session': {
                    const { session_id } = args as { session_id: string };

                    const session = sessionManager.clear(session_id);

                    result = {
                        success: true,
                        session_id: session.id,
                        message: 'Session cleared',
                        premise_count: 0,
                    };
                    break;
                }

                case 'delete-session': {
                    const { session_id } = args as { session_id: string };

                    sessionManager.delete(session_id);

                    result = {
                        success: true,
                        message: `Session ${session_id} deleted`,
                        active_sessions: sessionManager.count,
                    };
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

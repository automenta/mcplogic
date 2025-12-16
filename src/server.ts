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
import * as AgentHandlers from './handlers/agent.js';
import * as EvolutionHandlers from './handlers/evolution.js';
import { Optimizer, Evaluator, StrategyEvolver, CurriculumGenerator, JsonPerformanceDatabase } from './evolution/index.js';
import { StandardLLMProvider } from './llm/provider.js';
import { TOOLS } from './tools/definitions.js';

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

    // Initialize Evolution Engine components
    const llmProvider = new StandardLLMProvider();
    const perfDb = new JsonPerformanceDatabase();
    const evaluator = new Evaluator(perfDb, llmProvider);
    const evolver = new StrategyEvolver(llmProvider, perfDb);
    const curriculumGenerator = new CurriculumGenerator(llmProvider, perfDb, 'src/evalCases/generated');

    // Initial Strategy (Heuristic/Placeholder)
    const initialStrategies = [{
        id: 'heuristic-v1',
        description: 'Standard heuristic strategy',
        promptTemplate: 'Translate the following to FOL:\n{{INPUT}}',
        parameters: {},
        metadata: { successRate: 0, inferenceCount: 0, generation: 0 }
    }];

    const optimizer = new Optimizer(perfDb, evolver, evaluator, {
        populationSize: 5,
        generations: 3,
        mutationRate: 0.3,
        elitismCount: 1,
        evalCasesPath: 'src/evalCases'
    });

    EvolutionHandlers.initializeEvolution(optimizer, perfDb, curriculumGenerator, initialStrategies);

    // Handle list_tools request
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools: TOOLS };
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

                case 'agent-reason':
                    result = await AgentHandlers.reasonHandler(args as any);
                    break;

                // ==================== EVOLUTION TOOLS ====================
                case 'evolution-start':
                    result = await EvolutionHandlers.startEvolutionHandler(args as any);
                    break;
                case 'evolution-list-strategies':
                    result = await EvolutionHandlers.listStrategiesHandler(args as any);
                    break;
                case 'evolution-generate-cases':
                    result = await EvolutionHandlers.generateCasesHandler(args as any);
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

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
import { createEngineManager } from './engines/manager.js';
import * as Handlers from './handlers/index.js';
import { tools } from './tools/definitions.js';

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

    // Map tool names to handlers
    const toolHandlers: Record<string, (args: any, verbosity: Verbosity) => Promise<any> | any> = {
        'prove': (args, verbosity) => Handlers.proveHandler(args, engineManager, verbosity),
        'check-well-formed': (args) => Handlers.checkWellFormedHandler(args),
        'find-model': (args, verbosity) => Handlers.findModelHandler(args, modelFinder, verbosity),
        'find-counterexample': (args, verbosity) => Handlers.findCounterexampleHandler(args, modelFinder, verbosity),
        'verify-commutativity': (args) => Handlers.verifyCommutativityHandler(args, categoricalHelpers),
        'get-category-axioms': (args) => Handlers.getCategoryAxiomsHandler(args, categoricalHelpers),
        'create-session': (args) => Handlers.createSessionHandler(args, sessionManager),
        'assert-premise': (args) => Handlers.assertPremiseHandler(args, sessionManager),
        'query-session': (args, verbosity) => Handlers.querySessionHandler(args, sessionManager, engineManager, verbosity),
        'retract-premise': (args) => Handlers.retractPremiseHandler(args, sessionManager),
        'list-premises': (args, verbosity) => Handlers.listPremisesHandler(args, sessionManager, verbosity),
        'clear-session': (args) => Handlers.clearSessionHandler(args, sessionManager),
        'delete-session': (args) => Handlers.deleteSessionHandler(args, sessionManager),
    };

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
            const handler = toolHandlers[name];

            if (!handler) {
                throw createGenericError('PARSE_ERROR', `Unknown tool: ${name}`);
            }

            const result = await handler(args, verbosity);

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

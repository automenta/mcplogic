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

import {
    LogicException,
    createGenericError,
    serializeLogicError,
} from './types/index.js';
import * as Handlers from './handlers/index.js';
import * as LLMHandlers from './handlers/llm.js';
import * as AgentHandlers from './handlers/agent.js';
import * as EvolutionHandlers from './handlers/evolution.js';
import { TOOLS } from './tools/definitions.js';
import { createContainer, ServerContainer } from './container.js';

type ToolHandler = (
    args: any,
    container: ServerContainer,
    options?: { onProgress?: (p: number | undefined, m: string) => void }
) => Promise<any> | any;

const toolHandlers: Record<string, ToolHandler> = {
    // ==================== CORE REASONING TOOLS ====================
    'prove': (args, c, opts) =>
        Handlers.proveHandler(args, c.engineManager, args.verbosity, opts?.onProgress),

    'check-well-formed': (args) =>
        Handlers.checkWellFormedHandler(args),

    'find-model': (args, c) =>
        Handlers.findModelHandler(args, c.modelFinder, args.verbosity),

    'find-counterexample': (args, c) =>
        Handlers.findCounterexampleHandler(args, c.modelFinder, args.verbosity),

    'verify-commutativity': (args, c) =>
        Handlers.verifyCommutativityHandler(args, c.categoricalHelpers),

    'get-category-axioms': (args, c) =>
        Handlers.getCategoryAxiomsHandler(args, c.categoricalHelpers),

    'translate-text': (args) =>
        LLMHandlers.translateTextHandler(args),

    'agent-reason': (args) =>
        AgentHandlers.reasonHandler(args),

    // ==================== EVOLUTION TOOLS ====================
    'evolution-start': (args, c) =>
        EvolutionHandlers.startEvolutionHandler(args, c.optimizer, c),

    'evolution-list-strategies': (args, c) =>
        EvolutionHandlers.listStrategiesHandler(args, c.strategies),

    'evolution-generate-cases': (args, c) =>
        EvolutionHandlers.generateCasesHandler(args, c.curriculumGenerator),

    // ==================== SESSION MANAGEMENT TOOLS ====================
    'create-session': (args, c) =>
        Handlers.createSessionHandler(args, c.sessionManager),

    'assert-premise': (args, c) =>
        Handlers.assertPremiseHandler(args, c.sessionManager),

    'query-session': (args, c) =>
        Handlers.querySessionHandler(args, c.sessionManager, c.engineManager, args.verbosity),

    'retract-premise': (args, c) =>
        Handlers.retractPremiseHandler(args, c.sessionManager),

    'list-premises': (args, c) =>
        Handlers.listPremisesHandler(args, c.sessionManager, args.verbosity),

    'clear-session': (args, c) =>
        Handlers.clearSessionHandler(args, c.sessionManager),

    'delete-session': (args, c) =>
        Handlers.deleteSessionHandler(args, c.sessionManager),
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

    // Initialize container (DI)
    const container = createContainer();

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
        const { name, arguments: rawArgs } = request.params;
        const args = rawArgs || {};

        // Ensure default verbosity
        if (!('verbosity' in args)) {
            (args as any).verbosity = 'standard';
        }

        try {
            const handler = toolHandlers[name];
            if (!handler) {
                throw createGenericError('PARSE_ERROR', `Unknown tool: ${name}`);
            }

            // Extract progress token if present
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

            const result = await handler(args, container, { onProgress });

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

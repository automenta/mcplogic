/**
 * MCP Prompts Module
 * 
 * Exports prompt handlers for the MCP protocol.
 */

export {
    PROMPTS,
    listPrompts,
    getPrompt
} from './templates.js';

export type {
    Prompt,
    PromptArgument,
    PromptMessage,
    GetPromptResult,
} from './templates.js';

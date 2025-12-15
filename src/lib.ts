/**
 * MCP Logic - Library Entry Point
 *
 * Exports the core functionality of the library for use in other projects.
 * This file should NOT import @modelcontextprotocol/sdk or any other
 * server-specific dependencies.
 */

// Core Engine
export { createLogicEngine, LogicEngine } from './logicEngine.js';

// Model Finder
export { createModelFinder, ModelFinder } from './modelFinder.js';

// Parser
export { parse } from './parser.js';

// Types and Interfaces
export * from './types/index.js';

// Constants
export { DEFAULTS } from './types/options.js';

// Axioms
export * from './axioms/index.js';

/**
 * Engine Module Exports
 * 
 * Re-exports all engine-related types and classes.
 */

export type {
    ReasoningEngine,
    EngineCapabilities,
    EngineProveOptions,
    SatResult,
} from './interface.js';

export {
    PrologEngine,
    createPrologEngine,
} from './prolog/index.js';

export {
    SATEngine,
    createSATEngine,
} from './sat/index.js';

export {
    EngineManager,
    createEngineManager,
} from './manager.js';

export type {
    EngineSelection,
    ManagerProveOptions,
} from './manager.js';

/**
 * Shared type definitions for MCP Logic
 */

// Re-export error types
export {
    LogicException,
    createParseError,
    createInferenceLimitError,
    createNoModelError,
    createSessionNotFoundError,
    createSessionLimitError,
    createEngineError,
    createUnsatisfiableError,
    createTimeoutError,
    createInvalidDomainError,
    createClausificationError,
    serializeLogicError,
    createError,
    createGenericError,
} from './errors.js';

export type {
    LogicErrorCode,
    ErrorSpan,
    LogicError,
} from './errors.js';

// Re-export clause types for CNF
export {
    createSkolemEnv,
    isTautology,
    atomToKey,
    clauseToString,
    cnfToString,
    literalToString,
} from '../utils/clause.js';

export type {
    Literal,
    Clause,
    ClausifyOptions,
    ClausifyResult,
    SkolemEnv,
    DIMACSResult,
} from './clause.js';

// Re-export AST types
export type {
    ASTNodeType,
    ASTNode,
} from './ast.js';

// Re-export parser types
export type {
    TokenType,
    Token,
} from './parser.js';

// Re-export response types
export type {
    Verbosity,
    Model,
    ModelResult,
    ProveResult,
    MinimalProveResponse,
    StandardProveResponse,
    DetailedProveResponse,
    ProveResponse,
    MinimalModelResponse,
    StandardModelResponse,
    DetailedModelResponse,
    ModelResponse,
} from './responses.js';

// Re-export options
export {
    DEFAULTS
} from './options.js';

export type {
    ReasoningOptions,
    ProveOptions,
    ModelOptions
} from './options.js';

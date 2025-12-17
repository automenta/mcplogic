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
    HighPowerOptions,
    ReasoningOptions,
    ProveOptions,
    ModelOptions
} from './options.js';

// Re-export LLM types
export type {
    TranslateRequest,
    TranslateResult,
    LLMMessage,
    LLMResponse,
    LLMProvider,
    TranslationStrategy,
    TranslationResult,
} from './llm.js';

// Re-export Ontology types
export type {
    Ontology,
    OntologyConfig,
} from './ontology.js';

// Re-export Agent types
export type {
    AgentActionType,
    AgentAction,
    ReasoningStep,
    ReasoningResult,
    ReasonOptions
} from './agent.js';

// Re-export Evolution types
export type {
    EvolutionStrategy,
    EvaluationResult,
    EvaluationCase,
    EvolutionConfig
} from './evolution.js';

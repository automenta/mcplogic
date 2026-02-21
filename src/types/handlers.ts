import { EngineSelection } from '../engines/manager.js';
import { Verbosity } from './index.js';
import { EvolutionStrategy } from './evolution.js';

export interface ProveHandlerArgs {
    premises: string[];
    conclusion: string;
    inference_limit?: number;
    enable_arithmetic?: boolean;
    enable_equality?: boolean;
    engine?: EngineSelection;
    strategy?: 'auto' | 'breadth' | 'depth' | 'iterative';
    include_trace?: boolean;
    highPower?: boolean;
    verbosity?: Verbosity;
}

export interface CheckWellFormedHandlerArgs {
    statements: string[];
}

export interface FindModelHandlerArgs {
    premises: string[];
    domain_size?: number;
    max_domain_size?: number;
    use_sat?: boolean | 'auto';
    enable_symmetry?: boolean;
    count?: number;
    verbosity?: Verbosity;
}

export interface FindCounterexampleHandlerArgs {
    premises: string[];
    conclusion: string;
    domain_size?: number;
    max_domain_size?: number;
    use_sat?: boolean | 'auto';
    enable_symmetry?: boolean;
    verbosity?: Verbosity;
}

export interface CreateSessionHandlerArgs {
    ttl_minutes?: number;
    ontology?: {
        types?: string[];
        relationships?: string[];
        constraints?: string[];
        synonyms?: Record<string, string>;
    };
}

export interface AssertPremiseHandlerArgs {
    session_id: string;
    formula: string;
}

export interface QuerySessionHandlerArgs {
    session_id: string;
    goal: string;
    inference_limit?: number;
    verbosity?: Verbosity;
}

export interface RetractPremiseHandlerArgs {
    session_id: string;
    formula: string;
}

export interface ListPremisesHandlerArgs {
    session_id: string;
    verbosity?: Verbosity;
}

export interface ClearSessionHandlerArgs {
    session_id: string;
}

export interface DeleteSessionHandlerArgs {
    session_id: string;
}

// LLM
export interface TranslateRequest {
    text: string;
    validate?: boolean;
}

// Agent
export interface ReasonArgs {
    goal: string;
    premises?: string[];
    max_steps?: number;
    timeout?: number;
    verbose?: boolean;
}

// Evolution
export interface EvolutionState {
    strategies: EvolutionStrategy[];
}

export interface EvolutionStartArgs {
    generations?: number;
    population_size?: number;
}

export interface EvolutionGenerateCasesArgs {
    domain: string;
    count?: number;
}

// Categorical
export interface VerifyCommutativityHandlerArgs {
    path_a: string[];
    path_b: string[];
    object_start: string;
    object_end: string;
    with_category_axioms?: boolean;
}

export interface GetCategoryAxiomsHandlerArgs {
    concept: string;
    functor_name?: string;
}

/**
 * Type declarations for tau-prolog
 * 
 * Provides type safety for Tau-Prolog integration.
 * These types cover the subset of Tau-Prolog API used by MCPLogic.
 */
declare module 'tau-prolog' {
    /**
     * A Prolog term (can be atom, variable, compound term, etc.)
     */
    export interface Term {
        id: string;
        args?: Term[];
        indicator?: string;
        toJavaScript?(): unknown;
    }

    /**
     * Prolog answer with variable bindings
     */
    export interface Answer {
        id: string;
        links: Record<string, Term>;
        indicator?: string;
    }

    /**
     * Callbacks for consult operation
     */
    export interface ConsultCallbacks {
        success: () => void;
        error: (err: unknown) => void;
    }

    /**
     * Callbacks for query operation
     */
    export interface QueryCallbacks {
        success: (goal: Term) => void;
        error: (err: unknown) => void;
    }

    /**
     * Callbacks for answer retrieval
     */
    export interface AnswerCallbacks {
        success: (answer: Answer | null) => void;
        fail: () => void;
        error: (err: unknown) => void;
        limit: () => void;
    }

    /**
     * Tau-Prolog session for executing Prolog programs
     */
    export interface Session {
        /**
         * Load a Prolog program into the session
         */
        consult(program: string, callbacks: ConsultCallbacks): void;

        /**
         * Execute a Prolog query
         */
        query(goal: string, callbacks: QueryCallbacks): void;

        /**
         * Get the next answer from the current query
         */
        answer(callbacks: AnswerCallbacks): void;

        /**
         * Format an answer as a human-readable string
         */
        format_answer(answer: Answer): string;
    }

    /**
     * Create a new Prolog session
     * @param limit Maximum inference steps (default: 1000)
     */
    export function create(limit?: number): Session;

    const pl: {
        create: typeof create;
        Session: Session;
    };

    export default pl;
}


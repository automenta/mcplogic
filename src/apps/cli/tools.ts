// @ts-nocheck
import { z } from 'zod';
import { tool } from 'ai';
import { createContainer } from '../../container.js';
import { proveHandler } from '../../handlers/core.js';
import { findModelHandler, findCounterexampleHandler } from '../../handlers/model.js';
import { translateTextHandler } from '../../handlers/llm.js';
import {
    createSessionHandler,
    assertPremiseHandler,
    querySessionHandler,
    listPremisesHandler,
    clearSessionHandler,
    deleteSessionHandler
} from '../../handlers/session.js';
import { Verbosity } from '../../types/index.js';

// Initialize container singleton
const container = createContainer();

// Reusable schemas
const verbositySchema = z.enum(['minimal', 'standard', 'detailed']).optional().describe("Response verbosity: 'minimal' (token-efficient), 'standard' (default), 'detailed' (debug info)");

export const tools = {
    prove: tool({
        description: 'Prove a logical statement using resolution. Use when you have premises and want to verify a conclusion follows logically.',
        parameters: z.object({
            premises: z.array(z.string()).describe('List of logical premises in FOL syntax'),
            conclusion: z.string().describe('Statement to prove'),
            inference_limit: z.number().optional().describe('Max inference steps before giving up (default: 1000)'),
            enable_arithmetic: z.boolean().optional().describe('Enable arithmetic predicates'),
            enable_equality: z.boolean().optional().describe('Auto-inject equality axioms'),
            highPower: z.boolean().optional().describe('Enable extended limits (300s timeout, 100k inferences)'),
            engine: z.enum(['prolog', 'sat', 'auto']).optional().describe("Reasoning engine: 'prolog', 'sat', or 'auto'"),
            strategy: z.enum(['auto', 'iterative']).optional().describe("Search strategy"),
            include_trace: z.boolean().optional().describe('Include step-by-step inference trace'),
            verbosity: verbositySchema,
        }),
        execute: async (args: any) => {
            return await proveHandler(args, container.engineManager, args.verbosity as Verbosity || 'standard');
        },
    }),

    findModel: tool({
        description: 'Find a finite model satisfying the given premises. Use to show consistency (satisfiability).',
        parameters: z.object({
            premises: z.array(z.string()).describe('List of logical premises'),
            domain_size: z.number().optional().describe('Specific domain size to search'),
            max_domain_size: z.number().optional().describe('Maximum domain size to try (default: 10)'),
            use_sat: z.union([z.boolean(), z.enum(['auto'])]).optional().describe("Use SAT solver backend"),
            enable_symmetry: z.boolean().optional().describe('Enable symmetry breaking optimization'),
            count: z.number().optional().describe('Number of non-isomorphic models to find'),
            verbosity: verbositySchema,
        }),
        execute: async (args: any) => {
            const handlerArgs = {
                ...args,
                use_sat: args.use_sat === 'auto' ? 'auto' : (args.use_sat as boolean | undefined)
            };
            return await findModelHandler(handlerArgs, container.modelFinder, args.verbosity as Verbosity || 'standard');
        },
    }),

    findCounterexample: tool({
        description: 'Find a counterexample showing the conclusion does NOT follow from premises.',
        parameters: z.object({
            premises: z.array(z.string()).describe('List of logical premises'),
            conclusion: z.string().describe('Conclusion to disprove'),
            domain_size: z.number().optional().describe('Specific domain size to search'),
            max_domain_size: z.number().optional().describe('Maximum domain size to try (default: 10)'),
            use_sat: z.union([z.boolean(), z.enum(['auto'])]).optional().describe("Use SAT solver backend"),
            enable_symmetry: z.boolean().optional().describe('Enable symmetry breaking optimization'),
            verbosity: verbositySchema,
        }),
        execute: async (args: any) => {
            const handlerArgs = {
                ...args,
                use_sat: args.use_sat === 'auto' ? 'auto' : (args.use_sat as boolean | undefined)
            };
            return await findCounterexampleHandler(handlerArgs, container.modelFinder, args.verbosity as Verbosity || 'standard');
        },
    }),

    translateText: tool({
        description: 'Translate natural language to First-Order Logic (FOL).',
        parameters: z.object({
            text: z.string().describe('Natural language text to translate'),
            validate: z.boolean().optional().describe('Validate generated formulas'),
        }),
        execute: async (args: any) => {
            return await translateTextHandler(args, container.inputRouter);
        },
    }),

    // Session Management Tools
    createSession: tool({
        description: 'Create a new reasoning session for incremental knowledge base construction.',
        parameters: z.object({
            ttl_minutes: z.number().optional().describe('Session time-to-live in minutes'),
            ontology: z.object({
                types: z.array(z.string()).optional(),
                relationships: z.array(z.string()).optional(),
                constraints: z.array(z.string()).optional(),
                synonyms: z.record(z.string()).optional(),
            }).optional(),
            verbosity: verbositySchema,
        }),
        execute: async (args: any) => {
            // Only 2 args
            return await createSessionHandler(args, container.sessionManager);
        },
    }),

    assertPremise: tool({
        description: 'Add a formula to a session\'s knowledge base.',
        parameters: z.object({
            session_id: z.string().describe('Session ID'),
            formula: z.string().describe('FOL formula to add'),
            verbosity: verbositySchema,
        }),
        execute: async (args: any) => {
            // Only 2 args
            return await assertPremiseHandler(args, container.sessionManager);
        },
    }),

    querySession: tool({
        description: 'Query the accumulated knowledge base in a session.',
        parameters: z.object({
            session_id: z.string().describe('Session ID'),
            goal: z.string().describe('FOL formula to prove'),
            inference_limit: z.number().optional().describe('Max inference steps'),
            verbosity: verbositySchema,
        }),
        execute: async (args: any) => {
            return await querySessionHandler(args, container.sessionManager, container.engineManager, args.verbosity as Verbosity || 'standard');
        },
    }),

    listPremises: tool({
        description: 'List all premises in a session.',
        parameters: z.object({
            session_id: z.string().describe('Session ID'),
            verbosity: verbositySchema,
        }),
        execute: async (args: any) => {
            return await listPremisesHandler(args, container.sessionManager, args.verbosity as Verbosity || 'standard');
        },
    }),

    clearSession: tool({
        description: 'Clear all premises from a session.',
        parameters: z.object({
            session_id: z.string().describe('Session ID'),
            verbosity: verbositySchema,
        }),
        execute: async (args: any) => {
            return await clearSessionHandler(args, container.sessionManager);
        },
    }),

    deleteSession: tool({
        description: 'Delete a session entirely.',
        parameters: z.object({
            session_id: z.string().describe('Session ID'),
            verbosity: verbositySchema,
        }),
        execute: async (args: any) => {
            return await deleteSessionHandler(args, container.sessionManager);
        },
    }),
};

import clingo from 'clingo-wasm';
import { ReasoningEngine, EngineCapabilities, EngineProveOptions, SatResult } from '../interface.js';
import { ProveResult, createEngineError } from '../../types/index.js';
import { buildProveResult } from '../../utils/response.js';
import { parse } from '../../parser/index.js';
import { createNot, createAnd } from '../../ast/index.js';
import { clausify } from '../../logic/clausifier.js';
import { clausesToASP } from './translator.js';
import { Clause } from '../../types/clause.js';

export class ClingoEngine implements ReasoningEngine {
    readonly name = 'clingo';
    readonly capabilities: EngineCapabilities = {
        horn: true,
        fullFol: true, // Via clausification + ASP disjunctive rules
        equality: true, // Limited (ASP has =)
        arithmetic: true, // ASP has arithmetic
        streaming: false,
    };

    private initialized = false;

    async init(): Promise<void> {
        if (this.initialized) return;
        try {
            await clingo.init();
            this.initialized = true;
        } catch (e) {
            throw createEngineError(`Failed to initialize Clingo: ${e}`);
        }
    }

    async prove(
        premises: string[],
        conclusion: string,
        options?: EngineProveOptions
    ): Promise<ProveResult> {
        const startTime = Date.now();
        const verbosity = options?.verbosity || 'standard';

        try {
            if (!this.initialized) await this.init();

            // 1. Build refutation: premises & not(conclusion)
            const premiseNodes = premises.map(p => parse(p));
            const conclusionNode = parse(conclusion);
            const negatedConclusion = createNot(conclusionNode);

            const allNodes = [...premiseNodes, negatedConclusion];
            const refutationAST = allNodes.length > 0
                ? allNodes.reduce((acc, node) => createAnd(acc, node))
                : negatedConclusion;

            // 2. Clausify
            const clausifyResult = clausify(refutationAST);
            if (!clausifyResult.success || !clausifyResult.clauses) {
                 return buildProveResult({
                    success: false,
                    result: 'error',
                    error: clausifyResult.error?.message || 'Clausification failed',
                    timeMs: Date.now() - startTime,
                }, verbosity);
            }

            // 3. Convert to ASP
            const aspProgram = clausesToASP(clausifyResult.clauses);

            // 4. Run Clingo
            // We want to find if there are ANY models.
            // options: { maxModels: 1 } to stop early if one is found
            const result = await clingo.run(aspProgram, { maxModels: 1 });

            // 5. Interpret result
            // If models found -> SAT (Counterexample) -> Failed to prove
            // If no models -> UNSAT -> Proved

            if (result.Result === 'SATISFIABLE') {
                return buildProveResult({
                    success: false,
                    result: 'failed',
                    message: `Cannot prove: ${conclusion}`,
                    error: 'Counterexample found (SAT)',
                    timeMs: Date.now() - startTime,
                }, verbosity);
            } else if (result.Result === 'UNSATISFIABLE') {
                return buildProveResult({
                    success: true,
                    result: 'proved',
                    message: `Proved: ${conclusion} (via Clingo)`,
                    proof: [
                        `Premises: ${premises.join('; ')}`,
                        `Conclusion: ${conclusion}`,
                        `Method: Clingo ASP Solver (UNSAT refutation)`,
                        `ASP Program:`,
                        aspProgram
                    ],
                    timeMs: Date.now() - startTime,
                }, verbosity);
            } else {
                 // Include output/errors if available
                 const errorMsg = result.Errors ? result.Errors.join('\n') : (result.Output ? result.Output.join('\n') : `Clingo returned ${result.Result}`);
                 return buildProveResult({
                    success: false,
                    result: 'error',
                    error: `Clingo Error: ${errorMsg}`,
                    timeMs: Date.now() - startTime,
                }, verbosity);
            }

        } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            return buildProveResult({
                success: false,
                result: 'error',
                error: `Clingo Error: ${error}`,
                timeMs: Date.now() - startTime,
            }, verbosity);
        }
    }

    async checkSat(clauses: Clause[]): Promise<SatResult> {
        const startTime = Date.now();
        try {
            if (!this.initialized) await this.init();

            const aspProgram = clausesToASP(clauses);
            const result = await clingo.run(aspProgram, { maxModels: 1 });

            if (result.Result === 'SATISFIABLE') {
                // Extract model if needed.
                // result.Models[0].Atoms is a list of strings
                const model = new Map<string, boolean>();
                if (result.Models && result.Models.length > 0) {
                     result.Models[0].Atoms.forEach(atom => model.set(atom, true));
                }

                return {
                    sat: true,
                    model,
                    statistics: { timeMs: Date.now() - startTime }
                };
            } else {
                return {
                    sat: false,
                    statistics: { timeMs: Date.now() - startTime }
                };
            }
        } catch (e) {
            return {
                sat: false,
                statistics: { timeMs: Date.now() - startTime }
            };
        }
    }
}

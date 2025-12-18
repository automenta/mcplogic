
import {
    AgentAction,
    ReasoningResult,
    ReasonOptions,
    ReasoningStep,
    AgentActionType
} from '../types/agent.js';
import { EngineManager, createEngineManager } from '../engines/manager.js';
import { parse } from '../parser/index.js';
import { ModelFinder, createModelFinder } from '../model/index.js';

/**
 * An agent that reasons about a goal using available tools.
 * It follows a simple loop: Assert -> Query (Prove) -> Disprove (Model Find).
 */
export class ReasoningAgent {
    private engine: EngineManager;
    private modelFinder: ModelFinder;
    private maxSteps: number;
    private timeout: number;
    private verbose: boolean;

    constructor(options?: ReasonOptions) {
        // Defaults: 30s timeout, 10 steps, verbose false
        this.timeout = options?.timeout ?? 30000;
        this.maxSteps = options?.maxSteps ?? 10;
        this.verbose = options?.verbose ?? false;

        // Initialize engines
        this.engine = createEngineManager(this.timeout);
        this.modelFinder = createModelFinder(this.timeout);
    }

    /**
     * Executes the agentic reasoning loop.
     */
    async run(goal: string, premises: string[] = []): Promise<ReasoningResult> {
        const steps: ReasoningStep[] = [];
        const startTime = Date.now();

        // Helper to add steps
        const addStep = (type: AgentActionType, content: string, explanation?: string, result?: unknown) => {
            steps.push({
                action: { type, content, explanation },
                result,
                timestamp: Date.now()
            });
        };

        try {
            // Step 1: Assert premises
            for (const p of premises) {
                try {
                    parse(p);
                    addStep('assert', p);
                } catch (e) {
                    addStep('conclude', 'Error', `Invalid syntax in premise: ${p}`);
                    return {
                        answer: 'Error',
                        steps,
                        confidence: 0
                    };
                }
            }

            try {
                parse(goal);
            } catch (e) {
                addStep('conclude', 'Error', `Invalid syntax in goal: ${goal}`);
                return {
                    answer: 'Error',
                    steps,
                    confidence: 0
                };
            }

            // Step 2: Query (Prove)
            addStep('query', goal, 'Attempting to prove goal');

            // Attempt proof
            // Note: prove() returns found: boolean, not a string result
            const proofResult = await this.engine.prove(premises, goal);

            if (proofResult.found) {
                addStep('conclude', 'True', 'Proof found', proofResult);
                return {
                    answer: 'True',
                    steps,
                    confidence: 1.0
                };
            }

            // Step 3: Check for Counter-model (Disprove)
            // If we can find a model where premises are true and goal is false, then goal is not valid.
            const negation = `-(${goal})`;
            addStep('query', negation, 'Attempting to find counter-example');

            const modelResult = await this.modelFinder.findModel([...premises, negation]);

            if (modelResult.success) {
                addStep('conclude', 'False', 'Counter-example found', modelResult);
                return {
                    answer: 'False',
                    steps,
                    confidence: 1.0
                };
            }

            // Step 4: Indeterminate
            addStep('conclude', 'Unknown', 'No proof or counter-example found');
            return {
                answer: 'Unknown',
                steps,
                confidence: 0.0
            };

        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            addStep('conclude', 'Error', msg);
             return {
                answer: 'Error',
                steps,
                confidence: 0.0
            };
        }
    }
}

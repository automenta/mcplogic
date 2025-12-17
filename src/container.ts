import { ModelFinder, createModelFinder } from './modelFinder.js';
import { CategoricalHelpers } from './axioms/categorical.js';
import { SessionManager, createSessionManager } from './sessionManager.js';
import { EngineManager, createEngineManager } from './engines/manager.js';
import {
    Optimizer, Evaluator, StrategyEvolver, CurriculumGenerator,
    JsonPerformanceDatabase, InputRouter, IPerformanceDatabase
} from './evolution/index.js';
import { StandardLLMProvider } from './llm/provider.js';
import { EvolutionStrategy } from './types/evolution.js';

export interface ServerContainer {
    modelFinder: ModelFinder;
    categoricalHelpers: CategoricalHelpers;
    sessionManager: SessionManager;
    engineManager: EngineManager;
    llmProvider: StandardLLMProvider;
    perfDb: IPerformanceDatabase;
    optimizer: Optimizer;
    inputRouter: InputRouter;
    curriculumGenerator: CurriculumGenerator;
    strategies: EvolutionStrategy[];
    defaultStrategy: EvolutionStrategy;
    evaluator: Evaluator;
    evolver: StrategyEvolver;
}

export function createContainer(): ServerContainer {
    // Initialize engines and managers
    const modelFinder = createModelFinder();
    const categoricalHelpers = new CategoricalHelpers();
    const sessionManager = createSessionManager();
    const engineManager = createEngineManager();

    // Initialize Evolution Engine components
    const llmProvider = new StandardLLMProvider();
    const perfDb = new JsonPerformanceDatabase();
    const evaluator = new Evaluator(perfDb, llmProvider);
    const evolver = new StrategyEvolver(llmProvider, perfDb);
    const curriculumGenerator = new CurriculumGenerator(llmProvider, perfDb, 'src/evalCases/generated');

    // Define strategies
    const heuristicStrategy: EvolutionStrategy = {
        id: 'heuristic-v1',
        description: 'Standard heuristic strategy (Regex-based)',
        promptTemplate: 'Translate the following to FOL:\n{{INPUT}}', // Unused for heuristic but required by type
        parameters: {},
        metadata: { successRate: 0, inferenceCount: 0, generation: 0 }
    };

    const llmStrategy: EvolutionStrategy = {
        id: 'llm-default',
        description: 'LLM-based translation strategy',
        promptTemplate: `You are an expert in First-Order Logic (FOL).
Translate the following natural language text into First-Order Logic formulas using Prover9 syntax.

Syntax Rules:
- Quantifiers: 'all x', 'exists x'
- Operators: '&' (and), '|' (or), '->' (implies), '<->' (iff), '-' (not)
- Predicates: Lowercase start, e.g., 'man(x)', 'mortal(x)'
- Constants: Lowercase start, e.g., 'socrates'
- Variables: Single lowercase letters (x, y, z...) are free variables (implicitly universal) unless bound.
- Equality: '='

Output Format:
- Provide ONLY the list of formulas.
- Do not wrap in code blocks if possible, or use \`\`\`prolog or \`\`\`text.
- Separate formulas by newlines.
- If there is a clear conclusion/goal to prove, prefix it with "conclusion:".

Input:
{{INPUT}}
`,
        parameters: {},
        metadata: { successRate: 0, inferenceCount: 0, generation: 0 }
    };

    // Determine default strategy based on environment
    const hasLLMConfig = !!(process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL || process.env.OLLAMA_URL);

    // We start with the Heuristic strategy in the list, but we might set the default to LLM
    const initialStrategies = [heuristicStrategy, llmStrategy];

    // If LLM is configured, use it as default. Otherwise fallback to heuristic.
    const defaultStrategy = hasLLMConfig ? llmStrategy : heuristicStrategy;

    const optimizer = new Optimizer(perfDb, evolver, evaluator, {
        populationSize: 5,
        generations: 3,
        mutationRate: 0.3,
        elitismCount: 1,
        evalCasesPath: 'src/evalCases'
    });

    // Initialize Router
    const router = new InputRouter(perfDb, defaultStrategy, llmProvider);

    return {
        modelFinder,
        categoricalHelpers,
        sessionManager,
        engineManager,
        llmProvider,
        perfDb,
        optimizer,
        inputRouter: router,
        curriculumGenerator,
        strategies: initialStrategies,
        defaultStrategy,
        evaluator,
        evolver
    };
}

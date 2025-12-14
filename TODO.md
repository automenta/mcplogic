# MCP Logic Development Plan

A **comprehensive, mindlessly-executable** roadmap from the current FOL engine to a full neurosymbolic reasoning platform. Each task includes exact file paths, code snippets, and verification steps.

---

## 📊 Feature Matrix: Current → Target

| Feature | README Status | MCR Vision | TODO Phase |
|---------|---------------|------------|------------|
| **Core FOL Reasoning** | ✅ Done | ✅ | — |
| **Model Finding (SAT)** | ✅ Done | ✅ | — |
| **Session Management** | ✅ Done | ✅ | — |
| **Proof Traces** | ✅ Done | ✅ | — |
| **Streaming Progress** | ✅ Done | ✅ | — |
| **High-Power Mode** | ☐ Planned | ✅ | Phase 1.1 |
| **Isomorphism Filtering** | ☐ Planned | — | Phase 1.2 |
| **CLI Tool** | ☐ Planned | ✅ | Phase 1.3 |
| **TPTP Benchmarks** | ☐ Planned | — | Phase 1.4 |
| **Library Export (NPM)** | ☐ Planned | ✅ | Phase 2.1 |
| **Browser/WASM** | ☐ Planned | ✅ | Phase 2.2 |
| **Web Playground + Offline LLM** | — | ✅ | Phase 2.3 |
| **NL→FOL Translation** | ☐ Planned | ✅ | Phase 3.1 |
| **Heuristic Strategy Selection** | ☐ Planned | ✅ | Phase 3.2 |
| **Ontology Support** | — | ✅ | Phase 4.1 |
| **Agentic Reasoning** | — | ✅ | Phase 4.2 |
| **Evolution Engine** | — | ✅ | Phase 5 |
| **Prover9 WASM** | ☐ Deferred | ☐ | Deprioritized |
| **SMT/Z3** | ☐ Research | ☐ | Deprioritized |
| **Modal/Probabilistic Logic** | ☐ Research | ☐ | Deprioritized |

---

## ✅ Completed Foundation

| Feature | Key Files | Notes |
|---------|-----------|-------|
| First-Order Logic Engine | `src/logicEngine.ts` | Tau-Prolog based |
| Multi-Engine Federation | `src/engines/manager.ts`, `sat.ts` | Auto-selects Prolog vs SAT |
| Arithmetic & Equality | `src/axioms/arithmetic.ts` | `lt`, `gt`, `plus`, `times`, etc. |
| Extended Axiom Library | `src/resources/`, `src/axioms/` | Category, ring, lattice, Peano, ZFC |
| Session Management | `src/sessionManager.ts` | Incremental KB with TTL |
| Proof Traces | `src/utils/trace.ts` | Meta-interpreter based |
| SAT-Backed Models | `src/modelFinder.ts` | Domain 25+ with symmetry breaking |
| Symmetry Breaking | `src/utils/symmetry.ts` | Lex-leader |
| 265+ Unit Tests | `tests/` | 80%+ coverage |

---

## 🎯 Phase 1: Quick Wins (1-2 hours each)

### 1.1 High-Power Mode Flag ⚡

**Effort:** ~1 hour | **Impact:** High | **Risk:** None | **README:** ☐ Line 50

Add a single boolean flag that unlocks extended limits for complex reasoning.

#### Implementation Steps

1. **Update defaults** in `src/types/options.ts`:
```typescript
// Add to DEFAULTS (line 31-36)
export const DEFAULTS = {
    maxSeconds: 30,
    maxInferences: 5000,
    maxDomainSize: 25,
    satThreshold: 8,
    // NEW: High-power mode settings
    highPowerMaxSeconds: 300,
    highPowerMaxInferences: 100000,
} as const;
```

2. **Add `highPower` parameter** to tool schemas in `src/server.ts`:
```typescript
// Add to 'prove' tool inputSchema.properties (after line 124):
highPower: {
    type: 'boolean',
    description: 'Enable extended limits (300s timeout, 100k inferences). Use for complex proofs.',
},
// Also add to 'find-model' tool (after line 201)
```

3. **Apply in handler** `src/handlers/core.ts`:
```typescript
// In proveHandler, around line 20:
const inferenceLimit = args.highPower 
    ? DEFAULTS.highPowerMaxInferences 
    : (args.inference_limit ?? DEFAULTS.maxInferences);
```

4. **Update README.md** line 50: Change `[ ]` to `[x]`

#### Verification
```bash
npm test
# Test complex proof with highPower: true
```

---

### 1.2 Isomorphism Filtering 🔄

**Effort:** ~1 hour | **Impact:** Medium | **Risk:** None | **README:** ☐ Line 22

Already implemented! Just needs the `count` parameter wired through.

#### Implementation Steps

1. **Verify existing implementation** in `src/modelFinder.ts`:
   - `areIsomorphic()` at line 267 ✅
   - `isIsomorphism()` at line 285 ✅
   - `findModelsBacktracking()` accepts `count` parameter ✅

2. **Wire `count` through MCP tool** in `src/server.ts`:
   - Already present in schema (line 198-201) ✅

3. **Verify handler passes count** in `src/handlers/model.ts`

4. **Add test case** in `tests/modelFinder.test.ts`:
```typescript
test('returns multiple non-isomorphic models', async () => {
    const finder = createModelFinder();
    const result = await finder.findModel(['exists x P(x)'], { count: 3 });
    expect(result.models?.length).toBeGreaterThan(1);
});
```

5. **Update README.md** line 22: Change `[ ]` to `[x]`

#### Verification
```bash
npm test -- --testPathPattern=modelFinder
```

---

### 1.3 CLI Tool 🖥️

**Effort:** ~2 hours | **Impact:** Medium | **Risk:** None

Create a standalone CLI for testing without an MCP client.

#### Implementation Steps

1. **Create CLI entry point** `src/cli.ts`:
```typescript
#!/usr/bin/env node
/**
 * MCP Logic CLI
 * Usage: mcplogic prove <file.p>
 *        mcplogic model <file.p>
 *        mcplogic validate <file.p>
 *        mcplogic repl
 */
import { readFileSync } from 'fs';
import * as readline from 'readline';
import { createLogicEngine } from './logicEngine.js';
import { createModelFinder } from './modelFinder.js';
import { parse } from './parser.js';

const [,, command, file] = process.argv;

async function main() {
    if (!command) {
        console.log(`Usage: mcplogic <prove|model|validate|repl> [file.p]
  
Commands:
  prove <file>     Prove last line from preceding premises
  model <file>     Find model satisfying all lines
  validate <file>  Check syntax of all lines
  repl             Interactive read-eval-prove loop
`);
        process.exit(0);
    }

    if (command === 'repl') {
        return runRepl();
    }

    if (!file) {
        console.error('Error: file argument required');
        process.exit(1);
    }

    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    
    switch (command) {
        case 'prove': {
            const premises = lines.slice(0, -1);
            const conclusion = lines[lines.length - 1];
            const engine = createLogicEngine(30000, 5000);
            const result = await engine.prove(premises, conclusion, { includeTrace: true });
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        case 'model': {
            const finder = createModelFinder(30000, 10);
            const result = await finder.findModel(lines);
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        case 'validate': {
            let allValid = true;
            for (const stmt of lines) {
                try {
                    parse(stmt);
                    console.log(`✓ ${stmt}`);
                } catch (e) {
                    console.log(`✗ ${stmt}: ${(e as Error).message}`);
                    allValid = false;
                }
            }
            process.exit(allValid ? 0 : 1);
            break;
        }
        default:
            console.error(`Unknown command: ${command}`);
            process.exit(1);
    }
}

async function runRepl() {
    const engine = createLogicEngine(30000, 5000);
    const premises: string[] = [];
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'mcplogic> '
    });
    
    console.log('MCP Logic REPL. Commands: .assert <formula>, .prove <goal>, .list, .clear, .quit');
    rl.prompt();
    
    rl.on('line', async (line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('.assert ')) {
            const formula = trimmed.slice(8);
            try {
                parse(formula);
                premises.push(formula);
                console.log(`Asserted: ${formula}`);
            } catch (e) {
                console.log(`Syntax error: ${(e as Error).message}`);
            }
        } else if (trimmed.startsWith('.prove ')) {
            const goal = trimmed.slice(7);
            const result = await engine.prove(premises, goal, { includeTrace: true });
            console.log(result.found ? '✓ Proved' : '✗ Not proved');
            if (result.trace) console.log(result.trace);
        } else if (trimmed === '.list') {
            premises.forEach((p, i) => console.log(`${i+1}. ${p}`));
        } else if (trimmed === '.clear') {
            premises.length = 0;
            console.log('Cleared all premises.');
        } else if (trimmed === '.quit' || trimmed === '.exit') {
            rl.close();
            return;
        } else if (trimmed) {
            console.log('Unknown command. Use .assert, .prove, .list, .clear, or .quit');
        }
        rl.prompt();
    });
}

main().catch(console.error);
```

2. **Update `package.json`** (add after line 12):
```json
"bin": {
    "mcplogic": "./dist/cli.js"
},
```

3. **Build and link**:
```bash
npm run build
npm link  # Creates global 'mcplogic' command
```

#### Verification
```bash
# Create test file
echo 'all x (man(x) -> mortal(x))
man(socrates)
mortal(socrates)' > /tmp/test.p

mcplogic prove /tmp/test.p
mcplogic validate /tmp/test.p
mcplogic repl
```

---

### 1.4 TPTP Benchmark Subset 📊

**Effort:** ~2 hours | **Impact:** Medium | **Risk:** None | **README:** ☐ Line 63

Add standard ATP benchmarks for credibility and regression testing.

#### Implementation Steps

1. **Create benchmark directory** `benchmarks/tptp/`:
```bash
mkdir -p benchmarks/tptp
```

2. **Add classic problems** (translate from TPTP to our syntax):
   - `PUZ031-1.p` (Schubert's Steamroller)
   - `SYN000-1.p` (Propositional tautology)
   - `SYN001-1.p` (Basic quantifier)
   
3. **Create benchmark runner** `benchmarks/run-tptp.ts`:
```typescript
import { readdirSync, readFileSync } from 'fs';
import { createLogicEngine } from '../src/logicEngine.js';

async function runBenchmarks() {
    const files = readdirSync('benchmarks/tptp').filter(f => f.endsWith('.p'));
    const engine = createLogicEngine(60000, 50000);
    
    for (const file of files) {
        const content = readFileSync(`benchmarks/tptp/${file}`, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('%'));
        const premises = lines.slice(0, -1);
        const conclusion = lines[lines.length - 1];
        
        const start = Date.now();
        const result = await engine.prove(premises, conclusion);
        const elapsed = Date.now() - start;
        
        console.log(`${file}: ${result.found ? 'PROVED' : 'FAILED'} (${elapsed}ms)`);
    }
}

runBenchmarks();
```

4. **Add npm script**:
```json
"scripts": {
    "benchmark:tptp": "tsx benchmarks/run-tptp.ts"
}
```

5. **Update README.md** line 63: Change `[ ]` to `[x]`

---

## 🚀 Phase 2: Ecosystem Leverage (4-8 hours each)

### 2.1 Library Export 📦

**Effort:** ~4 hours | **Impact:** Very High | **Risk:** Low

Publish core logic as a standalone NPM package.

#### Implementation Steps

1. **Create library entry point** `src/index.lib.ts`:
```typescript
/**
 * MCP Logic Core Library
 * 
 * Standalone first-order logic engine for embedding in Node.js applications.
 */

// Core engines
export { LogicEngine, createLogicEngine } from './logicEngine.js';
export { ModelFinder, createModelFinder } from './modelFinder.js';

// Parsing
export { parse, tokenize } from './parser.js';
export { validateSyntax } from './syntaxValidator.js';

// Clausification
export { clausify, toDIMACS } from './clausifier.js';

// Session management
export { createSessionManager, SessionManager } from './sessionManager.js';

// Types
export type {
    ASTNode,
    ProveResult,
    ProveOptions,
    Model,
    ModelResult,
    ModelOptions,
    Clause,
    Literal,
    ClausifyResult,
    DIMACSResult,
} from './types/index.js';

// Constants
export { DEFAULTS } from './types/index.js';
```

2. **Update `package.json`** exports:
```json
{
    "name": "@mcplogic/core",
    "version": "1.0.0",
    "exports": {
        ".": "./dist/index.lib.js",
        "./server": "./dist/index.js"
    },
    "main": "dist/index.lib.js",
    "types": "dist/index.lib.d.ts"
}
```

3. **Create usage example** `examples/library-usage.ts`:
```typescript
import { createLogicEngine, createModelFinder, parse } from '@mcplogic/core';

async function demo() {
    // Validate syntax
    parse('all x (P(x) -> Q(x))');
    
    // Prove theorem
    const engine = createLogicEngine();
    const proof = await engine.prove(
        ['all x (P(x) -> Q(x))', 'P(a)'],
        'Q(a)'
    );
    console.log('Proved:', proof.found);
    
    // Find model
    const finder = createModelFinder();
    const model = await finder.findModel(['exists x P(x)']);
    console.log('Model:', model);
}

demo();
```

#### Verification
```bash
npm run build
npm pack  # Creates tarball
# Test in another project
```

---

### 2.2 Browser/WASM Compatibility 🌐

**Effort:** ~6 hours | **Impact:** Very High | **Risk:** Medium

Enable client-side reasoning in the browser.

#### Node.js Dependencies Audit

| Dependency | Location | Browser Status |
|------------|----------|----------------|
| `tau-prolog` | Core engine | ✅ Browser-compatible |
| `logic-solver` | SAT engine | ✅ Browser-compatible |
| `fs` | CLI only | ❌ Exclude from browser build |
| `readline` | CLI only | ❌ Exclude from browser build |
| `@modelcontextprotocol/sdk` | Server only | ❌ Exclude from browser build |

#### Implementation Steps

1. **Create browser build config** `tsconfig.browser.json`:
```json
{
    "extends": "./tsconfig.json",
    "compilerOptions": {
        "outDir": "./dist/browser",
        "module": "ESNext",
        "target": "ES2020",
        "lib": ["ES2020", "DOM"]
    },
    "include": [
        "src/logicEngine.ts",
        "src/modelFinder.ts",
        "src/parser.ts",
        "src/syntaxValidator.ts",
        "src/clausifier.ts",
        "src/translator.ts",
        "src/axioms/**/*.ts",
        "src/engines/**/*.ts",
        "src/utils/**/*.ts",
        "src/types/**/*.ts",
        "src/index.lib.ts"
    ],
    "exclude": [
        "src/cli.ts",
        "src/index.ts",
        "src/server.ts",
        "src/sessionManager.ts",
        "src/handlers/**/*.ts",
        "src/resources/**/*.ts",
        "src/prompts/**/*.ts"
    ]
}
```

2. **Add browser build script** to `package.json`:
```json
"scripts": {
    "build:browser": "tsc -p tsconfig.browser.json"
}
```

3. **Create Vite test project**:
```bash
mkdir -p playground
npx -y create-vite@latest playground/test --template vanilla-ts
cd playground/test
# Add import test
```

4. **Test in browser**:
```html
<script type="module">
import { createLogicEngine } from './dist/browser/index.lib.js';
const engine = createLogicEngine();
const result = await engine.prove(['P(a)'], 'P(a)');
console.log(result);
</script>
```

#### Verification
```bash
npm run build:browser
npx serve .
# Open browser, check console
```

---

### 2.3 Web Playground with Offline LLM 🎮🧠

**Effort:** ~8-12 hours | **Impact:** Very High | **Risk:** Medium

A complete end-to-end demo: **natural language → FOL → proof/model**.

#### Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| UI | Vanilla HTML/CSS/JS | Single-page, glassmorphism |
| Editor | CodeMirror 6 | Syntax highlighting for FOL |
| Logic Engine | MCP Logic (browser build) | From Phase 2.2 |
| Offline LLM | **Transformers.js** | WebGPU-accelerated |
| Model | `Xenova/TinyLlama-1.1B-Chat` | 700MB, runs offline |

#### File Structure
```
playground/
├── index.html          # Main page
├── style.css           # Modern glassmorphism design
├── app.js              # Main application logic
├── llm.js              # Transformers.js integration
├── editor.js           # CodeMirror setup
└── logic.js            # MCP Logic wrapper
```

#### Implementation

See detailed implementation in **Appendix A** below.

---

## 🧠 Phase 3: AI Integration (4-8 hours each)

### 3.1 Natural Language Interface 🗣️

**Effort:** ~4 hours | **Impact:** High | **Risk:** Low | **MCR:** Core feature

Add NL→FOL translation as an MCP tool, matching MCR's `session.assert` model.

#### Implementation Steps

1. **Create NL translation prompt** `src/prompts/nl-to-fol.ts`:
```typescript
export const NL_TO_FOL_SYSTEM = `You are a logic translator. Convert natural language to first-order logic.

Syntax:
- all x (predicate(x)) — universal quantification
- exists x (predicate(x)) — existential  
- -> implies, & and, | or, - not, <-> iff
- Use lowercase: human(socrates), not Human(Socrates)

Output format:
PREMISES:
<one formula per line>
CONCLUSION:
<optional, only if asking a question>

Example:
Input: "All humans are mortal. Socrates is human. Is Socrates mortal?"
Output:
PREMISES:
all x (human(x) -> mortal(x))
human(socrates)
CONCLUSION:
mortal(socrates)
`;

export function buildNLTranslatePrompt(input: string): string {
    return `${NL_TO_FOL_SYSTEM}\n\nInput: "${input}"\n\nOutput:`;
}
```

2. **Create translation handler** `src/handlers/translate.ts`:
```typescript
import { parse } from '../parser.js';
import { buildNLTranslatePrompt } from '../prompts/nl-to-fol.js';

export interface TranslateResult {
    success: boolean;
    premises: string[];
    conclusion?: string;
    raw?: string;
    errors?: string[];
}

export function parseTranslationOutput(output: string): TranslateResult {
    const lines = output.split('\n').filter(l => l.trim());
    const premises: string[] = [];
    let conclusion: string | undefined;
    let inPremises = false;
    let inConclusion = false;
    const errors: string[] = [];
    
    for (const line of lines) {
        if (line.startsWith('PREMISES:')) { inPremises = true; inConclusion = false; continue; }
        if (line.startsWith('CONCLUSION:')) { inPremises = false; inConclusion = true; continue; }
        
        const formula = line.trim();
        if (!formula) continue;
        
        try {
            parse(formula);
            if (inPremises) premises.push(formula);
            else if (inConclusion) conclusion = formula;
        } catch (e) {
            errors.push(`Invalid formula "${formula}": ${(e as Error).message}`);
        }
    }
    
    return {
        success: errors.length === 0 && premises.length > 0,
        premises,
        conclusion,
        raw: output,
        errors: errors.length > 0 ? errors : undefined
    };
}
```

3. **Add MCP tool** `translate-text` in `src/server.ts`:
```typescript
{
    name: 'translate-text',
    description: `Translate natural language to first-order logic.

**When to use:** User provides requirements in plain English.
**Output:** Structured FOL that can be passed to prove/find-model.

**Example:**
  text: "All cats are mammals. Whiskers is a cat."
  → { premises: ["all x (cat(x) -> mammal(x))", "cat(whiskers)"] }

**Note:** Requires LLM configuration or uses built-in offline model.`,
    inputSchema: {
        type: 'object',
        properties: {
            text: { type: 'string', description: 'Natural language input' },
            validate: { type: 'boolean', description: 'Validate translated formulas (default: true)' },
            verbosity: verbositySchema,
        },
        required: ['text'],
    },
},
```

---

### 3.2 Heuristic Strategy Selection 🎲

**Effort:** ~2 hours | **Impact:** Medium | **Risk:** None | **README:** Line 68

Auto-select optimal strategy based on problem structure.

#### Implementation Steps

1. **Extend `analyzeFormulas`** in `src/engines/manager.ts`:
```typescript
interface FormulaAnalysis {
    isHorn: boolean;
    hasEquality: boolean;
    hasArithmetic: boolean;
    variableCount: number;
    clauseCount: number;
    // NEW:
    equalityDensity: number;  // % of clauses with equality
    recommendedStrategy: 'single' | 'iterative';
}

function analyzeFormulas(formulas: string[]): FormulaAnalysis {
    // ... existing analysis ...
    
    // Recommend iterative for equality-heavy or complex problems
    const recommendedStrategy = 
        (equalityDensity > 0.3 || clauseCount > 10) 
            ? 'iterative' 
            : 'single';
    
    return { ...existing, equalityDensity, recommendedStrategy };
}
```

2. **Apply in proveHandler** `src/handlers/core.ts`:
```typescript
// Auto-select strategy if not specified
const analysis = analyzeFormulas([...premises, conclusion]);
const strategy = args.strategy ?? analysis.recommendedStrategy;
```

3. **Log heuristic decision** in trace output.

---

## 🏗️ Phase 4: Neurosymbolic Features (MCR Parity)

### 4.1 Ontology Support 🗂️

**Effort:** ~6 hours | **Impact:** High | **Risk:** Medium | **MCR:** Core feature

Constrain knowledge graphs with type/relationship schemas.

#### Implementation Steps

1. **Define Ontology type** `src/types/ontology.ts`:
```typescript
export interface Ontology {
    types: Set<string>;           // Valid entity types: bird, mammal, person
    relationships: Set<string>;   // Valid predicates: loves, parent_of
    constraints: Set<string>;     // Rules: unique_name, closed_world
    synonyms: Map<string, string>; // human -> person
}

export function createOntology(config?: Partial<{
    types: string[];
    relationships: string[];
    constraints: string[];
    synonyms: Record<string, string>;
}>): Ontology {
    return {
        types: new Set(config?.types ?? []),
        relationships: new Set(config?.relationships ?? []),
        constraints: new Set(config?.constraints ?? []),
        synonyms: new Map(Object.entries(config?.synonyms ?? {})),
    };
}
```

2. **Add validation to sessionManager** `src/sessionManager.ts`:
```typescript
validateAgainstOntology(formula: string, ontology: Ontology): { valid: boolean; error?: string } {
    const ast = parse(formula);
    const predicates = extractPredicates(ast);
    
    for (const pred of predicates) {
        if (!ontology.types.has(pred) && !ontology.relationships.has(pred)) {
            return { valid: false, error: `Unknown predicate: ${pred}` };
        }
    }
    return { valid: true };
}
```

3. **Add MCP tools**: `define-ontology`, `validate-against-ontology`

---

### 4.2 Agentic Reasoning Loop 🤖

**Effort:** ~8 hours | **Impact:** Very High | **Risk:** Medium | **MCR:** Core feature

Multi-step goal-oriented reasoning with assert/query/conclude actions.

#### Implementation Steps

1. **Define reasoning actions** `src/types/agent.ts`:
```typescript
export type AgentAction = 
    | { type: 'assert'; content: string }
    | { type: 'query'; content: string }
    | { type: 'conclude'; answer: string; explanation: string };

export interface ReasoningStep {
    action: AgentAction;
    result?: any;
}

export interface ReasoningResult {
    answer: string;
    steps: ReasoningStep[];
    confidence: number;
}
```

2. **Create reasoning agent** `src/agent/reasoner.ts`:
```typescript
export async function reason(
    task: string,
    session: Session,
    llm: LLMClient,
    options: { maxSteps?: number } = {}
): Promise<ReasoningResult> {
    const maxSteps = options.maxSteps ?? 5;
    const steps: ReasoningStep[] = [];
    
    for (let i = 0; i < maxSteps; i++) {
        // Ask LLM for next action
        const prompt = buildAgentPrompt(task, session.getKB(), steps);
        const response = await llm.generate(prompt);
        const action = parseAgentAction(response);
        
        if (action.type === 'conclude') {
            return {
                answer: action.answer,
                steps,
                confidence: computeConfidence(steps)
            };
        }
        
        // Execute action
        const result = await executeAction(action, session);
        steps.push({ action, result });
    }
    
    return { answer: 'Inconclusive', steps, confidence: 0 };
}
```

3. **Add MCP tool** `reason`:
```typescript
{
    name: 'reason',
    description: 'Multi-step reasoning to achieve a goal.',
    inputSchema: {
        type: 'object',
        properties: {
            task: { type: 'string', description: 'Goal to achieve' },
            session_id: { type: 'string', description: 'Session context' },
            max_steps: { type: 'integer', description: 'Max reasoning steps (default: 5)' },
        },
        required: ['task', 'session_id'],
    },
}
```

---

## 🧬 Phase 5: Evolution Engine (MCR Advanced)

**Effort:** ~2-4 weeks | **Impact:** Very High | **Risk:** High

Self-optimizing translation strategies—the "brain" of MCR.

### Overview

The Evolution Engine automatically discovers better NL→FOL translation strategies by:
1. **Benchmarking** strategies against a curriculum of test cases
2. **Mutating** prompts using LLM critique
3. **Selecting** best performers for the next generation

### Components

| Component | Purpose | File |
|-----------|---------|------|
| Optimizer Coordinator | Orchestrates evolution loop | `src/evolution/optimizer.ts` |
| Strategy Evolver | Mutates prompts via critique | `src/evolution/evolver.ts` |
| Curriculum Generator | Creates diverse test cases | `src/evolution/curriculum.ts` |
| Performance Database | Stores benchmark results | `performance.db` (SQLite) |

### Implementation

Defer to Phase 5 after Phases 1-4 are complete. Follow MCR1.md architecture.

---

## ❌ Deprioritized

| Item | Effort | Why Defer |
|------|--------|-----------|
| Prover9 WASM | Weeks | SAT+iterative handles most cases |
| SMT/Z3 | Weeks | Requires emscripten, large WASM |
| Modal Logic | Weeks | Research; no demand |
| Higher-Order Logic | Weeks | Fundamental architecture change |
| Probabilistic Logic | Weeks | Requires different inference engine |

---

## 📋 Development Workflow

### Before Starting Any Task

1. **Check tests pass**: `npm test`
2. **Read this plan**: Understand dependencies
3. **Update task.md**: Mark task `[/]` in progress

### After Completing Any Task

1. **Run full test suite**: `npm test`
2. **Update this file**: Mark task `[x]`
3. **Update README.md**: Check off corresponding feature
4. **Commit**: `git commit -m "feat: <description>"`

### File Reference Index

| Purpose | File |
|---------|------|
| MCP Tool Definitions | `src/server.ts` (lines 70-503) |
| Default Parameters | `src/types/options.ts` |
| Prove Handler | `src/handlers/core.ts` |
| Model Handler | `src/handlers/model.ts` |
| Logic Engine | `src/logicEngine.ts` |
| Model Finder | `src/modelFinder.ts` |
| Parser | `src/parser.ts` |
| Session Manager | `src/sessionManager.ts` |
| Test Suite | `tests/*.test.ts` |
| MCR Vision Docs | `doc/mcr*.md` |

---

## Appendix A: Web Playground Implementation

### `playground/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Logic Playground</title>
    <link rel="stylesheet" href="style.css">
    <script type="importmap">
    {
        "imports": {
            "@xenova/transformers": "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.0"
        }
    }
    </script>
</head>
<body>
    <div class="container">
        <header>
            <h1>🔮 MCP Logic Playground</h1>
            <span id="llm-status" class="status">LLM: ⏳ Loading...</span>
        </header>
        <main class="panels">
            <section class="panel" id="input-panel">
                <h2>Natural Language</h2>
                <textarea id="nl-input" placeholder="All humans are mortal. Socrates is human. Is Socrates mortal?"></textarea>
                <button id="translate-btn" class="primary">Translate to FOL →</button>
            </section>
            <section class="panel" id="fol-panel">
                <h2>First-Order Logic</h2>
                <pre id="fol-editor" contenteditable="true"></pre>
                <div class="button-group">
                    <button id="prove-btn">Prove</button>
                    <button id="model-btn">Find Model</button>
                </div>
            </section>
            <section class="panel" id="output-panel">
                <h2>Result</h2>
                <pre id="output"></pre>
            </section>
        </main>
    </div>
    <script type="module" src="app.js"></script>
</body>
</html>
```

### LLM Options (Trade-offs)

| Model | Size | Quality | Speed | Recommended |
|-------|------|---------|-------|-------------|
| `Xenova/TinyLlama-1.1B-Chat` | 700MB | ★★☆☆ | Very Fast | ✅ Default |
| `Xenova/Phi-3-mini-4k-instruct` | 1.5GB | ★★★☆ | Fast | Quality focus |
| `Xenova/Qwen2-0.5B-Instruct` | 400MB | ★★☆☆ | Very Fast | Size focus |

---

## 🏁 Next Action

**Recommended:** Start with **Phase 1.1: High-Power Mode Flag**

1. Open `src/types/options.ts`
2. Add `highPowerMaxSeconds` and `highPowerMaxInferences` to `DEFAULTS`
3. Open `src/server.ts`, add `highPower` to prove/find-model schemas
4. Open `src/handlers/core.ts`, apply highPower logic
5. Run `npm test`
6. Update README.md line 50
7. Done. (~1 hour)

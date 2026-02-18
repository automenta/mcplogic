**Complete Self-Contained Development Plan for mcplogic**  
*(Pure TypeScript + npm-ready dependencies only • No self-compiled WASM • Elegance prioritized)*

**Goal**
Transform mcplogic into a production-grade, elegant FOL/SMT/ASP reasoning engine that delivers Prover9-level (or better) theorem-proving and model-finding power while remaining 100% pure TypeScript, zero native build steps, and zero user-side compilation. Everything must stay modular, type-safe, lazy-loaded, and beautiful.

**Approved Dependencies (all npm-ready, prebuilt WASM bundled, no compilation)**  
```bash
npm install z3-solver@latest          # High-level Z3Py-style API + quantifiers + arithmetic
npm install clingo-wasm@latest        # Simple async Clingo run() – perfect for constraints & models
# Existing (already pure TS/JS):
# tau-prolog
# Custom MiniSat-style SAT (kept & improved)
```

No other new runtime deps. All WASM is pre-shipped inside these packages.

### Phase 0: Preparation (1–2 hours)
1. Update `package.json`  
   ```json
   "dependencies": {
     "z3-solver": "^4.15.8",
     "clingo-wasm": "^0.3.2",
     ...
   }
   ```
2. Create `src/engines/types.ts` (if not present)  
   ```ts
   export interface FOLSolver {
     prove(premises: Formula[], goal: Formula, opts?: EngineOpts): Promise<ProofResult>;
     findModel(domains: DomainSpec[], formula: Formula): Promise<ModelResult>;
     findCounterexample(...): Promise<CounterexampleResult>;
     capabilities(): EngineCapabilities;
     init?(): Promise<void>;           // lazy
   }

   export interface EngineCapabilities {
     name: string;
     strength: 'high' | 'medium' | 'low';
     supportsArithmetic: boolean;
     supportsQuantifiers: boolean;
     supportsEquality: boolean;
     modelSize: 'small' | 'medium' | 'large';
   }
   ```
3. Ensure `container.ts` (DI) already supports lazy registration.

### Phase 1: Z3Engine – The Star (Elegance + Power) (4–6 hours)
Create `src/engines/z3.ts`

```ts
import { init } from 'z3-solver';
import type { FOLSolver, EngineCapabilities } from './types';
import { Formula, toZ3 } from '../ast/translators'; // existing or add tiny translator

export class Z3Engine implements FOLSolver {
  private ctx: any; // typed by z3-solver generics

  async init() {
    const { Context } = await init(); // prebuilt WASM, one-time
    this.ctx = new Context('mcplogic');
  }

  async prove(premises: Formula[], goal: Formula) {
    if (!this.ctx) await this.init();
    const solver = new this.ctx.Solver();
    // elegant translator (reuse or write once)
    premises.forEach(p => solver.add(toZ3(p, this.ctx)));
    solver.add(toZ3(goal.not(), this.ctx)); // refutation
    const res = await solver.check();
    // ... convert Z3 proof/model trace to our structured output
    return res === 'sat' ? { status: 'unsat' as const, trace: [...] } : { status: 'sat' };
  }

  capabilities(): EngineCapabilities {
    return {
      name: 'z3',
      strength: 'high',
      supportsArithmetic: true,
      supportsQuantifiers: true,
      supportsEquality: true,
      modelSize: 'large'
    };
  }
}
```

**Why elegant?**  
- High-level Z3Py-style API (no pointers, no memory management).  
- Generic typing prevents context mix-ups.  
- Lazy init + async everywhere.

### Phase 2: ClingoEngine (2–3 hours)
`src/engines/clingo.ts`

```ts
import clingo from 'clingo-wasm';
import type { FOLSolver } from './types';
import { toASP } from '../ast/translators';

export class ClingoEngine implements FOLSolver {
  async init() {
    await clingo.init(); // optional, prebuilt WASM
  }

  async prove(premises: Formula[], goal: Formula) {
    const program = toASP([...premises, goal.not()]);
    const result = await clingo.run(program);
    // parse answer sets → proof/model
    return { status: result.Models.length ? 'unsat' : 'sat', ... };
  }

  capabilities() {
    return { name: 'clingo', strength: 'high', ... modelSize: 'large', supportsConstraints: true };
  }
}
```

**Elegance**: Single `run()` call, restartable worker, perfect for incremental sessions.

### Phase 3: Upgrade Existing Engines (Tau-Prolog + Custom SAT) (3–4 hours)
- Add `init()` lazy pattern to both.
- Improve Tau-Prolog with better equality rewriting (simple Knuth-Bendix in pure TS, <200 LOC).
- Enhance MiniSat SAT engine with Tseitin + symmetry-breaking clauses (pure TS).

### Phase 4: Engine Federation & Auto-Selection (Elegant, 2 hours)
Update `EngineManager.ts`

```ts
const registry = new Map<string, () => Promise<FOLSolver>>([
  ['z3', () => import('./z3').then(m => new m.Z3Engine())],
  ['clingo', () => import('./clingo').then(m => new m.ClingoEngine())],
  ['prolog', () => import('./prolog').then(...)],
  ['sat', () => import('./sat').then(...)],
]);

export async function selectEngine(formula: Formula, preferred?: string) {
  if (preferred && registry.has(preferred)) return registry.get(preferred)!();
  // elegant score matrix
  const scores = await Promise.all([...registry.values()].map(async f => {
    const e = await f();
    return { engine: e, score: calculateScore(e.capabilities(), formula) };
  }));
  return scores.sort((a,b) => b.score - a.score)[0].engine;
}
```

`calculateScore` = tiny pure function based on arithmetic/quantifier presence, domain size, etc.

Add MCP config: `"engine": "auto" | "z3" | "clingo" | "prolog" | "sat"`

### Phase 5: Session & MCP Layer Integration (2 hours)
- All engines now support incremental assert/retract via fresh context/solver per session (Z3 Solver, Clingo program concatenation, Tau DB).
- Streaming progress via `AsyncIterable<Step>` (Z3/Clingo already support partial output).

### Phase 6: Testing & Benchmarks (4 hours)
- Add `tests/engines/z3.test.ts` and `clingo.test.ts` using existing harness (265+ tests).
- Include 20+ Pelletier problems + group/ring examples.
- CI: `npm test -- --grep "Z3|Clingo"`

### Phase 7: Documentation & Polish (3 hours)
- Update README: big table showing engine strengths (Z3 = high, arithmetic, large models).
- Playground: dropdown for engine selection.
- New section: “Why no Prover9 binary? Because Z3 + Clingo are more powerful, fully typed, and npm-only.”
- One-page “Adding a New Engine” guide (copy the Z3 pattern).

### Total Effort & Timeline (Solo Maintainer)
- **Week 1**: Phases 0–2 + basic tests → Z3 + Clingo live, Prover9-level power achieved.
- **Week 2**: Federation, Tau/SAT polish, full tests, docs.
- **Done in < 2 weeks**, < 25 hours total.

### Outcome
mcplogic now has:
- **Z3** for full SMT/FOL with arithmetic & quantifiers.
- **Clingo** for answer-set / constraint models.
- **Tau-Prolog + SAT** as fast lightweight fallbacks.
- Zero external binaries, zero self-compilation, 100% pure TypeScript elegance.
- Backward-compatible, session-aware, LLM-ready.

This is the cleanest, most future-proof path possible under the constraints. Start with `npm install z3-solver clingo-wasm` and the Z3Engine file — you’ll have a working high-power engine the same afternoon.

The foundation you already built (refactored parser, container, sessions, 80%+ test coverage) makes this trivial and beautiful.


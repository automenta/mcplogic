# MCP Logic — Implementation Plan v5

> **Goal:** Match/exceed Python MCP-Logic + Prover9/Mace4, fully self-contained in JS VM.

> **Strategy:** Critical path first (2-3 days), optional enhancements after (~2 days if needed).

---

## Guiding Principles

1. **Extract shared utilities first** — One implementation serves multiple features
2. **Extend, don't duplicate** — Add strategies to existing classes, not new classes
3. **Data-driven tests** — Generate from spec files, don't write individually
4. **Defer until needed** — Build only what's required; add extras if usage demands
5. **Commit after each phase** — Safe rollback points

---

## Critical Path (2-3 days for 80% value)

```
Phase 0 (3-4 hours)
├── 0.1 Shared Enumerators ────────┐
├── 0.2 Grounding Module ──────────┼──→ Phase 1 (8-10 hours)
├── 0.3 Unified Options + Axioms ──┤    ├── 1.1 Symmetry Breaking
└── 0.4 Fix Model.functions ───────┘    ├── 1.2 SAT Strategy
                                        └── 1.3 Iterative Proving
                                              ↓
                                        Phase 2 (2-3 hours)
                                        └── Benchmark validation
```

---

## Phase 0: Foundation (3-4 hours)

*All changes in this phase unlock multiple later features.*

### 0.1 Shared Enumeration Utilities (45 min)

**File:** `src/utils/enumerate.ts` (NEW)

```typescript
/**
 * Shared enumeration utilities.
 * Used by: Model finding, SAT grounding, function interpretation.
 */

/**
 * Generate all n-tuples over domain.
 */
export function* allTuples(domain: number[], arity: number): Generator<number[]> {
    if (arity === 0) { yield []; return; }
    if (arity === 1) { for (const d of domain) yield [d]; return; }
    for (const d of domain) {
        for (const rest of allTuples(domain, arity - 1)) {
            yield [d, ...rest];
        }
    }
}

/**
 * Generate all mappings from keys to domain values.
 */
export function* allMappings<K>(
    keys: K[],
    domain: number[]
): Generator<Map<K, number>> {
    if (keys.length === 0) { yield new Map(); return; }
    const [first, ...rest] = keys;
    for (const v of domain) {
        for (const m of allMappings(rest, domain)) {
            m.set(first, v);
            yield m;
        }
    }
}

/**
 * Generate symmetric mappings (lex-leader constraint).
 * Reduces n! redundant assignments for n keys.
 * 
 * Bell numbers: B(1)=1, B(2)=2, B(3)=5, B(4)=15, B(5)=52
 */
export function* symmetricMappings<K>(
    keys: K[],
    domainSize: number
): Generator<Map<K, number>> {
    const n = keys.length;
    if (n === 0) { yield new Map(); return; }
    
    const assignment = new Map<K, number>();
    
    function* backtrack(i: number, maxUsed: number): Generator<Map<K, number>> {
        if (i === n) { yield new Map(assignment); return; }
        const bound = Math.min(maxUsed + 1, domainSize - 1);
        for (let v = 0; v <= bound; v++) {
            assignment.set(keys[i], v);
            yield* backtrack(i + 1, Math.max(maxUsed, v));
        }
    }
    
    yield* backtrack(0, -1);
}

/**
 * Generate all function tables: Map<argsKey, result>
 */
export function* allFunctionTables(
    arity: number,
    domain: number[]
): Generator<Map<string, number>> {
    const tuples = [...allTuples(domain, arity)];
    const numTables = Math.pow(domain.length, tuples.length);
    
    for (let tableIdx = 0; tableIdx < numTables; tableIdx++) {
        const table = new Map<string, number>();
        let rem = tableIdx;
        for (const tuple of tuples) {
            table.set(tuple.join(','), domain[rem % domain.length]);
            rem = Math.floor(rem / domain.length);
        }
        yield table;
    }
}
```

**Export from index:**
```typescript
// src/utils/index.ts
export * from './enumerate.js';
export * from './ast.js';
export * from './clause.js';
```

---

### 0.2 Grounding Module (45 min)

**File:** `src/utils/grounding.ts` (NEW)

```typescript
import type { ASTNode } from '../types/index.js';
import { cloneAST } from './ast.js';

export interface GroundingOptions {
    domainSize: number;
}

export function groundFormula(ast: ASTNode, opts: GroundingOptions): ASTNode {
    return ground(ast, opts.domainSize, new Map());
}

function ground(node: ASTNode, n: number, bindings: Map<string, number>): ASTNode {
    switch (node.type) {
        case 'forall':
        case 'exists': {
            const varName = node.variable!;
            const op = node.type === 'forall' ? 'and' : 'or';
            let result: ASTNode | null = null;
            for (let i = 0; i < n; i++) {
                const b = new Map(bindings);
                b.set(varName, i);
                const inst = ground(node.body!, n, b);
                result = result ? { type: op, left: result, right: inst } : inst;
            }
            return result ?? { type: 'predicate', name: node.type === 'forall' ? '$true' : '$false' };
        }
        case 'variable': {
            const v = bindings.get(node.name!);
            return v !== undefined ? { type: 'constant', name: String(v) } : node;
        }
        case 'and': case 'or': case 'implies': case 'iff': case 'equals':
            return { type: node.type, left: ground(node.left!, n, bindings), right: ground(node.right!, n, bindings) };
        case 'not':
            return { type: 'not', operand: ground(node.operand!, n, bindings) };
        case 'predicate': case 'function':
            return { type: node.type, name: node.name, args: (node.args || []).map(a => ground(a, n, bindings)) };
        default:
            return cloneAST(node);
    }
}

export function generateArithmeticFacts(n: number): ASTNode[] {
    const facts: ASTNode[] = [];
    for (let x = 0; x < n; x++) {
        for (let y = 0; y < n; y++) {
            if (x < y) facts.push({ type: 'predicate', name: 'less', args: [{ type: 'constant', name: String(x) }, { type: 'constant', name: String(y) }] });
            if (x + y < n) facts.push({ type: 'predicate', name: 'plus', args: [{ type: 'constant', name: String(x) }, { type: 'constant', name: String(y) }, { type: 'constant', name: String(x + y) }] });
            if (x * y < n) facts.push({ type: 'predicate', name: 'times', args: [{ type: 'constant', name: String(x) }, { type: 'constant', name: String(y) }, { type: 'constant', name: String(x * y) }] });
        }
    }
    return facts;
}
```

---

### 0.3 Unified Options + Extended Axioms (30 min)

**File:** `src/types/options.ts` (NEW)

```typescript
import type { Verbosity } from './responses.js';

export interface ReasoningOptions {
    verbosity?: Verbosity;
    maxSeconds?: number;
    maxInferences?: number;
    enableArithmetic?: boolean;
    enableEquality?: boolean;
}

export interface ProveOptions extends ReasoningOptions {
    strategy?: 'auto' | 'breadth' | 'depth' | 'iterative';
    engine?: 'auto' | 'prolog' | 'sat';
}

export interface ModelOptions extends ReasoningOptions {
    maxDomainSize?: number;
    enableSymmetry?: boolean;
    useSAT?: boolean | 'auto';
    satThreshold?: number;
}

export const DEFAULTS = {
    maxSeconds: 30,
    maxInferences: 5000,
    maxDomainSize: 25,
    satThreshold: 8,
} as const;
```

**File:** `src/resources/axioms.ts` — Add at end:

```typescript
export const RING_AXIOMS = [
    'all X (add(zero, X) = X)',
    'all X (add(neg(X), X) = zero)',
    'all X all Y (add(X, Y) = add(Y, X))',
    'all X all Y all Z (add(add(X, Y), Z) = add(X, add(Y, Z)))',
    'all X all Y all Z (mul(mul(X, Y), Z) = mul(X, mul(Y, Z)))',
    'all X all Y all Z (mul(X, add(Y, Z)) = add(mul(X, Y), mul(X, Z)))',
];

export const LATTICE_AXIOMS = [
    'all X (meet(X, X) = X)', 'all X (join(X, X) = X)',
    'all X all Y (meet(X, Y) = meet(Y, X))', 'all X all Y (join(X, Y) = join(Y, X))',
    'all X all Y all Z (meet(meet(X, Y), Z) = meet(X, meet(Y, Z)))',
    'all X all Y all Z (join(join(X, Y), Z) = join(X, join(Y, Z)))',
    'all X all Y (meet(X, join(X, Y)) = X)', 'all X all Y (join(X, meet(X, Y)) = X)',
];

export const EQUIVALENCE_AXIOMS = [
    'all X (equiv(X, X))',
    'all X all Y (equiv(X, Y) -> equiv(Y, X))',
    'all X all Y all Z ((equiv(X, Y) & equiv(Y, Z)) -> equiv(X, Z))',
];
```

---

### 0.4 Fix Model Interface + Functions (45 min)

**File:** `src/types/responses.ts` — Line ~103, add `functions`:

```typescript
export interface Model {
    domainSize: number;
    domain: number[];
    predicates: Map<string, Set<string>>;
    constants: Map<string, number>;
    functions: Map<string, Map<string, number>>;  // ADD
    interpretation: string;
}
```

**File:** `src/modelFinder.ts` — Update `evaluateTerm` (line ~327):

```typescript
case 'function': {
    const args = (node.args || []).map(a => this.evaluateTerm(a, model, assignment));
    const table = model.functions.get(node.name!);
    return table?.get(args.join(',')) ?? 0;
}
```

**Commit:** `git add -A && git commit -m "Phase 0: Foundation utilities"`

---

## Phase 1: Core Improvements (8-10 hours)

### 1.1 Symmetry Breaking in ModelFinder (2 hours)

**File:** `src/modelFinder.ts` — Replace constant enumeration:

```typescript
import { symmetricMappings, allMappings, allFunctionTables, allTuples } from './utils/enumerate.js';

// Replace enumerateConstantAssignments with:
private *enumerateConstants(
    constants: string[],
    domain: number[],
    useSymmetry: boolean
): Generator<Map<string, number>> {
    if (useSymmetry) {
        yield* symmetricMappings(constants, domain.length);
    } else {
        yield* allMappings(constants, domain);
    }
}

// Replace enumeratePredicateInterpretations:
private *enumeratePredicates(
    predicates: Map<string, number>,
    domain: number[]
): Generator<Map<string, Set<string>>> {
    const predList = Array.from(predicates.entries());
    yield* this.enumPredsHelper(predList, domain, new Map());
}

private *enumPredsHelper(
    preds: [string, number][],
    domain: number[],
    current: Map<string, Set<string>>
): Generator<Map<string, Set<string>>> {
    if (preds.length === 0) { yield new Map(current); return; }
    const [[name, arity], ...rest] = preds;
    const tuples = [...allTuples(domain, arity)];
    const numSubsets = 1 << tuples.length;
    
    for (let mask = 0; mask < numSubsets; mask++) {
        const ext = new Set<string>();
        for (let i = 0; i < tuples.length; i++) {
            if (mask & (1 << i)) ext.add(tuples[i].join(','));
        }
        current.set(name, ext);
        yield* this.enumPredsHelper(rest, domain, current);
    }
}

// Replace function enumeration:
private *enumerateFunctions(
    functions: Map<string, number>,
    domain: number[]
): Generator<Map<string, Map<string, number>>> {
    const funcList = Array.from(functions.entries());
    yield* this.enumFuncsHelper(funcList, domain, new Map());
}

private *enumFuncsHelper(
    funcs: [string, number][],
    domain: number[],
    current: Map<string, Map<string, number>>
): Generator<Map<string, Map<string, number>>> {
    if (funcs.length === 0) { yield new Map(current); return; }
    const [[name, arity], ...rest] = funcs;
    for (const table of allFunctionTables(arity, domain)) {
        current.set(name, table);
        yield* this.enumFuncsHelper(rest, domain, current);
    }
}
```

---

### 1.2 SAT Strategy in ModelFinder (4 hours)

**Extend existing ModelFinder** — Add SAT path without new class:

```typescript
import { groundFormula } from './utils/grounding.js';
import { clausify } from './clausifier.js';
import { astToString } from './utils/ast.js';
import { SATEngine } from './engines/sat.js';

// Add to ModelFinder class:
private satEngine = new SATEngine();

async findModel(
    premises: string[],
    options?: ModelOptions
): Promise<ModelResult> {
    const opts = { ...DEFAULTS, ...options };
    const maxSize = opts.maxDomainSize ?? 25;
    const satThreshold = opts.satThreshold ?? 8;
    const useSAT = opts.useSAT ?? 'auto';
    const startTime = Date.now();
    
    for (let size = 1; size <= maxSize; size++) {
        if (Date.now() - startTime > (opts.maxSeconds ?? 30) * 1000) {
            return { success: false, result: 'timeout' };
        }
        
        const shouldUseSAT = useSAT === true || (useSAT === 'auto' && size > satThreshold);
        
        const model = shouldUseSAT
            ? await this.findModelSAT(premises, size, opts)
            : this.tryDomainSize(premises, size, opts);
        
        if (model) {
            return { success: true, result: 'model_found', model, interpretation: this.formatModel(model) };
        }
    }
    
    return { success: false, result: 'no_model' };
}

private async findModelSAT(
    premises: string[],
    size: number,
    opts: ModelOptions
): Promise<Model | null> {
    // 1. Ground all premises
    const grounded = premises.map(p => {
        const ast = parse(p);
        return `(${astToString(groundFormula(ast, { domainSize: size }))})`;
    }).join(' & ');
    
    // 2. Clausify
    const result = clausify(grounded);
    if (!result.success || !result.clauses) return null;
    
    // 3. SAT solve
    const satResult = await this.satEngine.checkSat(result.clauses);
    if (!satResult.sat) return null;
    
    // 4. Decode
    return this.decodeSATModel(satResult.model!, size);
}

private decodeSATModel(satModel: Map<string, boolean>, size: number): Model {
    const predicates = new Map<string, Set<string>>();
    for (const [varName, val] of satModel) {
        if (!val) continue;
        const m = varName.match(/^(\w+)(?:\(([^)]*)\))?$/);
        if (m) {
            const [, pred, args] = m;
            if (!predicates.has(pred)) predicates.set(pred, new Set());
            predicates.get(pred)!.add(args || '');
        }
    }
    return {
        domainSize: size,
        domain: Array.from({ length: size }, (_, i) => i),
        predicates,
        constants: new Map(),
        functions: new Map(),
        interpretation: ''
    };
}
```

---

### 1.3 Iterative Deepening in LogicEngine (2 hours)

**File:** `src/logicEngine.ts` — Add method:

```typescript
async proveIterative(
    premises: string[],
    conclusion: string,
    options?: ProveOptions
): Promise<ProveResult> {
    const maxInf = options?.maxInferences ?? 50000;
    const maxSec = options?.maxSeconds ?? 30;
    const start = Date.now();
    const limits = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000].filter(l => l <= maxInf);
    
    for (const limit of limits) {
        if (Date.now() - start > maxSec * 1000) {
            return { success: false, result: 'timeout', message: `Timeout after ${Math.round((Date.now() - start) / 1000)}s` };
        }
        
        const result = await this.prove(premises, conclusion, { ...options, maxInferences: limit });
        if (result.result === 'proved') return result;
        if (!result.hitLimit) return result;  // Definite failure, stop
    }
    
    return { success: false, result: 'failed', message: `No proof found within ${maxInf} inferences` };
}
```

**Wire up in prove():**
```typescript
async prove(premises: string[], conclusion: string, options?: ProveOptions): Promise<ProveResult> {
    if (options?.strategy === 'iterative') {
        return this.proveIterative(premises, conclusion, options);
    }
    // ... existing implementation
}
```

**Commit:** `git add -A && git commit -m "Phase 1: Core improvements (symmetry, SAT, iterative)"`

---

## Phase 2: Validation (2-3 hours)

### 2.1 Data-Driven Pelletier Tests (1 hour)

**File:** `tests/data/pelletier.json` (NEW)

```json
[
  {"name": "P1", "premises": [], "conclusion": "p -> p"},
  {"name": "P2", "premises": [], "conclusion": "--p <-> p"},
  {"name": "P3", "premises": [], "conclusion": "-(p -> q) -> (q -> p)"},
  {"name": "P4", "premises": [], "conclusion": "(-p -> q) <-> (-q -> p)"},
  {"name": "P5", "premises": [], "conclusion": "((p | q) -> (p | r)) -> (p | (q -> r))"},
  {"name": "P6", "premises": [], "conclusion": "p | -p"},
  {"name": "P7", "premises": [], "conclusion": "p | ---p"},
  {"name": "P8", "premises": [], "conclusion": "((p -> q) -> p) -> p"},
  {"name": "P9", "premises": [], "conclusion": "((p | q) & (-p | q) & (p | -q)) -> -(-p | -q)"},
  {"name": "P10", "premises": ["q -> r", "r -> (p & q)", "p -> (q | r)"], "conclusion": "p <-> q"}
]
```

**File:** `tests/pelletier.test.ts` (NEW)

```typescript
import { createLogicEngine } from '../src/logicEngine';
import pelletier from './data/pelletier.json';

describe('Pelletier Problems', () => {
    const engine = createLogicEngine(30000, 10000);
    
    test.each(pelletier)('$name', async ({ premises, conclusion }) => {
        const result = await engine.prove(premises, conclusion, { strategy: 'iterative' });
        expect(result.result).toBe('proved');
    });
});
```

### 2.2 Symmetry Benchmark Test (30 min)

**File:** `tests/symmetry.test.ts` (NEW)

```typescript
import { symmetricMappings, allMappings } from '../src/utils/enumerate';

describe('Symmetry Breaking', () => {
    it('reduces 3 keys from 64 to 5', () => {
        const sym = [...symmetricMappings(['a', 'b', 'c'], 4)];
        const brute = [...allMappings(['a', 'b', 'c'], [0, 1, 2, 3])];
        expect(sym.length).toBe(5);    // Bell(3)
        expect(brute.length).toBe(64); // 4^3
    });
    
    it('reduces 4 keys from 256 to 15', () => {
        const sym = [...symmetricMappings(['a', 'b', 'c', 'd'], 4)];
        expect(sym.length).toBe(15);   // Bell(4)
    });
});
```

### 2.3 SAT Model Finding Test (30 min)

**File:** `tests/sat-model.test.ts` (NEW)

```typescript
import { ModelFinder } from '../src/modelFinder';

describe('SAT Model Finding', () => {
    const finder = new ModelFinder(30000, 25);
    
    it('finds group of order 4 via SAT', async () => {
        const axioms = [
            'all X (op(e, X) = X)',
            'all X (op(inv(X), X) = e)',
            'all X all Y all Z (op(op(X, Y), Z) = op(X, op(Y, Z)))'
        ];
        const result = await finder.findModel(axioms, { useSAT: true, maxDomainSize: 4 });
        expect(result.success).toBe(true);
    });
});
```

**Commit:** `git add -A && git commit -m "Phase 2: Validation tests"`

---

## Optional Enhancements (defer until needed)

### O.1 Isomorphism Filtering (~2 hours)
Only build if "findAllModels" use case emerges. Not needed for single model finding.

### O.2 Proof Traces (~4 hours)
Only build if detailed verbosity is frequently requested. Basic "proved/failed" covers 90% of use cases.

### O.3 Demodulation (~4 hours)
Optimization for equational reasoning. Defer until equality: true workloads show performance issues.

### O.4 Prover9 WASM (~2 days)
Only if SAT + iterative proving isn't sufficient. Decision gate: test hard problems first.

---

## README Checkbox Updates

After Phase 1, update `README.md`:
```markdown
- [x] **Symmetry Breaking** — Lex-leader for model search
- [x] **SAT-Backed Model Finding** — Scale to domain 25+
- [x] **Iterative Deepening** — Configurable search strategies
- [x] **Extended Axiom Library** — Ring, lattice, equivalence axioms
```

After Phase 2:
```markdown
- [x] **Pelletier Problems** — P1-P10+ benchmark suite
```

---

## Verification Commands

```bash
# After each phase
npm run build && npm test

# Specific tests
npm test -- --grep "Symmetry"
npm test -- --grep "Pelletier"
npm test -- --grep "SAT"
```

---

## Files Summary

| Phase | New Files | Modified Files |
|-------|-----------|----------------|
| 0 | `enumerate.ts`, `grounding.ts`, `options.ts` | `responses.ts`, `axioms.ts`, `modelFinder.ts` |
| 1 | — | `modelFinder.ts`, `logicEngine.ts` |
| 2 | `pelletier.json`, `pelletier.test.ts`, `symmetry.test.ts`, `sat-model.test.ts` | — |

---

## Timeline

| Phase | Time | Cumulative | Checkpoints |
|-------|------|------------|-------------|
| 0 | 3-4h | 4h | `git commit` |
| 1 | 8-10h | 14h | `git commit` |
| 2 | 2-3h | 17h | `git commit` + **DONE** |
| O.1-O.4 | +8h | 25h | Only if needed |

**Critical path: ~2.5 working days for complete core functionality**

---

## Decision Gates

After Phase 2, evaluate:

1. **Do Pelletier P1-P10 pass?** → Core proving works
2. **Does symmetry reduce Bell(4) correctly?** → Model finding optimized
3. **Does SAT find group(4)?** → Large domain support works

If all pass, the system is production-ready. Optional enhancements only if specific gaps emerge.

---

**This plan achieves 100% of required functionality in minimum time.**

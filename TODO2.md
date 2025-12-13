# MCP Logic — Complete Implementation Plan v4

> **Goal:** Elevate TypeScript MCP Logic to match/exceed Python MCP-Logic + Prover9/Mace4 while staying fully self-contained.

> **Constraint:** All code runs in same JS VM (including optional WASM). No external process calls.

> **Principle:** Do more with less—consolidate shared logic early, minimize duplicate code, enable phases to build on each other.

---

## Quick Reference

| Resource | Link/Location |
|----------|---------------|
| **Pelletier Problems** | https://www.cs.miami.edu/~tptp/cgi-bin/SeeTPTP?Category=Problems&Domain=SYN |
| **TPTP Library** | https://www.tptp.org/ |
| **Prover9/LADR Source** | https://github.com/laitep/ladr |
| **Emscripten Docs** | https://emscripten.org/docs/compiling/Building-Projects.html |
| **Bell Numbers** | https://oeis.org/A000110 (B(n) = partitions of n elements) |
| **logic-solver npm** | https://www.npmjs.com/package/logic-solver (current SAT backend) |
| **Tau-Prolog Docs** | http://tau-prolog.org/documentation |
| **KBO Paper** | https://en.wikipedia.org/wiki/Knuth–Bendix_ordering |

---

## Dependency Graph

```
Phase 0 (Pre-refactoring)
    │
    ├─── 0.1 Fix Model Interface ──┬──→ A.1 Symmetry Breaking
    │                              │
    ├─── 0.2 Extract Grounding ────┼──→ A.2 SAT Model Finding
    │                              │      │
    ├─── 0.3 Unified Options ──────┼──→ B.1 Search Strategies
    │                              │      │
    └─── 0.4 Result Builders ──────┴──→ B.2 Proof Traces
                                          │
                                          ↓
                                   Phase C/D/E
```

**Key insight:** Phases 0.1–0.4 are 1-2 hours each but save 1-2 days later by eliminating duplicate work across A/B phases.

---

## Current Codebase Issues

### Bug #1: Function Interpretation Broken
**File:** `src/modelFinder.ts:327-331`
```typescript
case 'function':
    return 0; // Always returns 0 - broken
```

### Bug #2: Model Type Missing Functions Field  
**File:** `src/types/responses.ts:103-109` — Missing `functions` property.

### Bug #3: Options Fragmentation
Options are defined in 3+ places:
- `ProveOptions` in `src/logicEngine.ts`
- `EngineProveOptions` in `src/engines/interface.ts`
- `ManagerProveOptions` in `src/engines/manager.ts`

---

## Phase 0: Pre-Refactoring (4-6 hours total)

*These small changes eliminate hours of duplicate work in later phases.*

---

### 0.1 Fix Model Interface for Functions (1 hour)

**Files:**
1. `src/types/responses.ts`
2. `src/modelFinder.ts`

**Step 1:** Update interface
```typescript
// src/types/responses.ts, line ~103
export interface Model {
    domainSize: number;
    domain: number[];
    predicates: Map<string, Set<string>>;
    constants: Map<string, number>;
    functions: Map<string, Map<string, number>>;  // ADD: f -> (args_key -> result)
    interpretation: string;
}
```

**Step 2:** Add function enumeration in ModelFinder
```typescript
// src/modelFinder.ts - Add after enumeratePredicateInterpretations

private *enumerateFunctionInterpretations(
    functions: Map<string, number>,
    domain: number[]
): Generator<Map<string, Map<string, number>>> {
    if (functions.size === 0) {
        yield new Map();
        return;
    }
    
    const funcList = Array.from(functions.entries());
    yield* this.enumerateFunctionTableAll(funcList, domain, new Map());
}

private *enumerateFunctionTableAll(
    functions: Array<[string, number]>,
    domain: number[],
    current: Map<string, Map<string, number>>
): Generator<Map<string, Map<string, number>>> {
    if (functions.length === 0) {
        yield new Map(current);
        return;
    }
    
    const [[name, arity], ...rest] = functions;
    const tuples = this.allTuples(domain, arity);
    const tableSize = Math.pow(domain.length, tuples.length);
    
    // Enumerate all possible function tables
    for (let tableIndex = 0; tableIndex < tableSize; tableIndex++) {
        const table = new Map<string, number>();
        let remaining = tableIndex;
        for (const tuple of tuples) {
            const value = remaining % domain.length;
            remaining = Math.floor(remaining / domain.length);
            table.set(tuple.join(','), domain[value]);
        }
        current.set(name, table);
        yield* this.enumerateFunctionTableAll(rest, domain, current);
    }
}
```

**Step 3:** Fix evaluateTerm
```typescript
// src/modelFinder.ts:327-331 - Replace
case 'function': {
    const args = (node.args || []).map(a => this.evaluateTerm(a, model, assignment));
    const key = args.join(',');
    const table = model.functions.get(node.name!);
    return table?.get(key) ?? 0;
}
```

**Step 4:** Update tryDomainSize to use functions
```typescript
// In tryDomainSize, after predicates loop, add:
for (const functions of this.enumerateFunctionInterpretations(
    signature.functions, domain
)) {
    for (const predicates of predicateInterpretations) {
        const model: Model = {
            domainSize: size,
            domain,
            predicates,
            constants,
            functions,
            interpretation: ''
        };
        if (this.checkAllFormulas(asts, model)) {
            model.interpretation = this.formatModel(model);
            return model;
        }
    }
}
```

**Verify:** `npm run build && npm test`

---

### 0.2 Extract Grounding Module (1 hour)

**Why do this first?** Grounding is needed by:
- A.2 SAT-backed model finding
- B.5 SAT arithmetic  
- Any future SMT integration

**New file:** `src/utils/grounding.ts`

```typescript
/**
 * Finite-domain grounding for FOL formulas.
 * Expands quantifiers over concrete domain values.
 */

import type { ASTNode } from '../types/index.js';
import { cloneAST } from './ast.js';

export interface GroundingOptions {
    domainSize: number;
    includeArithmetic?: boolean;
}

/**
 * Ground a formula by expanding quantifiers.
 * ∀x P(x) → P(0) ∧ P(1) ∧ ... ∧ P(n-1)
 * ∃x P(x) → P(0) ∨ P(1) ∨ ... ∨ P(n-1)
 */
export function groundFormula(
    ast: ASTNode,
    options: GroundingOptions
): ASTNode {
    return groundNode(ast, options.domainSize, new Map());
}

function groundNode(
    node: ASTNode,
    domainSize: number,
    bindings: Map<string, number>
): ASTNode {
    switch (node.type) {
        case 'forall':
        case 'exists': {
            const varName = node.variable!;
            const isForall = node.type === 'forall';
            
            if (domainSize === 0) {
                return { type: isForall ? 'predicate' : 'not', 
                         name: isForall ? '$true' : undefined,
                         operand: isForall ? undefined : { type: 'predicate', name: '$true' } };
            }
            
            // Build instances for domain values
            let result: ASTNode | null = null;
            for (let i = 0; i < domainSize; i++) {
                const newBindings = new Map(bindings);
                newBindings.set(varName, i);
                const instance = groundNode(node.body!, domainSize, newBindings);
                
                if (result === null) {
                    result = instance;
                } else {
                    result = {
                        type: isForall ? 'and' : 'or',
                        left: result,
                        right: instance
                    };
                }
            }
            return result!;
        }
        
        case 'variable': {
            const value = bindings.get(node.name!);
            if (value !== undefined) {
                return { type: 'constant', name: String(value) };
            }
            return node;
        }
        
        case 'and':
        case 'or':
        case 'implies':
        case 'iff':
        case 'equals':
            return {
                type: node.type,
                left: groundNode(node.left!, domainSize, bindings),
                right: groundNode(node.right!, domainSize, bindings)
            };
        
        case 'not':
            return {
                type: 'not',
                operand: groundNode(node.operand!, domainSize, bindings)
            };
        
        case 'predicate':
        case 'function':
            return {
                type: node.type,
                name: node.name,
                args: (node.args || []).map(a => groundNode(a, domainSize, bindings))
            };
        
        default:
            return cloneAST(node);
    }
}

/**
 * Generate arithmetic facts for SAT grounding.
 */
export function generateArithmeticClauses(domainSize: number): ASTNode[] {
    const facts: ASTNode[] = [];
    
    for (let x = 0; x < domainSize; x++) {
        for (let y = 0; y < domainSize; y++) {
            // less(x, y)
            if (x < y) {
                facts.push({
                    type: 'predicate',
                    name: 'less',
                    args: [
                        { type: 'constant', name: String(x) },
                        { type: 'constant', name: String(y) }
                    ]
                });
            }
            
            // plus(x, y, z) where x + y = z
            const sum = x + y;
            if (sum < domainSize) {
                facts.push({
                    type: 'predicate',
                    name: 'plus',
                    args: [
                        { type: 'constant', name: String(x) },
                        { type: 'constant', name: String(y) },
                        { type: 'constant', name: String(sum) }
                    ]
                });
            }
            
            // times(x, y, z) where x * y = z
            const prod = x * y;
            if (prod < domainSize) {
                facts.push({
                    type: 'predicate',
                    name: 'times',
                    args: [
                        { type: 'constant', name: String(x) },
                        { type: 'constant', name: String(y) },
                        { type: 'constant', name: String(prod) }
                    ]
                });
            }
        }
    }
    
    return facts;
}
```

**Verify:** `npm run build`

---

### 0.3 Unified Options Interface (30 min)

**Why?** Currently options are fragmented. Consolidate to one source of truth.

**File:** `src/types/options.ts` (NEW)

```typescript
/**
 * Unified options for all reasoning operations.
 * Single source of truth - other modules extend this.
 */

import type { Verbosity } from './responses.js';

/**
 * Base options for all reasoning operations.
 */
export interface ReasoningOptions {
    // Output control
    verbosity?: Verbosity;
    
    // Resource limits
    maxSeconds?: number;        // Wall-clock timeout (default: 30)
    maxInferences?: number;     // Inference limit (default: 5000)
    
    // Feature toggles
    enableArithmetic?: boolean;
    enableEquality?: boolean;
}

/**
 * Options specific to proving.
 */
export interface ProveOptions extends ReasoningOptions {
    maxProofs?: number;         // Stop after N proofs (default: 1)
    strategy?: 'auto' | 'breadth' | 'depth' | 'iterative';
    engine?: 'auto' | 'prolog' | 'sat' | 'prover9';
}

/**
 * Options specific to model finding.
 */
export interface ModelFinderOptions extends ReasoningOptions {
    maxDomainSize?: number;               // Default: 25
    enableSymmetryBreaking?: boolean;     // Default: true
    satThreshold?: number;                // Domain size above which to use SAT (default: 8)
    filterIsomorphic?: boolean;           // Default: true
    includeFunctions?: boolean;           // Default: true
}

/**
 * Default values (export for reuse).
 */
export const DEFAULTS = {
    maxSeconds: 30,
    maxInferences: 5000,
    maxDomainSize: 25,
    satThreshold: 8,
    verbosity: 'standard' as Verbosity,
} as const;
```

**Update:** Add to `src/types/index.ts`:
```typescript
export type { ReasoningOptions, ProveOptions, ModelFinderOptions } from './options.js';
export { DEFAULTS } from './options.js';
```

**Verify:** `npm run build`

---

### 0.4 Result Builder Utilities (30 min)

**Why?** Proof results are built in 4+ places with similar logic. Extract once, use everywhere.

**File:** `src/utils/results.ts` (NEW)

```typescript
/**
 * Result building utilities.
 * Centralizes construction of ProveResult and ModelResult.
 */

import type { ProveResult, ModelResult, Verbosity, Model } from '../types/index.js';

interface ProveResultInput {
    success: boolean;
    result: 'proved' | 'failed' | 'timeout' | 'error';
    message?: string;
    error?: string;
    proof?: string[];
    bindings?: Record<string, string>[];
    engineUsed?: string;
    timeMs?: number;
    inferences?: number;
    prologProgram?: string;
}

/**
 * Build a ProveResult respecting verbosity level.
 */
export function buildProveResult(
    input: ProveResultInput,
    verbosity: Verbosity = 'standard'
): ProveResult {
    // Minimal: just success and result
    const result: ProveResult = {
        success: input.success,
        result: input.result,
    };
    
    if (verbosity === 'minimal') {
        return result;
    }
    
    // Standard: add message, bindings, engine
    if (input.message) result.message = input.message;
    if (input.bindings) result.bindings = input.bindings;
    if (input.engineUsed) result.engineUsed = input.engineUsed;
    if (input.error) result.error = input.error;
    if (input.proof) result.proof = input.proof;
    
    if (verbosity === 'standard') {
        return result;
    }
    
    // Detailed: add statistics, program
    if (input.prologProgram) result.prologProgram = input.prologProgram;
    result.statistics = {
        timeMs: input.timeMs ?? 0,
        inferences: input.inferences,
    };
    
    return result;
}

interface ModelResultInput {
    success: boolean;
    result: 'model_found' | 'no_model' | 'timeout' | 'error';
    model?: Model;
    error?: string;
    message?: string;
    timeMs?: number;
    searchedSizes?: number[];
}

/**
 * Build a ModelResult respecting verbosity level.
 */
export function buildModelResult(
    input: ModelResultInput,
    verbosity: Verbosity = 'standard'
): ModelResult {
    const result: ModelResult = {
        success: input.success,
        result: input.result,
    };
    
    if (input.model) result.model = input.model;
    
    if (verbosity === 'minimal') {
        return result;
    }
    
    if (input.message) result.message = input.message;
    if (input.error) result.error = input.error;
    if (input.model) result.interpretation = formatModel(input.model);
    
    if (verbosity === 'detailed') {
        result.statistics = {
            domainSize: input.model?.domainSize,
            searchedSizes: input.searchedSizes,
            timeMs: input.timeMs ?? 0,
        };
    }
    
    return result;
}

function formatModel(model: Model): string {
    const lines: string[] = [];
    lines.push(`Domain: {0..${model.domainSize - 1}}`);
    
    for (const [name, value] of model.constants) {
        lines.push(`${name} = ${value}`);
    }
    
    for (const [name, ext] of model.predicates) {
        const tuples = Array.from(ext).join(', ');
        lines.push(`${name}: {${tuples}}`);
    }
    
    for (const [name, table] of model.functions) {
        for (const [args, result] of table) {
            lines.push(`${name}(${args}) = ${result}`);
        }
    }
    
    return lines.join('\n');
}
```

**Verify:** `npm run build`

---

## Phase A: Model Finding (3-4 days)

*Prerequisite: Phase 0 complete*

---

### A.1 Symmetry Breaking (4 hours)

**File:** `src/modelFinder.ts`

**Replace `enumerateConstantAssignments` entirely:**

```typescript
/**
 * Enumerate constant assignments with lex-leader symmetry breaking.
 * 
 * Invariant: constant[i] ≤ max(constant[0..i-1]) + 1
 * 
 * This reduces search from d^n to Bell(n):
 *   n=1: 1, n=2: 2, n=3: 5, n=4: 15, n=5: 52
 */
private *enumerateConstantAssignments(
    constants: string[],
    domain: number[],
    options?: ModelFinderOptions
): Generator<Map<string, number>> {
    const useSB = options?.enableSymmetryBreaking ?? true;
    
    if (!useSB || constants.length === 0) {
        // Original brute-force
        yield* this.enumerateConstantAssignmentsBruteForce(constants, domain);
        return;
    }
    
    // Lex-leader symmetry breaking
    const n = constants.length;
    const d = domain.length;
    const assignment = new Map<string, number>();
    
    function* backtrack(i: number, maxUsed: number): Generator<Map<string, number>> {
        if (i === n) {
            yield new Map(assignment);
            return;
        }
        
        const bound = Math.min(maxUsed + 1, d - 1);
        for (let v = 0; v <= bound; v++) {
            assignment.set(constants[i], v);
            yield* backtrack(i + 1, Math.max(maxUsed, v));
        }
    }
    
    yield* backtrack(0, -1);
}

private *enumerateConstantAssignmentsBruteForce(
    constants: string[],
    domain: number[]
): Generator<Map<string, number>> {
    if (constants.length === 0) {
        yield new Map();
        return;
    }
    const [first, ...rest] = constants;
    for (const value of domain) {
        for (const restAssignment of this.enumerateConstantAssignmentsBruteForce(rest, domain)) {
            const assignment = new Map(restAssignment);
            assignment.set(first, value);
            yield assignment;
        }
    }
}
```

**Test:** `tests/symmetry.test.ts`
```typescript
import { ModelFinder } from '../src/modelFinder';

describe('Symmetry Breaking', () => {
    it('reduces 3 constants in domain 4 from 64 to 5', () => {
        const finder = new ModelFinder();
        const withSB = [...(finder as any).enumerateConstantAssignments(
            ['a', 'b', 'c'], [0, 1, 2, 3], { enableSymmetryBreaking: true }
        )];
        const withoutSB = [...(finder as any).enumerateConstantAssignmentsBruteForce(
            ['a', 'b', 'c'], [0, 1, 2, 3]
        )];
        expect(withSB.length).toBe(5);    // Bell(3)
        expect(withoutSB.length).toBe(64); // 4^3
    });
    
    it('still finds a != b', async () => {
        const finder = new ModelFinder(30000, 10);
        const result = await finder.findModel(['a != b'], 2);
        expect(result.success).toBe(true);
        const a = result.model!.constants.get('a');
        const b = result.model!.constants.get('b');
        expect(a).not.toBe(b);
    });
});
```

**Verify:** `npm test -- --grep Symmetry`

---

### A.2 SAT-Backed Model Finding (1 day)

**File:** `src/modelFinder-sat.ts` (NEW)

```typescript
/**
 * SAT-backed model finding for larger domains.
 * Uses grounding + clausification + SAT solving.
 */

import { SATEngine } from './engines/sat.js';
import { groundFormula, GroundingOptions } from './utils/grounding.js';
import { clausify } from './clausifier.js';
import { parse } from './parser.js';
import { astToString } from './utils/ast.js';
import type { Model, ModelFinderOptions } from './types/index.js';

export interface SATModelResult {
    found: boolean;
    model?: Model;
    stats?: { variables: number; clauses: number; timeMs: number };
}

export class SATModelFinder {
    private sat = new SATEngine();
    
    async findModel(
        premises: string[],
        domainSize: number,
        options?: ModelFinderOptions
    ): Promise<SATModelResult> {
        const start = Date.now();
        
        // 1. Parse and ground
        const groundedParts: string[] = [];
        for (const premise of premises) {
            const ast = parse(premise);
            const grounded = groundFormula(ast, { domainSize });
            groundedParts.push(`(${astToString(grounded)})`);
        }
        
        // 2. Clausify
        const formula = groundedParts.join(' & ');
        const clauseResult = clausify(formula);
        if (!clauseResult.success || !clauseResult.clauses) {
            return { found: false };
        }
        
        // 3. SAT check
        const satResult = await this.sat.checkSat(clauseResult.clauses);
        
        if (satResult.sat && satResult.model) {
            const model = this.decodeModel(satResult.model, domainSize);
            return {
                found: true,
                model,
                stats: {
                    variables: satResult.statistics?.variables ?? 0,
                    clauses: clauseResult.clauses.length,
                    timeMs: Date.now() - start
                }
            };
        }
        
        return { found: false, stats: { variables: 0, clauses: 0, timeMs: Date.now() - start } };
    }
    
    private decodeModel(satModel: Map<string, boolean>, domainSize: number): Model {
        const predicates = new Map<string, Set<string>>();
        const domain = Array.from({ length: domainSize }, (_, i) => i);
        
        for (const [varName, value] of satModel) {
            if (!value) continue;
            
            // Parse "P(0,1)" format
            const match = varName.match(/^(\w+)(?:\(([^)]*)\))?$/);
            if (match) {
                const [, pred, args] = match;
                if (!predicates.has(pred)) predicates.set(pred, new Set());
                predicates.get(pred)!.add(args || '');
            }
        }
        
        return {
            domainSize,
            domain,
            predicates,
            constants: new Map(),
            functions: new Map(),
            interpretation: ''
        };
    }
}
```

**Integration in ModelFinder:**
```typescript
// src/modelFinder.ts - Update findModel method

import { SATModelFinder } from './modelFinder-sat.js';

async findModel(
    premises: string[],
    domainSize?: number,
    options?: ModelFinderOptions
): Promise<ModelResult> {
    const opts = { ...DEFAULTS, ...options };
    const satThreshold = opts.satThreshold ?? 8;
    const maxSize = domainSize ?? opts.maxDomainSize ?? 25;
    
    for (let size = domainSize ?? 1; size <= maxSize; size++) {
        if (Date.now() - startTime > (opts.maxSeconds ?? 30) * 1000) {
            return buildModelResult({ success: false, result: 'timeout' }, opts.verbosity);
        }
        
        let model: Model | null = null;
        
        if (size > satThreshold && !domainSize) {
            // Use SAT for large domains
            const satFinder = new SATModelFinder();
            const satResult = await satFinder.findModel(premises, size, opts);
            model = satResult.found ? satResult.model! : null;
        } else {
            // Use enumeration for small domains
            model = this.tryDomainSize(asts, signature, size, opts);
        }
        
        if (model) {
            return buildModelResult({
                success: true,
                result: 'model_found',
                model,
                timeMs: Date.now() - startTime
            }, opts.verbosity);
        }
    }
    
    return buildModelResult({
        success: false,
        result: 'no_model',
        timeMs: Date.now() - startTime
    }, opts.verbosity);
}
```

**Verify:** `npm test && npm run build`

---

### A.3 Isomorphism Filtering (4 hours)

**File:** `src/utils/isomorphism.ts` (NEW)

```typescript
/**
 * Model isomorphism detection via canonical hashing.
 */

import type { Model } from '../types/index.js';

/**
 * Compute canonical hash for model isomorphism detection.
 * Two isomorphic models have the same hash.
 */
export function computeCanonicalHash(model: Model): string {
    const n = model.domainSize;
    
    // Compute characteristic for each domain element
    const chars = new Map<number, string>();
    for (let i = 0; i < n; i++) {
        const parts: string[] = [];
        for (const [pred, ext] of model.predicates) {
            const positions: string[] = [];
            for (const tuple of ext) {
                const elems = tuple.split(',').map(Number);
                elems.forEach((e, pos) => {
                    if (e === i) positions.push(`${pred}:${pos}`);
                });
            }
            parts.push(positions.sort().join(';'));
        }
        chars.set(i, parts.sort().join('|'));
    }
    
    // Group by characteristic
    const groups = new Map<string, number[]>();
    for (const [elem, char] of chars) {
        if (!groups.has(char)) groups.set(char, []);
        groups.get(char)!.push(elem);
    }
    
    // Build canonical mapping
    const mapping = new Map<number, number>();
    let pos = 0;
    for (const [, elems] of Array.from(groups.entries()).sort((a, b) => 
        a[1].length - b[1].length || a[0].localeCompare(b[0])
    )) {
        for (const e of elems.sort((a, b) => a - b)) {
            mapping.set(e, pos++);
        }
    }
    
    // Rewrite predicates under canonical mapping
    const canonical: string[] = [];
    for (const [pred, ext] of model.predicates) {
        const tuples = Array.from(ext)
            .map(t => t.split(',').map(Number).map(e => mapping.get(e)).join(','))
            .sort();
        canonical.push(`${pred}:${tuples.join(';')}`);
    }
    
    return canonical.sort().join('||');
}

export function areIsomorphic(m1: Model, m2: Model): boolean {
    if (m1.domainSize !== m2.domainSize) return false;
    return computeCanonicalHash(m1) === computeCanonicalHash(m2);
}
```

**Usage in ModelFinder:**
```typescript
// Add to ModelFinder class
async *findAllModels(
    premises: string[],
    options?: ModelFinderOptions
): AsyncGenerator<Model> {
    const seen = new Set<string>();
    const filter = options?.filterIsomorphic ?? true;
    
    for await (const model of this.enumerateAllModels(premises, options)) {
        if (filter) {
            const hash = computeCanonicalHash(model);
            if (seen.has(hash)) continue;
            seen.add(hash);
        }
        yield model;
    }
}
```

**Test:**
```typescript
it('finds exactly 2 groups of order 4', async () => {
    const groupAxioms = [
        'all X (op(e, X) = X)',
        'all X (op(inv(X), X) = e)',
        'all X all Y all Z (op(op(X, Y), Z) = op(X, op(Y, Z)))'
    ];
    const models: Model[] = [];
    for await (const m of finder.findAllModels(groupAxioms, { maxDomainSize: 4 })) {
        models.push(m);
    }
    expect(models.length).toBe(2); // Z4 and Klein-4
});
```

---

### A.4 Increase Default Limits (30 min)

**File:** `src/types/options.ts` — Update DEFAULTS:
```typescript
export const DEFAULTS = {
    maxSeconds: 30,
    maxInferences: 5000,
    maxDomainSize: 25,          // Was: 10
    satThreshold: 8,
    verbosity: 'standard' as Verbosity,
} as const;
```

**File:** `src/modelFinder.ts` constructor:
```typescript
constructor(timeout: number = 30000, maxDomainSize: number = 25) {
```

---

## Phase B: Proving Enhancements (2-3 days)

---

### B.1 Search Strategies (4 hours)

**File:** `src/logicEngine.ts`

Add iterative deepening:

```typescript
async proveIterative(
    premises: string[],
    conclusion: string,
    options: ProveOptions
): Promise<ProveResult> {
    const maxInf = options.maxInferences ?? 50000;
    const maxSec = options.maxSeconds ?? 30;
    const start = Date.now();
    
    const limits = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000]
        .filter(l => l <= maxInf);
    
    for (const limit of limits) {
        if (Date.now() - start > maxSec * 1000) {
            return buildProveResult({
                success: false,
                result: 'timeout',
                message: `Timeout after ${Math.round((Date.now() - start) / 1000)}s`,
                timeMs: Date.now() - start
            }, options.verbosity);
        }
        
        const result = await this.prove(premises, conclusion, {
            ...options,
            maxInferences: limit
        });
        
        if (result.result === 'proved') return result;
        if (!result.statistics?.hitLimit) return result;
    }
    
    return buildProveResult({
        success: false,
        result: 'failed',
        message: `No proof found within ${maxInf} inferences`,
        timeMs: Date.now() - start
    }, options.verbosity);
}
```

---

### B.2 Proof Traces (4 hours)

**File:** `src/types/proof.ts` (NEW)

```typescript
export type ProofRule = 
    | 'premise' | 'negated_goal' | 'resolution' 
    | 'factoring' | 'paramodulation' | 'demodulation';

export interface ProofStep {
    id: number;
    formula: string;
    rule: ProofRule;
    parents: number[];
    substitution?: Record<string, string>;
}

export interface ProofTrace {
    steps: ProofStep[];
    contradiction?: number;
    summary: {
        totalSteps: number;
        rulesUsed: Partial<Record<ProofRule, number>>;
    };
}
```

**Add to ProveResult:**
```typescript
// src/types/responses.ts
proofTrace?: ProofTrace;
```

---

### B.3 Demodulation (4 hours)

**File:** `src/utils/demodulation.ts` (NEW)

```typescript
import type { ASTNode } from '../types/index.js';
import { cloneAST, astToString } from './ast.js';

export interface RewriteRule {
    lhs: ASTNode;
    rhs: ASTNode;
}

export function computeWeight(node: ASTNode): number {
    if (node.type === 'variable' || node.type === 'constant') return 1;
    if (node.type === 'function' || node.type === 'predicate') {
        return 1 + (node.args ?? []).reduce((s, a) => s + computeWeight(a), 0);
    }
    return 1;
}

export function orientEquation(left: ASTNode, right: ASTNode): RewriteRule | null {
    const wl = computeWeight(left);
    const wr = computeWeight(right);
    if (wl > wr) return { lhs: left, rhs: right };
    if (wr > wl) return { lhs: right, rhs: left };
    return null;
}

export function rewriteTerm(node: ASTNode, rules: RewriteRule[]): ASTNode {
    for (const rule of rules) {
        const subst = matchTerms(rule.lhs, node);
        if (subst) return applySubst(rule.rhs, subst);
    }
    const result = cloneAST(node);
    if (result.args) {
        result.args = result.args.map(a => rewriteTerm(a, rules));
    }
    return result;
}

function matchTerms(pattern: ASTNode, target: ASTNode): Map<string, ASTNode> | null {
    const subst = new Map<string, ASTNode>();
    function match(p: ASTNode, t: ASTNode): boolean {
        if (p.type === 'variable') {
            const existing = subst.get(p.name!);
            if (existing) return astToString(existing) === astToString(t);
            subst.set(p.name!, t);
            return true;
        }
        if (p.type !== t.type || p.name !== t.name) return false;
        if (p.args && t.args) {
            if (p.args.length !== t.args.length) return false;
            return p.args.every((pa, i) => match(pa, t.args![i]));
        }
        return true;
    }
    return match(pattern, target) ? subst : null;
}

function applySubst(term: ASTNode, subst: Map<string, ASTNode>): ASTNode {
    if (term.type === 'variable') return subst.get(term.name!) ?? cloneAST(term);
    const result = cloneAST(term);
    if (result.args) result.args = result.args.map(a => applySubst(a, subst));
    return result;
}
```

---

### B.4 Prover9 WASM (OPTIONAL - 2 days)

**Decision gate:** Skip if WASM >10MB or compilation fails.

See Phase B.4 in previous version for full implementation.

---

### B.5 SAT Arithmetic (2 hours)

**File:** `src/engines/sat.ts`

Add in `prove` method when arithmetic enabled:

```typescript
if (options?.enableArithmetic) {
    const arithFacts = generateArithmeticClauses(10); // Domain 0-9
    for (const fact of arithFacts) {
        const literal = nodeToLiteral(fact);
        clauses.push({ literals: [literal] });
    }
}
```

---

## Phase C: Features (1 day)

### C.1 Extended Axiom Library

**File:** `src/resources/axioms.ts`

Add:
```typescript
export const RING_AXIOMS = [...];      // 7 axioms
export const LATTICE_AXIOMS = [...];   // 8 axioms
export const EQUIVALENCE_AXIOMS = [...]; // 3 axioms
```

---

## Phase D: Performance (0.5 day)

### D.1 Clausifier Memoization

**File:** `src/clausifier.ts`

```typescript
const cache = new Map<string, ClausifyResult>();

export function clausify(formula: string, options?: ClausifyOptions): ClausifyResult {
    const key = formula.length < 500 ? formula : null;
    if (key && cache.has(key)) return cache.get(key)!;
    const result = clausifyInternal(formula, options);
    if (key && result.success) cache.set(key, result);
    return result;
}
```

---

## Phase E: Testing (1 day)

### E.1 Pelletier Problems

**File:** `tests/benchmarks/pelletier.test.ts`

```typescript
describe('Pelletier Problems', () => {
    test.each([
        ['P1', [], 'p -> p'],
        ['P2', [], '--p <-> p'],
        ['P3', [], '-(p -> q) -> (q -> p)'],
        // ... P1-P45
    ])('%s', async (name, premises, conclusion) => {
        const result = await engine.prove(premises, conclusion);
        expect(result.result).toBe('proved');
    });
});
```

### E.2 Benchmark Script

**File:** `scripts/benchmark.ts`

```typescript
#!/usr/bin/env npx ts-node
// Run: npx ts-node scripts/benchmark.ts

import { createLogicEngine } from '../src/logicEngine';
import { createModelFinder } from '../src/modelFinder';

async function main() {
    console.log('MCP Logic Benchmark\n');
    
    const engine = createLogicEngine(60000, 20000);
    const finder = createModelFinder(60000, 25);
    
    // Propositional
    for (const [name, conc] of [['P1', 'p -> p'], ['P2', '--p <-> p']]) {
        const start = Date.now();
        const result = await engine.prove([], conc);
        console.log(`${name}: ${result.result} (${Date.now() - start}ms)`);
    }
    
    // Groups
    const groupAxioms = ['all X (e * X = X)', 'all X (i(X) * X = e)', 
        'all X all Y all Z ((X * Y) * Z = X * (Y * Z))'];
    for (const size of [1, 2, 3, 4, 5]) {
        const start = Date.now();
        const result = await finder.findModel(groupAxioms, size);
        console.log(`Group(${size}): ${result.success ? 'found' : 'none'} (${Date.now() - start}ms)`);
    }
}

main();
```

---

## README.md Checkbox Updates

After each phase, update `README.md` Feature Status:

| Phase | Checkboxes to Update |
|-------|---------------------|
| A | Symmetry Breaking, SAT-Backed Model Finding, Isomorphism Filtering |
| B | Proof Traces, Iterative Deepening, Demodulation, (Prover9 WASM if done) |
| C | Extended Axiom Library |
| D | High-Power Mode |
| E | Pelletier Problems, Group Theory Benchmarks |

---

## Verification Commands

```bash
# After each change
npm run build

# Full test suite
npm test

# Specific tests
npm test -- --grep "Symmetry"
npm test -- --grep "SAT"
npm test -- --grep "isomorphism"

# Benchmarks
npx ts-node scripts/benchmark.ts
```

---

## Files Summary

### Phase 0 (New)
- `src/types/options.ts` — Unified options
- `src/utils/grounding.ts` — Quantifier grounding  
- `src/utils/results.ts` — Result builders

### Phase A (New)
- `src/modelFinder-sat.ts` — SAT model finding
- `src/utils/isomorphism.ts` — Canonical hashing
- `tests/symmetry.test.ts`

### Phase B (New)
- `src/types/proof.ts` — Proof trace types
- `src/utils/demodulation.ts` — Term rewriting
- `src/engines/prover9-wasm.ts` (optional)

### Phase E (New)
- `tests/benchmarks/pelletier.test.ts`
- `scripts/benchmark.ts`

### Modified
- `src/types/responses.ts` — Model.functions, ProveResult.proofTrace
- `src/types/index.ts` — Re-exports
- `src/modelFinder.ts` — Functions, symmetry, SAT integration
- `src/logicEngine.ts` — Strategies, traces
- `src/engines/sat.ts` — Arithmetic
- `src/clausifier.ts` — Memoization
- `src/resources/axioms.ts` — Extended library

---

## Estimated Effort

| Phase | Time | Cumulative |
|-------|------|------------|
| 0 (Pre-refactor) | 4-6 hours | 6 hours |
| A (Model finding) | 2-3 days | 3 days |
| B.1-B.3 (Proving) | 1-2 days | 4 days |
| B.4 (WASM) | 2 days | (optional) |
| C (Features) | 4 hours | 4.5 days |
| D (Performance) | 2 hours | 4.5 days |
| E (Testing) | 4 hours | 5 days |

**Total: 5 working days for full implementation (excluding optional Prover9 WASM)**

---

## Future Phases

### Phase F: Advanced Engines (Research)
- SMT (Z3 WASM) — ~15MB, cold start ~500ms
- ASP (Clingo) — Non-monotonic reasoning
- Neural-Guided — LLM suggestions + symbolic validation

### Phase G: Frontier Logic (Vision)
- Higher-Order, Modal, Temporal, Probabilistic logic

---

**This document is the single source of truth for MCP Logic development.**

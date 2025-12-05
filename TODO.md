# MCP Logic - Development Roadmap

Optional enhancement plans for the MCP Logic Node.js implementation. Each section is independent and can be implemented in any order.

---

## 🔴 Priority 1: Quick Wins

### 1.1 Structured Error Responses

**Goal:** Replace string errors with machine-readable error objects.

**Changes:**
- [ ] Define error code enum in `src/types/errors.ts`
- [ ] Update `logicEngine.ts` to return structured errors
- [ ] Update `modelFinder.ts` to include formula span info
- [ ] Add suggestion engine for common mistakes

**New interface:**
```typescript
interface LogicError {
  code: 'SYNTAX_ERROR' | 'INFERENCE_LIMIT' | 'UNSATISFIABLE' | 'TIMEOUT' | 'INTERNAL';
  message: string;
  span?: { start: number; end: number };  // Position in formula
  suggestion?: string;
  details?: Record<string, unknown>;
}
```

**Concerns:**
- Breaking change for clients parsing current string errors
- Consider versioning the response format

**References:**
- [MCP Error Handling](https://modelcontextprotocol.io/docs/concepts/error-handling)

---

### 1.2 Verbosity Parameter

**Goal:** Let callers control response detail level to optimize token usage.

**Changes:**
- [ ] Add `verbosity?: 'minimal' | 'standard' | 'detailed'` to all tool schemas
- [ ] `minimal`: Boolean result + model/counterexample only
- [ ] `standard`: Current behavior (default)
- [ ] `detailed`: Include Prolog program, inference trace, all bindings

**Implementation notes:**
- In `logicEngine.ts`, capture inference steps when `detailed`
- Store generated Prolog in result for debugging

---

## 🟡 Priority 2: Expressiveness

### 2.1 Clausification / CNF Support

**Goal:** Handle formulas beyond Horn clause form.

**Background:**
Currently `translator.ts` only fully supports:
- `all x (P(x) -> Q(x))` → `Q(X) :- P(X).`
- Simple facts like `P(a).`

Non-Horn formulas (disjunctions in heads, complex negation) fall back to meta-representation which may not resolve correctly.

**Changes:**
- [ ] Add `clausify()` function to convert formulas to CNF
- [ ] Implement Skolemization for existential quantifiers
- [ ] Add `clausify?: boolean` parameter to `prove`

**Algorithm sketch:**
1. Eliminate `<->` and `->`
2. Push negation inward (De Morgan)
3. Skolemize existentials
4. Distribute `|` over `&`
5. Extract clauses

**References:**
- [Clausification Algorithm](https://en.wikipedia.org/wiki/Conjunctive_normal_form#Conversion_into_CNF)
- Consider: [logic.js](https://github.com/nicolewhite/logic.js) for reference implementation

**Concerns:**
- CNF can cause exponential blowup for some formulas
- May need heuristics to avoid pathological cases

---

### 2.2 Session-Based Reasoning

**Goal:** Enable incremental knowledge base construction.

**New tools:**
- [ ] `create-kb` → Returns session ID
- [ ] `add-to-kb` → Add premises to session
- [ ] `query-kb` → Query accumulated knowledge
- [ ] `retract-from-kb` → Remove specific premises
- [ ] `clear-kb` → Reset session

**Implementation:**
```typescript
// Store sessions in memory
const sessions = new Map<string, {
  premises: string[];
  prologProgram: string;
  engine: LogicEngine;
}>();
```

**Concerns:**
- Memory management for long-running servers
- Session expiration policy needed
- MCP doesn't have built-in session concept—need to pass session ID explicitly

---

### 2.3 Equality Reasoning Improvements

**Current state:** Basic unification via Prolog's `=`

**Enhancements:**
- [ ] Add equality axiom schemas (reflexivity, symmetry, transitivity)
- [ ] Add congruence axioms for functions automatically
- [ ] Add `equality_axioms?: boolean` parameter (default: true)

**Generated axioms for equality:**
```prolog
eq(X, X).                         % Reflexivity
eq(X, Y) :- eq(Y, X).             % Symmetry  
eq(X, Z) :- eq(X, Y), eq(Y, Z).   % Transitivity
```

**References:**
- [Equality in Prolog](https://www.swi-prolog.org/pldoc/man?section=compare)

---

### 2.4 Model Finder Improvements

**Current state:** Brute-force enumeration up to domain size 10

**Improvements:**
- [ ] **Symmetry breaking**: Add lex-leader constraints
- [ ] **Partial models**: Return best-effort model on timeout
- [ ] **Function interpretation**: Currently only predicates are interpreted

**Symmetry breaking example:**
For a 3-element domain `{0, 1, 2}`, if constants `a` and `b` are both unconstrained, force `a ≤ b` to avoid redundant models.

**Concerns:**
- SAT-based approach would be more scalable but requires significant rewrite
- Consider: [MiniSat.js](https://github.com/nicokoch/minisat-js) as alternative backend

---

### 2.5 Typed/Sorted First-Order Logic

**Goal:** Allow type annotations to constrain domains.

**Syntax:**
```
all x:Person (mortal(x))
exists y:Number (greater(y, 0))
```

**Changes:**
- [ ] Extend parser to accept `:Type` annotations
- [ ] Store type info in AST
- [ ] Restrict model finder search to typed domains
- [ ] Add type checking in validator

**Concerns:**
- Significant parser changes
- Backward compatibility with untyped formulas
- How to define types? (Built-in vs. user-defined)

---

## 🟢 Priority 3: MCP Integration

### 3.1 MCP Resources

**Goal:** Expose axiom libraries as browsable resources.

**Changes:**
- [ ] Implement `resources/list` handler
- [ ] Implement `resources/read` handler
- [ ] Define resource URIs:
  - `axioms://category-theory`
  - `axioms://set-theory`  
  - `axioms://arithmetic`
  - `axioms://group-theory`

**Example resource content:**
```json
{
  "uri": "axioms://category-theory",
  "name": "Category Theory Axioms",
  "mimeType": "text/plain",
  "content": "all x (object(x) -> exists i (...)) ..."
}
```

**References:**
- [MCP Resources Specification](https://modelcontextprotocol.io/docs/concepts/resources)

---

### 3.2 MCP Prompts

**Goal:** Provide pre-built reasoning patterns.

**Prompts to implement:**
- [ ] `prove-by-contradiction`: Set up premises for indirect proof
- [ ] `verify-equivalence`: Prove A→B and B→A
- [ ] `diagnose-unsatisfiable`: Find minimal unsatisfiable subset
- [ ] `explain-failure`: Interpret why a proof failed

**References:**
- [MCP Prompts Specification](https://modelcontextprotocol.io/docs/concepts/prompts)

---

### 3.3 Streaming Responses

**Goal:** For long-running operations, stream progress.

**Use cases:**
- Model finding: "Searching domain size 3/10..."
- Complex proofs: Stream inference steps

**Changes:**
- [ ] Implement SSE-based streaming for `find-model`
- [ ] Add `stream?: boolean` parameter
- [ ] Handle client cancellation

**Concerns:**
- MCP SDK support for streaming is evolving
- May need to wait for SDK updates

---

### 3.4 Response Compression Options

**Goal:** Reduce token usage for LLM callers.

**New parameters:**
- [ ] `omit_echoed_input?: boolean` — Don't include premises in response
- [ ] `compact_model?: boolean` — Minimal model representation
- [ ] `proof_summary?: boolean` — One-line summary vs. full trace

---

## 📚 Technical Debt

### Test Coverage

**Current:** Basic happy-path tests in `basic.test.ts`

**Needed:**
- [ ] Edge cases: Empty premises, recursive formulas
- [ ] Error path tests: Invalid syntax, timeout behavior
- [ ] Integration tests: Full MCP round-trip
- [ ] Performance tests: Large formulas, deep nesting

### Type Safety

**Current:** Basic type declarations in `src/types/tau-prolog.d.ts`

**Completed:**
- [x] Created `src/types/tau-prolog.d.ts` with proper declarations
- [x] Removed `@ts-ignore` comments

**Remaining:**
- [ ] Expand type declarations for full Tau-Prolog API coverage

### Documentation

- [ ] Add JSDoc to all public functions
- [ ] Add architecture diagram to README
- [ ] Document formula syntax more thoroughly

---

## 🔗 External References

| Topic | Link |
|-------|------|
| Tau-Prolog Docs | https://tau-prolog.org/documentation |
| MCP Specification | https://modelcontextprotocol.io/docs |
| Prover9 Manual | https://www.cs.unm.edu/~mccune/prover9/manual/ |
| Clausification | https://en.wikipedia.org/wiki/Conjunctive_normal_form |
| Model Theory | https://plato.stanford.edu/entries/model-theory/ |

---

## ⚠️ Known Limitations to Document

1. **Inference depth**: Tau-Prolog's default limit may truncate valid proofs
2. **Non-termination**: Some valid Prolog programs loop forever
3. **Negation as failure**: `-P(x)` means "P(x) cannot be proven", not "P(x) is false"
4. **Open-world vs. closed-world**: Current implementation uses closed-world assumption
5. **No arithmetic**: `2 + 2 = 4` requires external module integration

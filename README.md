# MCP Logic

A self-contained MCP server for first-order logic reasoning, implemented in TypeScript with no external binary dependencies.

Original: https://github.com/angrysky56/mcp-logic/

---

## Feature Status

> ✅ = Implemented | 🔲 = Planned | 🔬 = Research/Vision

### Core Reasoning
- [x] **Theorem Proving** — Resolution-based proving via Tau-Prolog
- [x] **Model Finding** — Finite model enumeration (domain ≤10)
- [x] **Counterexample Detection** — Find models refuting conclusions
- [x] **Syntax Validation** — Pre-validate formulas with detailed errors
- [x] **CNF Clausification** — Transform FOL to Conjunctive Normal Form
- [x] **DIMACS Export** — Export CNF for external SAT solvers
- [ ] **Symmetry Breaking** — Lex-leader for model search
- [ ] **SAT-Backed Model Finding** — Scale to domain 25+
- [ ] **Isomorphism Filtering** — Skip equivalent models
- [ ] **Proof Traces** — Step-by-step derivation output

### Engine Federation
- [x] **Multi-Engine Architecture** — Automatic engine selection
- [x] **Prolog Engine** (Tau-Prolog) — Horn clauses, Datalog, equality
- [x] **SAT Engine** (MiniSat) — General FOL, non-Horn formulas
- [x] **Engine Parameter** — Explicit engine selection via `engine` param
- [ ] **Prover9 WASM** — Optional high-power ATP (lazy-loaded)
- [ ] **Iterative Deepening** — Configurable search strategies
- [ ] **Demodulation** — Equational term rewriting

### Logic Features
- [x] **Arithmetic Support** — Built-in: `lt`, `gt`, `plus`, `minus`, `times`, `divides`
- [x] **Equality Reasoning** — Reflexivity, symmetry, transitivity, congruence
- [ ] **Extended Axiom Library** — Ring, field, lattice, equivalence axioms
- [ ] **Typed/Sorted FOL** — Domain-constraining type annotations (research)
- [ ] **Modal Logic** — Necessity, possibility operators (research)
- [ ] **Probabilistic Logic** — Weighted facts, Bayesian inference (research)

### MCP Protocol
- [x] **Session-Based Reasoning** — Incremental knowledge base construction
- [x] **Axiom Resources** — Browsable libraries (category, Peano, ZFC, etc.)
- [x] **Reasoning Prompts** — Templates for proof patterns
- [x] **Verbosity Control** — `minimal`/`standard`/`detailed` responses
- [x] **Structured Errors** — Machine-readable error codes and suggestions
- [ ] **Streaming Progress** — Real-time progress notifications
- [ ] **High-Power Mode** — Extended limits with warning

### Advanced Engines (Research)
- [ ] **SMT (Z3 WASM)** — Theory reasoning (arithmetic, arrays)
- [ ] **ASP (Clingo)** — Non-monotonic, defaults, preferences
- [ ] **Neural-Guided** — LLM-suggested proof paths with validation
- [ ] **Higher-Order Logic** — Quantify over predicates (research)

### Testing & Benchmarks
- [x] **Unit Tests** — 254+ tests, 80%+ coverage
- [ ] **Pelletier Problems** — P1-P75 benchmark suite
- [ ] **Group Theory Benchmarks** — Model finding & proving
- [ ] **TPTP Library Subset** — Standard ATP benchmarks

---

## Quick Start

### Installation

```bash
git clone <repository>
cd mcplogic
npm install
npm run build
```

### Running the Server

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

### Claude Desktop / MCP Client Configuration

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "mcp-logic": {
      "command": "node",
      "args": ["/path/to/mcplogic/dist/index.js"]
    }
  }
}
```

---

## Available Tools

### Core Reasoning Tools

| Tool | Description |
|------|-------------|
| **prove** | Prove statements using resolution with engine selection |
| **check-well-formed** | Validate formula syntax with detailed errors |
| **find-model** | Find finite models satisfying premises |
| **find-counterexample** | Find counterexamples showing statements don't follow |
| **verify-commutativity** | Generate FOL for categorical diagram commutativity |
| **get-category-axioms** | Get axioms for category/functor/monoid/group |

### Session Management Tools

| Tool | Description |
|------|-------------|
| **create-session** | Create a new reasoning session with TTL |
| **assert-premise** | Add a formula to a session's knowledge base |
| **query-session** | Query the accumulated KB with a goal |
| **retract-premise** | Remove a specific premise from the KB |
| **list-premises** | List all premises in a session |
| **clear-session** | Clear all premises (keeps session alive) |
| **delete-session** | Delete a session entirely |

---

## Engine Selection

The `prove` tool supports automatic or explicit engine selection:

```json
{
  "name": "prove",
  "arguments": {
    "premises": ["foo | bar", "-foo"],
    "conclusion": "bar",
    "engine": "auto"
  }
}
```

| Engine | Best For | Capabilities |
|--------|----------|--------------|
| `prolog` | Horn clauses, Datalog | Equality, arithmetic, efficient unification |
| `sat` | Non-Horn formulas, SAT problems | Full FOL, CNF solving |
| `auto` | Default — selects based on formula | Analyzes clause structure |

---

## Formula Syntax

This server uses first-order logic (FOL) syntax compatible with Prover9:

### Quantifiers
- `all x (...)` — Universal quantification (∀x)
- `exists x (...)` — Existential quantification (∃x)

### Connectives
- `->` — Implication (→)
- `<->` — Biconditional (↔)
- `&` — Conjunction (∧)
- `|` — Disjunction (∨)
- `-` — Negation (¬)

### Examples

```
# All men are mortal, Socrates is a man
all x (man(x) -> mortal(x))
man(socrates)

# Transitivity of greater-than
all x all y all z ((greater(x, y) & greater(y, z)) -> greater(x, z))
```

---

## MCP Resources

| Resource URI | Description |
|--------------|-------------|
| `logic://axioms/category` | Category theory axioms |
| `logic://axioms/monoid` | Monoid structure |
| `logic://axioms/group` | Group axioms |
| `logic://axioms/peano` | Peano arithmetic |
| `logic://axioms/set-zfc` | ZFC set theory basics |
| `logic://axioms/propositional` | Propositional tautologies |
| `logic://templates/syllogism` | Aristotelian syllogism patterns |
| `logic://engines` | Available reasoning engines (JSON) |

---

## Verbosity Control

All tools support a `verbosity` parameter:

| Level | Description | Use Case |
|-------|-------------|----------|
| `minimal` | Just success/result | Token-efficient LLM chains |
| `standard` | + message, bindings, engineUsed | Default balance |
| `detailed` | + Prolog program, statistics | Debugging |

---

## Limitations (Current)

1. **Model Size** — Finder limited to domains ≤10 elements
2. **Inference Depth** — Complex proofs may exceed default limit (increase via `inference_limit`)
3. **SAT Arithmetic** — Arithmetic not supported in SAT engine path
4. **Higher-Order** — Only first-order logic supported
5. **Functions in Models** — Function symbols not fully evaluated in model finder

See [TODO2.md](TODO2.md) for the complete development roadmap addressing these limitations.

---

## Development

```bash
npm run build     # Compile TypeScript
npm test          # Run test suite
npm run dev       # Development mode with auto-reload
```

---

## License

MIT

---

## Roadmap

See **[TODO2.md](TODO2.md)** for the comprehensive development plan including:
- Phase 0: Pre-refactoring (fix function handling, extract grounding module)
- Phase A: Model finding upgrades (symmetry breaking, SAT grounding, isomorphism)
- Phase B: Proving enhancements (strategies, proof traces, demodulation, Prover9 WASM)
- Phase C: Feature parity (extended output, MCP config, axiom library)
- Phase D: Performance (increased limits, clausifier optimization)
- Phase E: Testing (Pelletier problems, benchmarks)

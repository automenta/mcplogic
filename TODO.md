# MCP Logic Development Plan

This document outlines the strategic roadmap for MCP Logic. The goal is to maximize **ubiquity, usability, and reasoning power** while minimizing development effort by leveraging existing ecosystems.

## ✅ Completed Foundation
- [x] **Core Logic**: First-Order Logic engine with resolution proving and finite model finding.
- [x] **Safety**: Bounded equality (`eq_d`) and resource limits.
- [x] **Observability**: Step-by-step proof traces and real-time streaming progress.
- [x] **Verification**: TPTP benchmark suite and comprehensive unit testing.
- [x] **Interface**: Full MCP Server implementation.

---

## 📅 Phase 1: Polish & Power (Immediate Impact)
*Goal: Make the current system robust, powerful, and immediately useful for complex tasks.*

### 1. High-Power Mode (Ergonomics & Power)
- [ ] **Feature**: Allow users to explicitly request "deep thought" resources.
- [ ] **Implementation**: Add `highPower: boolean` flag to tools.
    -   Increases timeout (30s → 300s).
    -   Increases inference limit (5k → 100k).
    -   Enables more aggressive search strategies.
-   **Value**: Solves harder problems without configuration fatigue.

### 2. Standard Axiom Library (Completeness & Low Effort)
- [ ] **Feature**: Built-in knowledge modules so users don't have to define basic concepts.
- [ ] **Modules**:
    -   `logic/sets`: Set theory axioms (subset, union, intersection).
    -   `logic/lists`: List operations (head, tail, append).
    -   `logic/arithmetic`: Peano axioms or basic arithmetic helper.
-   **Value**: Drastically reduces prompt size and error rate for users.

### 3. Real-Client Verification (Usability)
- [ ] **Task**: Verify end-to-end UX in Claude Desktop / Inspector.
- [ ] **Checklist**: Connection stability, error clarity, progress bar visualization, trace readability.

---

## 🌍 Phase 2: Ubiquity & Access (The "Run Everywhere" Strategy)
*Goal: Transform MCP Logic from a "server" into a universal "reasoning engine" that can run in browsers, CLIs, and other agents.*

### 1. Library Decoupling (Ubiquity)
- [ ] **Refactor**: Separate `src/server.ts` (MCP layer) from `src/logicEngine.ts` (Core).
- [ ] **Artifact**: Publish `@antigravity/mcp-logic-core` on NPM.
-   **Value**: Allows developers to embed the logic engine directly into their own Node.js apps without running a separate server.

### 2. Browser / WASM Compatibility (Ubiquity)
- [ ] **Task**: Ensure core logic has no Node.js-specific dependencies (abstract `fs`).
- [ ] **Goal**: Run `LogicEngine` entirely in the browser (client-side reasoning).
-   **Value**: Zero-latency reasoning for web apps; privacy-preserving (local) logic.

### 3. CLI / TUI (Accessibility)
- [ ] **Tool**: Standalone `mcplogic` command.
- [ ] **Usage**: `mcplogic prove problem.p` or interactive REPL.
-   **Value**: Quick testing and debugging for developers without setting up an MCP client.

---

## 🧠 Phase 3: AI Augmentation (The "Smart" Layer)
*Goal: Bridge the gap between LLMs and Formal Logic.*

### 1. LLM Translation Layer (Usability)
- [ ] **Feature**: "Text-to-Logic" prompt templates and schema definitions.
- [ ] **Implementation**: A lightweight library of prompts that reliably convert natural language requirements into our FOL syntax.
-   **Value**: Makes the tool accessible to non-logicians via LLM agents.

### 2. Heuristic Strategy Selection (Performance)
- [ ] **Feature**: Auto-detect problem type (e.g., "mostly equality", "horn clauses") and select the optimal engine/strategy.
-   **Value**: "It just works" performance optimization.

---

## 🔮 Phase 4: Long-Term Research
- [ ] **Evolution Engine**: Genetic algorithm to evolve better axioms or strategies over time.
- [ ] **Persistent Knowledge Graphs**: Storing logical truths in a vector DB + Graph DB hybrid.

---

## 🛡️ Ergonomics Assurance
- **Zero Config**: Smart defaults for all parameters.
- **Human-Readable Traces**: Proofs are explained in steps, not just raw resolution dumps.
- **Type Safety**: Full TypeScript support for the library export.

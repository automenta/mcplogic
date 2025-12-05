# MCP Logic

A self-contained MCP server for first-order logic reasoning, implemented in TypeScript with no external binary dependencies.

Original: https://github.com/angrysky56/mcp-logic/

## Features

- **Theorem Proving** - Prove logical statements using resolution
- **Model Finding** - Find finite models satisfying premises
- **Counterexample Detection** - Find models showing conclusions don't follow
- **Syntax Validation** - Pre-validate formulas with detailed error messages
- **Categorical Reasoning** - Built-in support for category theory proofs
- **Session-Based Reasoning** - Incremental knowledge base construction
- **Verbosity Control** - Token-efficient responses for LLM chains
- **Self-Contained** - Pure npm dependencies, no external binaries

## Quick Start

### Installation

```bash
git clone <repository>
cd nodejs
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
      "args": ["/path/to/nodejs/dist/index.js"]
    }
  }
}
```

## Available Tools

### Core Reasoning Tools

| Tool | Description |
|------|-------------|
| **prove** | Prove statements using resolution |
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

## Verbosity Control

All tools support a `verbosity` parameter to control response size:

| Level | Description | Use Case |
|-------|-------------|----------|
| `minimal` | Just success/result | Token-efficient LLM chains |
| `standard` | + message, bindings | Default balance |
| `detailed` | + Prolog program, statistics | Debugging |

```json
{
  "name": "prove",
  "arguments": {
    "premises": ["man(socrates)", "all x (man(x) -> mortal(x))"],
    "conclusion": "mortal(socrates)",
    "verbosity": "minimal"
  }
}
```

**Minimal response:** `{ "success": true, "result": "proved" }`

**Detailed response:** Includes `prologProgram`, `statistics.timeMs`, etc.

## Formula Syntax

This server uses first-order logic (FOL) syntax compatible with Prover9:

### Quantifiers
- `all x (...)` - Universal quantification (∀x)
- `exists x (...)` - Existential quantification (∃x)

### Connectives
- `->` - Implication (→)
- `<->` - Biconditional (↔)
- `&` - Conjunction (∧)
- `|` - Disjunction (∨)
- `-` - Negation (¬)

### Predicates and Terms
- Predicates: `man(x)`, `loves(x, y)`, `greater(x, y)`
- Constants: `socrates`, `a`, `b`
- Variables: `x`, `y`, `z` (lowercase, typically single letters)
- Functions: `f(x)`, `successor(n)`
- Equality: `x = y`

### Examples

```
# All men are mortal, Socrates is a man
all x (man(x) -> mortal(x))
man(socrates)

# There exists someone who loves everyone
exists x all y loves(x, y)

# Transitivity of greater-than
all x all y all z ((greater(x, y) & greater(y, z)) -> greater(x, z))
```

## Tool Usage Examples

### 1. Prove a Theorem

```json
{
  "name": "prove",
  "arguments": {
    "premises": [
      "all x (man(x) -> mortal(x))",
      "man(socrates)"
    ],
    "conclusion": "mortal(socrates)"
  }
}
```

**Expected Result:** Theorem proved ✓

### 2. Find a Counterexample

```json
{
  "name": "find-counterexample",
  "arguments": {
    "premises": ["P(a)"],
    "conclusion": "P(b)"
  }
}
```

**Expected Result:** Model found where `P(a)` is true but `P(b)` is false.

### 3. Validate Syntax

```json
{
  "name": "check-well-formed",
  "arguments": {
    "statements": [
      "all x (P(x) -> Q(x))",
      "P(a) &"
    ]
  }
}
```

**Expected Result:** First formula valid, second has syntax error.

### 4. Session-Based Reasoning

Build up a knowledge base incrementally:

```json
// 1. Create a session
{ "name": "create-session", "arguments": { "ttl_minutes": 30 } }
// → { "session_id": "abc-123...", "expires_at": "2024-..." }

// 2. Assert premises
{ "name": "assert-premise", "arguments": { 
    "session_id": "abc-123...", 
    "formula": "all x (man(x) -> mortal(x))" 
}}
{ "name": "assert-premise", "arguments": { 
    "session_id": "abc-123...", 
    "formula": "man(socrates)" 
}}

// 3. Query the KB
{ "name": "query-session", "arguments": { 
    "session_id": "abc-123...", 
    "goal": "mortal(socrates)" 
}}
// → { "success": true, "result": "proved" }

// 4. Cleanup
{ "name": "delete-session", "arguments": { "session_id": "abc-123..." } }
```

### 5. Verify Categorical Diagram

```json
{
  "name": "verify-commutativity",
  "arguments": {
    "path_a": ["f", "g"],
    "path_b": ["h"],
    "object_start": "A",
    "object_end": "C",
    "with_category_axioms": true
  }
}
```

**Expected Result:** FOL premises and conclusion for proving `g ∘ f = h`.

### 6. Get Category Theory Axioms

```json
{
  "name": "get-category-axioms",
  "arguments": {
    "concept": "category"
  }
}
```

**Expected Result:** 6 axioms defining a category (identity, composition, associativity).

## Project Structure

```
nodejs/
├── package.json           # Project configuration
├── tsconfig.json          # TypeScript configuration
├── jest.config.js         # Test configuration
├── src/
│   ├── index.ts           # CLI entry point
│   ├── server.ts          # MCP server (13 tools)
│   ├── parser.ts          # FOL tokenizer & parser
│   ├── translator.ts      # FOL ↔ Prolog conversion
│   ├── logicEngine.ts     # Tau-Prolog wrapper
│   ├── syntaxValidator.ts # Syntax validation
│   ├── categoricalHelpers.ts # Category theory
│   ├── modelFinder.ts     # Finite model enumeration
│   ├── sessionManager.ts  # Session lifecycle management
│   └── types/
│       ├── index.ts       # Shared types & verbosity
│       ├── errors.ts      # Structured error system
│       └── tau-prolog.d.ts
├── tests/
│   ├── basic.test.ts
│   ├── parser.test.ts
│   ├── prover.test.ts
│   ├── errors.test.ts     # Error system tests
│   ├── session.test.ts    # Session management tests
│   └── verbosity.test.ts  # Verbosity control tests
└── dist/                  # Compiled output (after build)
```

## Development

### Run Tests

```bash
npm test
```

### Build

```bash
npm run build
```

### Type Checking

```bash
npx tsc --noEmit
```

## Technical Details

### Logic Engine

The server uses **Tau-Prolog** as its core inference engine. Tau-Prolog is an ISO-compliant Prolog interpreter written entirely in JavaScript, enabling:

- Resolution-based theorem proving
- Unification and backtracking
- No external binary dependencies

### Model Finder

For counterexample detection and model finding, the server includes a custom **finite model enumerator** that:

- Searches domains of increasing size (2-10 elements)
- Enumerates all possible interpretations
- Checks formula satisfaction
- Returns the first satisfying model

### Session Manager

Sessions enable incremental knowledge base construction:

- **TTL-based expiration** - Sessions auto-expire (default: 30 minutes)
- **Garbage collection** - Expired sessions cleaned up every minute
- **Memory protection** - Maximum 1000 concurrent sessions
- **CRUD operations** - Assert, retract, list, clear premises

### Structured Errors

All errors include machine-readable information:

```typescript
interface LogicError {
  code: LogicErrorCode;    // 'PARSE_ERROR' | 'INFERENCE_LIMIT' | ...
  message: string;
  span?: { start, end, line, col };
  suggestion?: string;     // How to fix
  context?: string;        // The problematic input
}
```

### Syntax Translation

Since Tau-Prolog uses Prolog syntax, the server includes a translator that converts between:

- **Input:** Prover9-style FOL (`all x (man(x) -> mortal(x))`)
- **Internal:** Prolog rules (`mortal(X) :- man(X).`)

This translation is transparent to users.

## Limitations

1. **Inference Depth:** Complex proofs may exceed inference limits
2. **Model Size:** Model finder is limited to small finite domains (≤10 elements)
3. **Function Symbols:** Limited support for complex function terms
4. **Higher-Order Logic:** Only first-order logic is supported

## Troubleshooting

### "No proof found" for valid theorem
- Try simpler premises
- Check for syntax errors with `check-well-formed`
- Increase `inference_limit` for complex proofs (default: 1000)

### Model finder returns "no_model"
- Increase `max_domain_size` parameter (default: 10)
- Simplify the formula
- Check for contradictory premises

### Syntax validation warnings
- Use lowercase for predicates/functions
- Add spaces around operators for readability
- Ensure balanced parentheses

### Session errors
- Check session hasn't expired (default TTL: 30 minutes)
- Verify session_id is correct
- Use `list-premises` to inspect session state

## API Reference

### prove
```typescript
interface ProveArgs {
  premises: string[];       // List of FOL premises
  conclusion: string;       // Goal to prove
  inference_limit?: number; // Max inference steps (default: 1000)
  verbosity?: 'minimal' | 'standard' | 'detailed';
}

interface ProveResult {
  success: boolean;
  result: 'proved' | 'failed' | 'timeout' | 'error';
  message?: string;         // Human-readable message
  proof?: string[];
  bindings?: Record<string, string>[];
  error?: string;
  prologProgram?: string;   // (detailed only)
  statistics?: { timeMs: number; inferences?: number };  // (detailed only)
}
```

### check-well-formed
```typescript
interface CheckArgs {
  statements: string[];  // Formulas to validate
  verbosity?: 'minimal' | 'standard' | 'detailed';
}

interface ValidationResult {
  valid: boolean;
  formulaResults: Array<{
    formula: string;
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>;
}
```

### find-model
```typescript
interface FindModelArgs {
  premises: string[];         // Formulas to satisfy
  domain_size?: number;       // Specific size or search 2-max
  max_domain_size?: number;   // Maximum domain size to try (default: 10)
  verbosity?: 'minimal' | 'standard' | 'detailed';
}

interface ModelResult {
  success: boolean;
  result: 'model_found' | 'no_model' | 'timeout' | 'error';
  model?: {
    domainSize: number;
    predicates: Record<string, string[]>;
    constants: Record<string, number>;
  };
  interpretation?: string;
  statistics?: { domainSize: number; searchedSizes: number[]; timeMs: number };
}
```

### find-counterexample
```typescript
interface CounterexampleArgs {
  premises: string[];
  conclusion: string;
  domain_size?: number;
  max_domain_size?: number;  // Maximum domain size to try (default: 10)
  verbosity?: 'minimal' | 'standard' | 'detailed';
}
// Returns ModelResult with counterexample interpretation
```

### Session Tools

```typescript
// create-session
interface CreateSessionArgs {
  ttl_minutes?: number;  // Session lifetime (default: 30, max: 1440)
}
interface CreateSessionResult {
  session_id: string;
  created_at: string;
  expires_at: string;
  ttl_minutes: number;
  active_sessions: number;
}

// assert-premise
interface AssertPremiseArgs {
  session_id: string;
  formula: string;
}

// query-session
interface QuerySessionArgs {
  session_id: string;
  goal: string;
  inference_limit?: number;
  verbosity?: 'minimal' | 'standard' | 'detailed';
}

// retract-premise
interface RetractPremiseArgs {
  session_id: string;
  formula: string;  // Exact formula to remove
}

// list-premises
interface ListPremisesArgs {
  session_id: string;
}
interface ListPremisesResult {
  session_id: string;
  premise_count: number;
  premises: string[];
}

// clear-session
interface ClearSessionArgs {
  session_id: string;
}

// delete-session
interface DeleteSessionArgs {
  session_id: string;
}
```

### verify-commutativity
```typescript
interface CommutativityArgs {
  path_a: string[];          // Morphisms in first path
  path_b: string[];          // Morphisms in second path
  object_start: string;      // Starting object
  object_end: string;        // Ending object
  with_category_axioms?: boolean;  // Include category axioms (default: true)
  verbosity?: 'minimal' | 'standard' | 'detailed';
}

interface CommutativityResult {
  premises: string[];
  conclusion: string;
  note: string;
}
```

### get-category-axioms
```typescript
interface AxiomsArgs {
  concept: 'category' | 'functor' | 'natural-transformation' | 'monoid' | 'group';
  functor_name?: string;     // For functor axioms (default: 'F')
  verbosity?: 'minimal' | 'standard' | 'detailed';
}

interface AxiomsResult {
  concept: string;
  axioms: string[];
}
```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `npm test`
4. Submit a pull request

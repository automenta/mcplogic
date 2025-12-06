# MCP Logic

A self-contained MCP server for first-order logic reasoning, implemented in TypeScript with no external binary dependencies.

Original: https://github.com/angrysky56/mcp-logic/

## Features

### Core Reasoning
- **Theorem Proving** — Prove logical statements using resolution
- **Model Finding** — Find finite models satisfying premises
- **Counterexample Detection** — Find models showing conclusions don't follow
- **Syntax Validation** — Pre-validate formulas with detailed error messages

### Engine Federation
- **Multi-Engine Architecture** — Automatic engine selection based on formula structure
- **Prolog Engine** (Tau-Prolog) — Efficient for Horn clauses, Datalog, equality reasoning
- **SAT Engine** (MiniSat) — Handles general FOL and non-Horn formulas
- **Engine Parameter** — Explicit engine selection: `'prolog'`, `'sat'`, or `'auto'`

### Advanced Logic
- **Arithmetic Support** — Built-in predicates: `lt`, `gt`, `plus`, `minus`, `times`, `divides`
- **Equality Reasoning** — Reflexivity, symmetry, transitivity, congruence axioms
- **CNF Clausification** — Transform FOL to Conjunctive Normal Form
- **DIMACS Export** — Export CNF for external SAT solvers

### MCP Protocol
- **Session-Based Reasoning** — Incremental knowledge base construction
- **Axiom Resources** — Browsable axiom libraries (category theory, Peano, ZFC, etc.)
- **Reasoning Prompts** — Templates for proof by contradiction, formalization, etc.
- **Verbosity Control** — Token-efficient responses for LLM chains

### Infrastructure
- **Self-Contained** — Pure npm dependencies, no external binaries
- **Structured Errors** — Machine-readable error information with suggestions
- **254 Tests** — Comprehensive test coverage

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

The response includes `engineUsed` to show which engine was selected:
```json
{ "success": true, "result": "proved", "engineUsed": "sat/minisat" }
```

## Arithmetic and Equality

### Arithmetic Support

Enable with `enable_arithmetic: true`:

```json
{
  "name": "prove",
  "arguments": {
    "premises": ["lt(1, 2)", "lt(2, 3)", "all x all y all z ((lt(x,y) & lt(y,z)) -> lt(x,z))"],
    "conclusion": "lt(1, 3)",
    "enable_arithmetic": true
  }
}
```

**Built-in predicates:** `lt`, `gt`, `le`, `ge`, `plus`, `minus`, `times`, `divides`, `mod`

### Equality Reasoning

Enable with `enable_equality: true`:

```json
{
  "name": "prove",
  "arguments": {
    "premises": ["a = b", "P(a)"],
    "conclusion": "P(b)",
    "enable_equality": true
  }
}
```

Automatically injects reflexivity, symmetry, transitivity, and congruence axioms.

## MCP Resources

Browse axiom libraries via the MCP resources protocol:

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

## MCP Prompts

Reasoning templates for common tasks:

| Prompt | Description |
|--------|-------------|
| `prove-by-contradiction` | Set up proof by contradiction |
| `verify-equivalence` | Check formula equivalence |
| `formalize` | Natural language to FOL translation guide |
| `diagnose-unsat` | Diagnose unsatisfiable premises |
| `explain-proof` | Explain proven theorem |

## Verbosity Control

All tools support a `verbosity` parameter:

| Level | Description | Use Case |
|-------|-------------|----------|
| `minimal` | Just success/result | Token-efficient LLM chains |
| `standard` | + message, bindings, engineUsed | Default balance |
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

### 1. Prove a Theorem (with Engine Selection)

```json
{
  "name": "prove",
  "arguments": {
    "premises": [
      "all x (man(x) -> mortal(x))",
      "man(socrates)"
    ],
    "conclusion": "mortal(socrates)",
    "engine": "prolog"
  }
}
```

### 2. Prove with SAT Engine (Non-Horn)

```json
{
  "name": "prove",
  "arguments": {
    "premises": ["alpha | beta", "alpha -> gamma", "beta -> gamma"],
    "conclusion": "gamma",
    "engine": "sat"
  }
}
```

### 3. Find a Counterexample

```json
{
  "name": "find-counterexample",
  "arguments": {
    "premises": ["P(a)"],
    "conclusion": "P(b)"
  }
}
```

### 4. Session-Based Reasoning

```json
// 1. Create a session
{ "name": "create-session", "arguments": { "ttl_minutes": 30 } }

// 2. Assert premises
{ "name": "assert-premise", "arguments": { 
    "session_id": "abc-123...", 
    "formula": "all x (man(x) -> mortal(x))" 
}}

// 3. Query the KB
{ "name": "query-session", "arguments": { 
    "session_id": "abc-123...", 
    "goal": "mortal(socrates)" 
}}

// 4. Cleanup
{ "name": "delete-session", "arguments": { "session_id": "abc-123..." } }
```

## Project Structure

```
mcplogic/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # CLI entry point
│   ├── server.ts             # MCP server (13 tools)
│   ├── parser.ts             # FOL tokenizer & parser
│   ├── translator.ts         # FOL ↔ Prolog conversion
│   ├── logicEngine.ts        # Tau-Prolog wrapper
│   ├── clausifier.ts         # CNF clausification & DIMACS export
│   ├── syntaxValidator.ts    # Syntax validation
│   ├── categoricalHelpers.ts # Category theory
│   ├── modelFinder.ts        # Finite model enumeration
│   ├── sessionManager.ts     # Session lifecycle
│   ├── equalityAxioms.ts     # Equality reasoning
│   ├── engines/
│   │   ├── interface.ts      # ReasoningEngine interface
│   │   ├── manager.ts        # Engine federation
│   │   ├── prolog.ts         # Prolog engine adapter
│   │   └── sat.ts            # SAT engine adapter
│   ├── resources/
│   │   └── axioms.ts         # MCP resources
│   ├── prompts/
│   │   └── index.ts          # MCP prompts
│   └── types/
│       ├── index.ts          # Shared types
│       ├── errors.ts         # Structured errors
│       └── clause.ts         # CNF clause types
└── tests/                    # 254 tests
```

## Technical Details

### Engine Federation

The `EngineManager` automatically selects the best engine:

1. **Formula Analysis** — Clausifies input to determine structure
2. **Horn Check** — If all clauses are Horn, uses Prolog
3. **SAT Fallback** — Non-Horn formulas route to MiniSat
4. **Explicit Override** — `engine` parameter forces specific engine

### CNF Clausification

The clausifier transforms arbitrary FOL to CNF:

1. Eliminate biconditionals and implications
2. Push negations inward (NNF)
3. Standardize variable names
4. Skolemize existentials
5. Drop universal quantifiers
6. Distribute OR over AND
7. Extract clauses

### DIMACS Export

For external SAT solver interop:

```typescript
import { clausify, clausesToDIMACS } from './clausifier';

const result = clausify('(P -> Q) & P');
const dimacs = clausesToDIMACS(result.clauses);
// dimacs.dimacs = "p cnf 2 2\n-1 2 0\n1 0"
// dimacs.varMap = Map { 'P' => 1, 'Q' => 2 }
```

### Structured Errors

All errors include machine-readable information:

```typescript
interface LogicError {
  code: LogicErrorCode;    // 'PARSE_ERROR' | 'INFERENCE_LIMIT' | ...
  message: string;
  span?: { start, end, line, col };
  suggestion?: string;
  context?: string;
}
```

## API Reference

### prove

```typescript
interface ProveArgs {
  premises: string[];
  conclusion: string;
  inference_limit?: number;     // Max steps (default: 1000)
  engine?: 'prolog' | 'sat' | 'auto';  // Engine selection
  enable_arithmetic?: boolean;  // Enable arithmetic predicates
  enable_equality?: boolean;    // Inject equality axioms
  verbosity?: 'minimal' | 'standard' | 'detailed';
}

interface ProveResult {
  success: boolean;
  result: 'proved' | 'failed' | 'timeout' | 'error';
  message?: string;
  engineUsed?: string;          // Which engine was used
  bindings?: Record<string, string>[];
  proof?: string[];
  prologProgram?: string;       // (detailed only)
  statistics?: { timeMs: number; inferences?: number };
}
```

### check-well-formed

```typescript
interface CheckArgs {
  statements: string[];
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

### find-model / find-counterexample

```typescript
interface FindModelArgs {
  premises: string[];
  domain_size?: number;
  max_domain_size?: number;     // Default: 10
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
}
```

### Session Tools

```typescript
// create-session
{ session_id: string; expires_at: string; ttl_minutes: number }

// assert-premise
{ success: boolean; premise_count: number }

// query-session
{ success: boolean; result: string; engineUsed?: string }

// list-premises
{ premises: string[]; premise_count: number }
```

## Limitations

1. **Inference Depth** — Complex proofs may exceed limits
2. **Model Size** — Finder limited to domains ≤10 elements
3. **SAT Variables** — Arithmetic not supported in SAT engine
4. **Higher-Order** — Only first-order logic supported

## Troubleshooting

### "No proof found" for valid theorem
- Increase `inference_limit` for complex proofs
- Try `engine: 'sat'` for non-Horn formulas
- Enable `enable_equality` if using equality

### Model finder returns "no_model"
- Increase `max_domain_size`
- Check for contradictory premises

### Session errors
- Check session hasn't expired (default: 30 min)
- Use `list-premises` to inspect state

## Development

```bash
npm test          # Run 254 tests
npm run build     # Compile TypeScript
npx tsc --noEmit  # Type check only
```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `npm test`
4. Submit a pull request

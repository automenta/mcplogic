# 🧠 MCR: The Neurosymbolic Reasoning Core

**Model Context Reasoner (MCR)** is a library designed to be the foundation for the next generation of AI systems. It
fuses the perceptual power of Large Language Models (LLMs) with the rigorous logic of symbolic reasoners, creating a
hybrid system that is both intuitive and verifiable.

This is not just a tool; it is the starting point for building the ultimate neurosymbolic reasoner—an AI that can
understand the world, reason about it with logical precision, and explain its conclusions.

## 🏛️ Core Principles

MCR is built on a foundation designed for limitless growth.

1. **Symbolic Core, Neural Interface:** At its heart is a deterministic, verifiable logic engine (Prolog). LLMs act as a
   fluid, intuitive interface, translating the unstructured, ambiguous human world into the structured, logical core.
2. **Explainable by Design:** Every conclusion can be traced back to the specific facts and rules that produced it. The
   system can always "show its work," providing a level of transparency impossible with purely neural systems.
3. **Dynamic Knowledge Graph:** The knowledge base is not a static set of facts but a living, dynamic graph that is
   continuously updated and refined through interaction.
4. **Evolvable Reasoning:** The methods for translating language to logic (**Translation Strategies**) are designed to
   be pluggable, comparable, and ultimately, evolvable. The system is built to learn and improve its own reasoning
   processes over time.

## ✨ Features (The Foundation)

* **Library-First API**: A clean, modern `async/await` API that integrates directly into your application.
* **Stateful Reasoning Sessions**: Create isolated reasoning contexts, each with its own independent, persistent
  knowledge graph.
* **Pluggable LLMs & Strategies**: Swap LLM providers and reasoning strategies with configuration changes.
* **Direct & Hybrid Reasoning**: Execute pure symbolic logic for speed and precision, or allow the system to fall back
  to the LLM for sub-symbolic queries when formal deduction yields no answer.
* **Rich, Explainable Outputs**: Queries don't just return an answer; they return the answer *and* the logical steps
  used to reach it, along with confidence scores.

## 🏗️ Ontology Support

MCR now supports ontologies to constrain your knowledge graph:

```javascript
const session = mcr.createSession({
  ontology: {
    types: ['bird', 'canary'],
    relationships: ['has_wings', 'can_fly']
  }
});

// This will succeed
await session.assert('Tweety is a bird');

// This will fail - 'fish' not in ontology
await session.assert('Nemo is a fish');
```

The ontology ensures your knowledge graph maintains semantic consistency by:

- Validating all asserted facts and rules
- Preventing undefined predicates
- Maintaining type consistency

## 🚀 Quick Start

**1. Install:**

```bash
npm install model-context-reasoner
```

**2. Configure:**

Create a `.env` file with your LLM API key.

```dotenv
# .env
OPENAI_API_KEY="sk-..."
```

**3. Build a Reasoner:**

The core workflow is to create a session, populate its knowledge graph, and then ask it to reason about that knowledge.

```javascript
// main.js
require('dotenv').config();
const { MCR } = require('model-context-reasoner');
const { OpenAI } = require('openai'); // NEW: Import OpenAI client if using it directly

async function main() {
  // Option 1: Configure MCR with API Key (Recommended for OpenAI)
  const mcr = new MCR({
    llm: { provider: 'openai', apiKey: process.env.OPENAI_API_KEY }
  });

  // Option 2: Provide a pre-initialized LLM client (for any provider conforming to OpenAI's chat API)
  // const customLlmClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Example for OpenAI
  // const mcr = new MCR({
  //   llm: { client: customLlmClient, model: 'gpt-4o-mini' } // Specify model if not 'gpt-3.5-turbo'
  // });

  // Option 3: Use MCR without LLM capabilities (for symbolic reasoning only)
  // const mcr = new MCR({});
  
  const session = mcr.createSession();
  
  await session.assert('All canaries are birds.');
  await session.assert('All birds have wings.');
  await session.assert('Tweety is a canary.');
  
  // Query with Prolog
  const prologResult = await session.query('has_wings(tweety)');
  console.log(`Prolog answer: ${prologResult.success ? 'Yes' : 'No'}`);
  console.log(`Confidence: ${prologResult.confidence}`);
  
  // Query with natural language and fallback (requires LLM)
  // Note: if mcr was initialized without an LLM, this will fail or return default
  const naturalResult = await session.nquery('Does tweety have wings?', { allowSubSymbolicFallback: true });
  console.log(`Natural language query result:`);
  console.log(`  Success: ${naturalResult.success}`);
  console.log(`  Bindings: ${naturalResult.bindings ? naturalResult.bindings.join(', ') : 'None'}`);
  console.log(`  Explanation: ${naturalResult.explanation.join('\n    ')}`);
  console.log(`  Confidence: ${naturalResult.confidence}`);
  
  // Demonstrating direct Prolog assertion and retraction
  console.log('\n--- Direct Prolog Management ---');
  const assertPrologResult = session.assertProlog('mammal(elephant).');
  console.log(`Direct Assert 'mammal(elephant).': Success: ${assertPrologResult.success}`);
  let directQueryResult = await session.query('mammal(X).');
  console.log(`Query 'mammal(X).': Bindings: ${directQueryResult.bindings ? directQueryResult.bindings.join(', ') : 'None'}`);

  const retractPrologResult = session.retractProlog('mammal(elephant).');
  console.log(`Direct Retract 'mammal(elephant).': Success: ${retractPrologResult.success}`);
  directQueryResult = await session.query('mammal(X).');
  console.log(`Query 'mammal(X).': Bindings: ${directQueryResult.bindings ? directQueryResult.bindings.join(', ') : 'None'}`); // Should be None

  // Demonstrating high-level fact/relationship/rule management
  console.log('\n--- High-Level Fact/Relationship/Rule Management ---');
  // First, add types to ontology for validation.
  // Note: The session was created without an initial ontology, so we add terms dynamically.
  session.addType('person');
  session.defineRelationshipType('likes');
  session.addType('food');
  session.addSynonym('human', 'person');

  const addFactResult = session.addFact('alice', 'person');
  console.log(`Add Fact 'alice is a person': Success: ${addFactResult.success}`);
  const addRelationshipResult = session.addRelationship('alice', 'likes', 'pizza');
  console.log(`Add Relationship 'alice likes pizza': Success: ${addRelationshipResult.success}`);
  const addRuleResult = session.addRule('eats_pizza(X) :- person(X), likes(X, pizza).');
  console.log(`Add Rule 'eats_pizza(X) :- ...': Success: ${addRuleResult.success}`);

  let kgCurrent = session.getKnowledgeGraph().prolog;
  console.log(`Current KG (excerpt):\n${kgCurrent.split('\n').filter(l => l.includes('alice') || l.includes('pizza') || l.includes('eats_pizza')).join('\n')}`);

  let queryPizza = await session.query('eats_pizza(alice).');
  console.log(`Query 'eats_pizza(alice).': Success: ${queryPizza.success}`);

  const removeRelationshipResult = session.removeRelationship('alice', 'likes', 'pizza');
  console.log(`Remove Relationship 'alice likes pizza': Success: ${removeRelationshipResult.success}`);
  queryPizza = await session.query('eats_pizza(alice).');
  console.log(`Query 'eats_pizza(alice).': Success after removal: ${queryPizza.success}`); // Should be false

  const removeFactResult = session.removeFact('alice', 'person');
  console.log(`Remove Fact 'alice is a person': Success: ${removeFactResult.success}`);

  const removeRuleResult = session.removeRule('eats_pizza(X) :- person(X), likes(X, pizza).');
  console.log(`Remove Rule 'eats_pizza(X) :- ...': Success: ${removeRuleResult.success}`);


  // Demonstrating Ontology Management (beyond initial setup)
  console.log('\n--- Ontology Management ---');
  session.addConstraint('unique_name');
  console.log(`Added constraint 'unique_name'. Current constraints: ${Array.from(session.ontology.constraints).join(', ')}`);

  // Demonstrating session state management
  console.log('\n--- Session State Management ---');
  session.clear();
  console.log(`Session cleared. KG empty: ${session.getKnowledgeGraph().prolog === ''}`);

  const dogAssertResult = await session.assert('The dog is happy.'); // Add a fact after clearing
  console.log(`KG after assert: ${session.getKnowledgeGraph().prolog}`);
  const savedState = session.saveState();
  console.log(`Session state saved. Length: ${savedState.length}`);

  const loadedSession = mcr.createSession();
  loadedSession.loadState(savedState);
  console.log(`State loaded into new session. KG: ${loadedSession.getKnowledgeGraph().prolog}`);

  // Demonstrating reload ontology and revalidation
  console.log('\n--- Ontology Reload and Revalidation ---');
  session.addType('animal'); // Add 'animal' type to allow asserting 'animal(cat).'
  session.assertProlog('animal(cat).');
  console.log(`KG before ontology reload: ${session.getKnowledgeGraph().prolog}`);
  
  session.reloadOntology({
    types: ['pet'], // 'animal' is removed, 'pet' is new
    relationships: [],
    constraints: [],
    synonyms: {}
  });
  console.log(`KG after ontology reload (animal(cat) should be gone due to revalidation): ${session.getKnowledgeGraph().prolog}`); // Should be empty
  console.log(`New ontology types: ${Array.from(session.ontology.types).join(', ')}`);


  // Reason about task (requires LLM)
  const reasoning = await session.reason('Determine if Tweety can migrate.', { allowSubSymbolicFallback: true });
  console.log(`\nReasoning Task Result:`);
  console.log(`  Answer: ${reasoning.answer}`);
  console.log(`  Steps:\n    ${reasoning.steps.join('\n    ')}`);
  console.log(`  Confidence: ${reasoning.confidence}`);

  // NEW: Get global LLM usage metrics
  console.log('\n--- Session LLM Metrics ---');
  const sessionLlmMetrics = session.getLlmMetrics();
  console.log(`Session LLM Calls: ${sessionLlmMetrics.calls}`);
  console.log(`Session LLM Prompt Tokens: ${sessionLlmMetrics.promptTokens}`);
  console.log(`Session LLM Completion Tokens: ${sessionLlmMetrics.completionTokens}`);
  console.log(`Session LLM Latency (ms): ${sessionLlmMetrics.totalLatencyMs}`);

  const globalLlmMetrics = mcr.getLlmMetrics();
  console.log(`\nTotal LLM Calls: ${globalLlmMetrics.calls}`);
  console.log(`Total LLM Prompt Tokens: ${globalLlmMetrics.promptTokens}`);
  console.log(`Total LLM Completion Tokens: ${globalLlmMetrics.completionTokens}`);
  console.log(`Total LLM Latency (ms): ${globalLlmMetrics.totalLatencyMs}`);
}

main().catch(console.error);
```

**Expected Output:**

```
Prolog answer: Yes
Confidence: 1.0
Natural language query result:
  Success: true
  Bindings: true
  Explanation: Derived: true
  Confidence: 1.0

Reasoning Task Result:
  Answer: Yes, Tweety can migrate.
  Steps:
    Agent Action (1): Type: query, Content: can_migrate(tweety)
    Query Result: Success: true, Bindings: true, Confidence: 1
    Agent Action (2): Type: conclude, Content: Yes, Tweety can migrate.
  Confidence: 1.0

--- Direct Prolog Management ---
Direct Assert 'mammal(elephant).': Success: true
Query 'mammal(X).': Bindings: X = elephant
Direct Retract 'mammal(elephant).': Success: true
Query 'mammal(X).': Bindings: None

--- High-Level Fact/Relationship/Rule Management ---
Add Fact 'alice is a person': Success: true
Add Relationship 'alice likes pizza': Success: true
Add Rule 'eats_pizza(X) :- ...': Success: true
Current KG (excerpt):
person(alice).
likes(alice, pizza).
eats_pizza(X) :- person(X), likes(X, pizza).
Query 'eats_pizza(alice).': Success: true
Remove Relationship 'alice likes pizza': Success: true
Query 'eats_pizza(alice).': Success after removal: false
Remove Fact 'alice is a person': Success: true
Remove Rule 'eats_pizza(X) :- ...': Success: true

--- Ontology Management ---
Added constraint 'unique_name'. Current constraints: unique_name

--- Session State Management ---
Session cleared. KG empty: true
KG after assert: happy(dog).
Session state saved. Length: <some-number-e.g.-118>
State loaded into new session. KG: happy(dog).

--- Ontology Reload and Revalidation ---
KG before ontology reload: animal(cat).
KG after ontology reload (animal(cat) should be gone due to revalidation): 
New ontology types: pet

Reasoning Task Result:
  Answer: Yes, Tweety can migrate.
  Steps:
    Agent Action (1): Type: query, Content: can_migrate(tweety)
    Query Result: Success: true, Bindings: true, Confidence: 1
    Agent Action (2): Type: conclude, Content: Yes, Tweety can migrate.
  Confidence: 1.0

Total LLM Calls: <some-number>
Total LLM Prompt Tokens: <some-number>
Total LLM Completion Tokens: <some-number>
Total LLM Latency (ms): <some-number>
````

````javascript
src/translation/agenticReasoning.js
<<<<<<< SEARCH
Examples:
To assert a fact: {"type":"assert","content":"bird(tweety)."}
To assert a rule: {"type":"assert","content":"flies(X) :- bird(X)."}
To query the knowledge base: {"type":"query","content":"has_wings(tweety)."}
To conclude the task: {"type":"conclude","answer":"Yes, Tweety can fly.","explanation":"Derived from bird(tweety) and flies(X) :- bird(X)."}
```

## 📦 API Reference

### `MCR` Class

*   `new MCR(config)`: Creates a new MCR instance.
    *   `config.llm.apiKey` (string): API key for supported providers (e.g., OpenAI).
    *   `config.llm.provider` (string, optional): 'openai'. If not 'openai', requires `llm.client`.
    *   `config.llm.client` (object, optional): A pre-initialized LLM client instance (e.g., `new OpenAI()`). Overrides `apiKey` and `provider`.
    *   `config.llm.model` (string, optional): LLM model name (default: 'gpt-3.5-turbo').
*   `createSession(options)`: Creates and returns a new `Session` object.
    *   `options.translator` (string or array of strings, optional): Specifies which translation strategy/strategies to use.
        *   If a string (e.g., `'direct'`, `'json'`), it uses that strategy.
        *   If an array of strings (e.g., `['json', 'direct']`), it attempts strategies in order, falling back to the next on failure.
        *   If a function, it uses a custom translator function.
        *   Default: `['direct', 'json']` (attempts 'direct' then 'json' on failure).
*   `registerStrategy(name, strategyFn)`: Registers a custom translation strategy.
*   `getLlmMetrics()`: Returns aggregated LLM usage metrics across all sessions created by this MCR instance.
    *   **Returns**: An object containing:
        *   `promptTokens`: Total tokens sent in prompts.
        *   `completionTokens`: Total tokens received in completions.
        *   `totalTokens`: Sum of prompt and completion tokens.
        *   `calls`: Total number of LLM API calls.
        *   `totalLatencyMs`: Total time spent waiting for LLM responses.

---

### `Session` Class

Represents an isolated reasoning context and its knowledge graph.

*   `async assert(naturalLanguageText)`: Translates a statement into a symbolic representation and integrates it into the knowledge graph.
    *   **Returns**: An object containing:
        *   `success`: A boolean indicating whether the assertion succeeded.
        *   `symbolicRepresentation`: The Prolog clause that was attempted or added.
        *   `originalText`: The original natural language input.
        *   `error` (optional): Error message if assertion failed.
*   `assertProlog(prologClause)`: Directly asserts a Prolog clause into the knowledge graph with ontology validation.
    *   **Returns**: An object containing `success`, `symbolicRepresentation`, and `error` (optional).
*   `retractProlog(prologClause)`: Removes a specific Prolog clause from the knowledge graph.
    *   **Returns**: An object `{ success: boolean, message: string }`.
*   `addFact(entity, type)`: Adds a simple type fact (e.g., `bird(tweety).`) to the knowledge graph, performing ontology validation.
    *   **Returns**: An object containing `success`, `symbolicRepresentation`, and `error` (optional).
*   `addRelationship(subject, relation, object)`: Adds a relationship fact (e.g., `loves(john, mary).`) to the knowledge graph, performing ontology validation.
    *   **Returns**: An object containing `success`, `symbolicRepresentation`, and `error` (optional).
*   `removeFact(entity, type)`: Removes a simple type fact (e.g., `bird(tweety).`) from the knowledge graph.
    *   **Returns**: An object `{ success: boolean, message: string }`.
*   `removeRelationship(subject, relation, object)`: Removes a relationship fact (e.g., `loves(john, mary).`) from the knowledge graph.
    *   **Returns**: An object `{ success: boolean, message: string }`.
*   `addType(type)`: Adds a new entity type to the session's ontology.
*   `defineRelationshipType(relationship)`: Adds a new relationship type to the session's ontology.
*   `addConstraint(constraint)`: Adds a new constraint to the session's ontology.
*   `addSynonym(originalTerm, synonym)`: Adds a new synonym mapping to the session's ontology.
*   `async query(prologQuery, options)`: Executes a Prolog query against the knowledge graph.
    *   **Options**: 
        *   `allowSubSymbolicFallback` (boolean): Enable fallback to LLM if symbolic query fails.
    *   **Returns**: An object containing:
        *   `success`: Boolean indicating query success.
        *   `bindings`: Variable bindings or LLM response (can be `null`).
        *   `explanation`: Array of reasoning steps.
        *   `confidence`: Numerical confidence score (0.0-1.0).
*   `async nquery(naturalLanguageQuery, options)`: Translates natural language question to Prolog and executes query.
    *   **Returns**: Same object as `query()`, with an additional `prologQuery` field containing the translated query string.
*   `async reason(taskDescription, options)`: Uses an agentic loop for multi-step reasoning to achieve a higher-level goal.
    *   **Options**:
        *   `maxSteps` (number): Maximum number of reasoning steps the agent can take (default: 5).
        *   `allowSubSymbolicFallback` (boolean): Enable fallback to LLM for queries within the reasoning process.
    *   **Returns**: An object containing:
        *   `answer`: The final natural language answer (e.g., 'Yes', 'No', 'Inconclusive').
        *   `steps`: Array of natural language descriptions of reasoning steps.
        *   `confidence`: Numerical confidence score.
*   `getKnowledgeGraph(format = 'prolog')`: Returns the entire knowledge graph.
    *   `format`: `'prolog'` (default) returns the knowledge graph as a newline-separated string. `'json'` returns a structured object containing facts, rules, and ontology terms.
*   `getOntology()`: Returns a structured object representing the current session's ontology.
    *   **Returns**: An object containing `types`, `relationships`, `constraints`, and `synonyms`.
*   `saveState()`: Returns a JSON string representing the current session's state (program, ontology, sessionId).
*   `loadState(state)`: Loads a session's state from a JSON string.
*   `clear()`: Clears the session's program and resets its Prolog session.
*   `reloadOntology(newOntology)`: Replaces the current ontology and revalidates the existing program against it.
*   `getLlmMetrics()`: Returns LLM usage metrics specific to this session.
    *   **Returns**: An object identical in structure to `MCR.getLlmMetrics()`, but specific to the session.

## 🔄 Session Management

MCR supports advanced session management:

```javascript
// Save session state
const savedState = session.saveState();

// Create new session with saved state
const newSession = mcr.createSession();
newSession.loadState(savedState);

// Clear session knowledge
session.clear();

// Update ontology dynamically
session.reloadOntology({
  types: ['mammal', 'bird'],
  relationships: ['eats', 'flies']
});
```

## 🧩 Translation Strategies

MCR uses a tiered translation approach:
1. Direct-to-Prolog: Simple LLM prompt for conversion
2. JSON-to-Prolog: Structured intermediate representation
3. Auto-fallback: Automatically retries with JSON on failure

## 🧠 Core Concepts: The Path to AGI

The simple API above is the interface to a powerful set of underlying concepts designed for future growth.

### Translation Strategies

A Translation Strategy is a "pluggable mind" for the reasoner. It defines how to convert between the neural and symbolic worlds. The initial library will include basic strategies (e.g., "Direct-to-Prolog"), but the architecture is designed for advanced strategies that can:

*   Use a **Structured Intermediate Representation** (e.g., JSON) to eliminate LLM syntax errors.
*   Perform **self-correction** by re-prompting the LLM upon failure.
*   Query **external tools and APIs** to gather new knowledge before asserting it.

### The Dynamic Knowledge Graph

The "KB" is more than a static database. It's a graph that can be actively shaped and constrained by **ontologies**. You can provide an ontology that defines the "shape" of the world—the types of entities and relationships they can have. This allows the reasoner to:

*   Identify and reject nonsensical assertions ("Socrates is a color").
*   Ask clarifying questions when faced with ambiguity.
*   Infer missing information based on the defined structure of the world.

### The Hybrid Reasoning Engine

MCR is designed for **hybrid reasoning**. While the Prolog core provides speed and verifiability, some questions are inherently sub-symbolic ("What is the sentiment of this sentence?"). The `query` method's `allowSubSymbolicFallback` option is the entry point to this hybrid capability, allowing the system to seamlessly choose the right tool for the job.

## 🛣️ The Road Ahead: Future Directions

MCR is architected to evolve. The foundational features are the launchpad for a system that will progressively gain more advanced, autonomous capabilities.

*   **Strategy Evolution**: The system will log the performance (latency, accuracy, cost) of its Translation Strategies. This data will be used to create a feedback loop, allowing an "optimizer" process to critique, refine, and generate new, more effective strategies automatically.
*   **Automated Knowledge Acquisition**: Future versions will be able to ingest and understand unstructured documents, websites, or API documentation, automatically building and updating their own knowledge graphs.
*   **Multi-Modal Reasoning**: The architecture is designed to support future strategies that can translate inputs from other modalities—such as image recognition or data streams—into the symbolic core, enabling reasoning across different types of information.
*   **Goal-Oriented Agency**: The `reason()` method will evolve into a true agentic loop, capable of breaking down complex goals into smaller, solvable steps of assertion and querying.

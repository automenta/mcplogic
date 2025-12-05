# 🧠 Model Context Reasoner (MCR) v3 ✨

The **Model Context Reasoner (MCR)** is a powerful, API-driven system that serves as a **logic co-processor for your AI
**. It fuses the powerful language understanding of Large Language Models (LLMs) with the precision of a formal logic
reasoner, creating a hybrid system that is both intuitive and verifiable.

MCR is designed to be the **neurosymbolic brain** of an application, providing the intelligence, reasoning, and planning
capabilities required to solve complex problems.

## 🎸 The MCR Philosophy: The "Guitar Pedal" for Reasoning

MCR is built with a "guitar pedal" philosophy: a single, plug-and-play unit that adds advanced reasoning to your AI
stack with minimal setup. It's a self-contained service that you can easily "plug in" to an existing system via its
modern WebSocket API to empower it with logic.

**Vision: The Symbiosis of Language and Logic**

LLMs excel at understanding nuance and intent in human language. Formal logic systems, like Prolog, offer precision and
verifiability. MCR's vision is to create a seamless symbiosis between these two paradigms, enabling systems that can:

1. **Understand Intent** through natural language (via LLMs).
2. **Structure Knowledge** into formal representations (MCR + LLMs).
3. **Reason Rigorously** over that knowledge (`tau-prolog` via MCR).
4. **Communicate Results** back in an understandable way (MCR + LLMs).

This combination unlocks a new class of more robust, explainable, and sophisticated AI systems.

## 🔑 Core Concepts

1. **Stateful Sessions**: All interactions occur within a `Session`, identified by a `sessionId`. Each session maintains
   its own independent **Knowledge Base**, allowing for parallel, isolated reasoning contexts.

2. **The Knowledge Base (KB)**: A collection of symbolic logic clauses (facts and rules) in Prolog format. The KB is
   dynamic, allowing knowledge to be asserted, retracted, and updated on the fly.

3. **LLM-Powered Translation**: MCR uses LLMs to bidirectionally translate between natural language and formal logic.
   This is the core mechanism for both understanding user input and explaining logical results.

4. **Translation Strategies**: The methodology for converting natural language into logic is defined by **Translation
   Strategies**. These are configurable, pluggable pipelines that define how to prompt an LLM and process its output. In
   `mcr3`, these strategies are implemented using **`langchain.js`**, allowing for sophisticated, multi-step reasoning
   chains.

5. **Terminal User Interface (TUI)**: MCR is operated through a powerful and intuitive terminal-based interface,
   providing direct access to its reasoning capabilities.

6. **WebSocket-First API**: All core server interactions happen via a real-time WebSocket API, enabling features like
   live updates to a session's Knowledge Base and streaming responses.

## 🚀 Features

- **Node.js Server**: A robust, standalone server built on Node.js, designed for performance and scalability.
- **WebSocket-First API**: A real-time, bidirectional API for all core operations.
- **`tau-prolog` Integration**: Leverages the power of `tau-prolog`, a fully-featured Prolog interpreter written in
  JavaScript, for all symbolic reasoning.
- **`langchain.js` Powered**: Uses `langchain.js` for sophisticated LLM interactions, including prompt management,
  output parsing, and the creation of complex reasoning chains using LangChain Expression Language (LCEL).
- **Terminal User Interface (TUI)**: A powerful and intuitive terminal-based interface for all user interaction,
  including session management and system analysis.
- **Stateful Sessions**: Supports in-memory session storage.
- **Extensible LLM Support**: Pluggable architecture for supporting various LLM providers (OpenAI, Gemini, Ollama,
  etc.).

### `langchain.js` Integration

`mcr3` leverages `langchain.js` as the primary engine for orchestrating interactions with LLMs. This is a significant
architectural choice that makes the system more modular, powerful, and easier to extend.

- **Translation Strategies as Chains**: Instead of monolithic prompt templates, each **Translation Strategy** is defined
  as a `langchain.js` chain, likely using the **LangChain Expression Language (LCEL)**. This allows for clear,
  composable, and debuggable sequences of operations (e.g., `prompt | llm | output_parser`).

- **Modular Components**: `langchain.js` provides robust components for:
    - **Prompt Templates**: Managing and composing prompts.
    - **LLM Wrappers**: Standardizing the interface to different LLM providers.
    - **Output Parsers**: Reliably parsing LLM output from natural language into structured formats like JSON or
      directly into Prolog syntax.

- **Simplified Strategy Execution**: The `StrategyExecutor`'s role becomes orchestrating the invocation of these
  pre-defined `langchain.js` chains, simplifying the core logic and delegating the complexities of the LLM interaction
  to LangChain. This makes it easier to experiment with and evolve new strategies.

### 🚀 Getting Started

**1. Installation & Setup**

**A. Clone and Install:**

```bash
git clone https://github.com/your-repo/mcr3.git # Replace with the actual repo URL
cd mcr3
npm install
```

**B. Configure Your LLM:**
Create a `.env` file by copying the example, then add your LLM provider API key.

```bash
cp .env.example .env
# Now, edit .env
```

```dotenv
# .env
MCR_LLM_PROVIDER="openai" # or "gemini", "ollama"
OPENAI_API_KEY="sk-..."   # Your key here
```

**C. Start the MCR Server:**
This command launches the MCR WebSocket server, making it ready for connections from the TUI or an MCP client.

```bash
npm start
```

The server will start on the port configured in `.env` (default: `8080`).

#### 2. Usage as a Standalone Tool (TUI)

To interact with MCR directly, run the Terminal UI in a separate terminal.

```bash
npm run tui
```

The TUI provides an interactive command-line environment to create sessions, assert facts, ask questions, and manage the
reasoning engine.

#### 3. Usage via WebSocket

**Connecting and Communicating:**

- **Endpoint**: Clients should connect to the WebSocket server at `ws://localhost:8080/ws`.
- **Protocol**: MCR3 listens for `tool_invoke` and responds with `tool_result` messages on this endpoint. It uses the
  `tool_name` to route requests to its internal functions.

**Example: Asserting a Fact via WebSocket**
A client would send a JSON message like this over the WebSocket connection:

```json
{
  "type": "tool_invoke",
  "messageId": "msg_12345",
  "payload": {
    "tool_name": "session.assert",
    "input": {
      "sessionId": "session-abc",
      "naturalLanguageInput": "Socrates is a man."
    }
  }
}
```

MCR3 will process this request and respond with a `tool_result` message.

### 🤖 Future Work

This version of MCR3 provides a solid foundation for neurosymbolic reasoning. Future versions could include:

- **Automated Evolution Engine**: A self-optimizing system that autonomously discovers, evaluates, and refines
  translation strategies to continuously improve performance.
- **MCP Integration**: Full compliance with the Model Context Protocol to serve as a reasoning tool for AI agents.
- **Persistent Sessions**: Support for file-based or database-backed session storage to allow knowledge bases to persist
  across server restarts.
- **Ontology-Awareness**: The ability to define and validate against an ontology to ensure the semantic consistency of
  the knowledge base.

### 🧪 Testing

The project includes a comprehensive test suite for the backend services.

- **Run All Tests (Jest):**
  From the project root:
  ```bash
  npm test
  ```

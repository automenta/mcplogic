# 🧠 MCR4 - Neurosymbolic Reasoning Platform

MCR4 combines Large Language Models (LLMs) with symbolic reasoning (Prolog) to create verifiable, explainable AI
systems.

## ✨ Features

- Hybrid reasoning combining neural networks with symbolic logic
- Stateful sessions with persistent knowledge bases
- Real-time WebSocket API (MCP protocol)
- Interactive CLI interface
- Docker container support
- Ontology-aware knowledge validation
- Translation strategies with langchain.js

## 🚀 Quick Start

### Run with Node.js

```bash
# Clone repository
git clone https://github.com/your-repo/mcr4.git
cd mcr4

# Install dependencies
npm install

# Start MCP server
node src/mcp/server.js

# Use CLI interface in another terminal
node src/cli/index.js
```

### Run with Docker

```bash
docker build -t mcr4 .
docker run -p 8080:8080 -e OPENAI_API_KEY=your_api_key mcr4
```

## 📖 CLI Usage

```bash
mcr> new
Created session: session_12345

mcr> assert "Socrates is a man"
Asserted: man(socrates)

mcr> assert "All men are mortal"
Asserted: mortal(X) :- man(X)

mcr> query "Is Socrates mortal?"
Answer: Yes, Socrates is mortal.
```

## 📡 API Reference

Connect via WebSocket: `ws://localhost:8080`

### Message Format

```json
{
  "type": "session.create",
  "payload": {}
}
```

### Operations:

- `session.create` - Create new session
- `session.assert` - Assert natural language to KB
- `session.query` - Query session with natural language

## 🐳 Docker Deployment

```bash
docker-compose up
```

## 📂 Project Structure

```
mcr4/
├── src/
│   ├── mcr/           # Core reasoning services
│   ├── mcp/           # Model Context Protocol
│   └── cli/           # Command-line interface
├── strategies/        # Translation strategies
├── tests/             # Comprehensive tests
├── Dockerfile         # Containerization
└── docker-compose.yml # Development environment
```

## 🧪 Testing

Run tests with:

```bash
npm test
```

## 📜 License

MIT

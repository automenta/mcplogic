# Running with Local LLMs

The MCP Logic Server can be configured to use local Large Language Models (LLMs) instead of cloud-based APIs like OpenAI. This allows for offline, private, and cost-free natural language translation to First-Order Logic.

## Prerequisites

You need a tool that can serve an LLM via an OpenAI-compatible API. Common options include:

-   **Llama.cpp Server** (`llama-server`)
-   **Ollama**
-   **LocalAI**
-   **vLLM**

## Recommended Model

For best results with logic translation, we recommend a model with strong reasoning capabilities. A good starting point for local usage (low resource) is:

-   **Qwen2.5-0.5B-Instruct** (Fast, lightweight)
-   **Llama-3-8B-Instruct** (More powerful, requires more RAM)

## Configuration

You can configure the server using environment variables.

### Option 1: Using Llama.cpp Server

1.  Download a GGUF model (e.g., `Qwen2.5-0.5B-Instruct-Q4_K_M.gguf`).
2.  Start the server:
    ```bash
    ./llama-server -m models/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf --port 8080 --host 0.0.0.0
    ```
3.  Configure MCP Logic Server:
    ```bash
    export OPENAI_BASE_URL="http://localhost:8080/v1"
    # OPENAI_API_KEY is not strictly required for local servers but can be set to any string if the client complains
    export OPENAI_API_KEY="sk-dummy"
    ```

### Option 2: Using Ollama

1.  Install Ollama and pull a model:
    ```bash
    ollama pull llama3
    ```
2.  Ollama runs on port 11434 by default.
3.  Configure MCP Logic Server:
    ```bash
    export OLLAMA_URL="http://localhost:11434/api/chat"
    export OLLAMA_MODEL="llama3"
    ```
    *(Note: If `OPENAI_BASE_URL` is set, it takes precedence. For Ollama, you can also use its OpenAI-compatible endpoint at `http://localhost:11434/v1` and set `OPENAI_BASE_URL` instead.)*

## Verification

To verify that the system is using your local LLM:

1.  Set the environment variables.
2.  Run the MCP server.
3.  Use the `translate-text` tool with a simple query like "All men are mortal."
4.  Check your local LLM server logs to see the request coming in.

## Troubleshooting

-   **"LLM Provider failed"**: Ensure your local server is running and accessible at the configured URL. Check if you need `/v1` or `/v1/chat/completions` in the URL (the server code appends `/chat/completions` automatically if using `OPENAI_BASE_URL` and it doesn't end with it).
-   **Bad Translation**: Small models (like 0.5B parameters) may struggle with complex logic. Try a larger model (7B+) or adjust the system prompt if you are developing custom strategies.

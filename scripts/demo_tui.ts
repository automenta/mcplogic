import { spawn } from 'child_process';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Configuration
const MOCK_PORT = 3001;

// Test Scenarios
const SCENARIOS = [
    {
        name: 'Basic Syllogism',
        input: 'All humans are mortal. Socrates is human.',
        mockResponse: `all x (Human(x) -> Mortal(x))
Human(Socrates)
conclusion: Mortal(Socrates)`
    },
    {
        name: 'Chatty Response',
        input: 'Please translate: Birds fly.',
        mockResponse: `Sure! Here is the First-Order Logic translation for your request:

all x (Bird(x) -> Fly(x))

Let me know if you need anything else!`
    },
    {
        name: 'Complex Quantifiers',
        input: 'Every voter casts a ballot for a candidate.',
        mockResponse: "```prolog\nall x (Voter(x) -> exists y (Candidate(y) & CastsBallotFor(x,y)))\n```"
    },
    {
        name: 'Negation',
        input: 'Not all birds fly.',
        mockResponse: `-(all x (Bird(x) -> Fly(x)))`
    }
];

// 1. Start Mock LLM Server
const mockServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        if (req.url?.includes('/chat/completions') && req.method === 'POST') {
            const parsed = JSON.parse(body);
            const content = parsed.messages[parsed.messages.length - 1].content;

            // Simple heuristic to match scenario based on input substring
            const scenario = SCENARIOS.find(s => content.includes(s.input)) || SCENARIOS[0];

            const response = {
                id: 'chatcmpl-mock',
                object: 'chat.completion',
                created: Date.now(),
                model: 'mock-model',
                choices: [{
                    message: {
                        role: 'assistant',
                        content: scenario.mockResponse
                    }
                }]
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });
});

async function runDemo() {
    // 2. Setup Environment
    const env = {
        ...process.env,
        OPENAI_BASE_URL: `http://localhost:${MOCK_PORT}/v1`,
        OPENAI_API_KEY: 'test-key',
        OLLAMA_URL: undefined
    };

    // 3. Connect MCP Client
    // Using tsx to run the server from source for the demo
    const transport = new StdioClientTransport({
        command: 'npx',
        args: ['tsx', '-e', 'import { runServer } from "./src/server.ts"; runServer();'],
        env: env as any
    });

    const client = new Client({ name: 'demo-client', version: '1.0.0' }, { capabilities: {} });

    try {
        await client.connect(transport);
        console.log('[Demo] Connected to MCP Server (Mocking LLM).');

        console.log('\n--- Running Translation Scenarios ---');

        for (const scenario of SCENARIOS) {
            console.log(`\nInput: "${scenario.input}"`);

            const result = await client.callTool({
                name: 'translate-text',
                arguments: { text: scenario.input }
            });

            const content = JSON.parse((result as any).content[0].text);

            if (content.success) {
                console.log('Translation Success!');
                if (content.premises.length) console.log('Premises:', content.premises);
                if (content.conclusion) console.log('Conclusion:', content.conclusion);
            } else {
                console.log('Translation Failed:', content.errors);
            }
        }

    } catch (error) {
        console.error('[Demo] Error:', error);
    } finally {
        mockServer.close();
        process.exit(0);
    }
}

mockServer.listen(MOCK_PORT, async () => {
    await runDemo();
});

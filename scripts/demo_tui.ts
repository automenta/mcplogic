import { spawn } from 'child_process';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import * as readline from 'readline';

// Configuration
const MOCK_PORT = 3001;
const USE_MOCK = process.argv.includes('--mock');

// Mock Data
const MOCK_SCENARIOS = [
    {
        pattern: /all humans are mortal/i,
        response: `all x (Human(x) -> Mortal(x))`
    },
    {
        pattern: /socrates is human/i,
        response: `Human(Socrates)`
    },
    {
        pattern: /is socrates mortal/i,
        response: `conclusion: Mortal(Socrates)`
    }
];

let mockServer: any = null;

// Helper to start mock server
function startMockServer(): Promise<void> {
    return new Promise((resolve) => {
        mockServer = createServer((req: IncomingMessage, res: ServerResponse) => {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                if (req.url?.includes('/chat/completions') && req.method === 'POST') {
                    const parsed = JSON.parse(body);
                    const content = parsed.messages[parsed.messages.length - 1].content;

                    // Find matching scenario
                    const scenario = MOCK_SCENARIOS.find(s => s.pattern.test(content));
                    const responseText = scenario ? scenario.response : `Predicate(${content.replace(/\s/g, '_')})`;

                    const response = {
                        id: 'chatcmpl-mock',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'mock-model',
                        choices: [{
                            message: {
                                role: 'assistant',
                                content: responseText
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
        mockServer.listen(MOCK_PORT, () => {
            // console.log(`[Demo] Mock LLM running on port ${MOCK_PORT}`);
            resolve();
        });
    });
}

async function runInteractiveMode() {
    // 1. Start Mock LLM Server if needed
    if (USE_MOCK) {
        await startMockServer();
        console.log('[Demo] Mock Server Started.');
    }

    // 2. Setup Environment
    const env = { ...process.env };

    if (USE_MOCK) {
        env.OPENAI_BASE_URL = `http://localhost:${MOCK_PORT}/v1`;
        env.OPENAI_API_KEY = 'test-key';
        env.OLLAMA_URL = undefined;
        console.log('[Demo] Running in MOCK mode.');
    } else {
        if (!env.OPENAI_BASE_URL && !env.OPENAI_API_KEY && !env.OLLAMA_URL) {
            console.warn('[Demo] WARNING: No LLM environment variables found.');
            console.warn('[Demo] Please set OPENAI_BASE_URL, OPENAI_API_KEY, or OLLAMA_URL.');
            console.warn('[Demo] Or run with --mock to use internal mock server.');
            process.exit(1);
        }
        console.log('[Demo] Running in REAL mode (connecting to configured LLM).');
    }

    // 3. Connect MCP Client
    const transport = new StdioClientTransport({
        command: 'npx',
        args: ['tsx', '-e', 'import { runServer } from "./src/server.ts"; runServer();'],
        env: env as any
    });

    const client = new Client({ name: 'demo-client', version: '1.0.0' }, { capabilities: {} });

    try {
        await client.connect(transport);
        console.log('[Demo] Connected to MCP Logic Server.');
    } catch (e) {
        console.error('[Demo] Failed to connect to MCP server:', e);
        if (mockServer) mockServer.close();
        process.exit(1);
    }

    // 4. Interactive Loop
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '\n> '
    });

    const sessionPremises: string[] = [];

    console.log('\n--- Interactive Logic Demo ---');
    console.log('Commands:');
    console.log('  <text>        : Translate text to FOL and add as premise.');
    console.log('  prove <text>  : Translate text to FOL and try to prove it.');
    console.log('  list          : List current premises.');
    console.log('  clear         : Clear all premises.');
    console.log('  exit          : Quit.');

    rl.prompt();

    rl.on('line', async (line) => {
        const input = line.trim();
        if (!input) {
            rl.prompt();
            return;
        }

        try {
            if (input === 'exit') {
                rl.close();
                return;
            }

            if (input === 'clear') {
                sessionPremises.length = 0;
                console.log('Premises cleared.');
                rl.prompt();
                return;
            }

            if (input === 'list') {
                console.log('Current Premises:');
                if (sessionPremises.length === 0) console.log('  (none)');
                sessionPremises.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
                rl.prompt();
                return;
            }

            if (input.startsWith('prove ')) {
                const textToProve = input.substring(6).trim();
                console.log(`Analyzing goal: "${textToProve}"...`);

                // 1. Translate Goal
                const transResult = await client.callTool({
                    name: 'translate-text',
                    arguments: { text: textToProve }
                });

                const transContent = JSON.parse((transResult as any).content[0].text);

                let goalFormula: string | undefined;

                if (transContent.conclusion) {
                    goalFormula = transContent.conclusion;
                } else if (transContent.premises && transContent.premises.length > 0) {
                    goalFormula = transContent.premises[0]; // Assume first premise is goal if not marked
                }

                if (!goalFormula) {
                    console.error('Failed to extract goal formula from LLM output.');
                } else {
                    console.log(`Goal Formula: ${goalFormula}`);

                    // 2. Call Prove
                    console.log('Proving...');
                    const proveResult = await client.callTool({
                        name: 'prove',
                        arguments: {
                            premises: sessionPremises,
                            goal: goalFormula
                        }
                    });

                    const proveContent = JSON.parse((proveResult as any).content[0].text);
                    console.log(`Result: ${proveContent.result.toUpperCase()}`);
                    if (proveContent.explanation) {
                        console.log(`Explanation: ${proveContent.explanation}`);
                    }
                }

            } else {
                // Treat as Premise
                console.log(`Translating premise: "${input}"...`);

                const transResult = await client.callTool({
                    name: 'translate-text',
                    arguments: { text: input }
                });

                const transContent = JSON.parse((transResult as any).content[0].text);

                if (transContent.premises && transContent.premises.length > 0) {
                    console.log('Generated Formulas:');
                    transContent.premises.forEach((p: string) => {
                        console.log(`  + ${p}`);
                        sessionPremises.push(p);
                    });
                } else {
                    console.log('No formulas generated.');
                    if (transContent.errors) console.error('Errors:', transContent.errors);
                }
            }

        } catch (error) {
            console.error('Error:', error);
        }

        rl.prompt();
    });

    rl.on('close', () => {
        console.log('\nGoodbye.');
        if (mockServer) {
             mockServer.close();
        }
        // Force exit to kill MCP subprocess if it hangs
        setTimeout(() => process.exit(0), 100);
    });
}

runInteractiveMode();

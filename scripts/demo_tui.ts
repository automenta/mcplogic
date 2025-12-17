import { spawn } from 'child_process';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import * as readline from 'readline';

async function runInteractiveMode() {
    // 1. Setup Environment
    const env = { ...process.env };

    // Check for LLM configuration
    const hasLLM = env.OPENAI_BASE_URL || env.OPENAI_API_KEY || env.OLLAMA_URL;

    if (!hasLLM) {
        console.warn('\n[Demo] ⚠️  WARNING: No LLM environment variables found.');
        console.warn('[Demo] The "translate-text" tool requires a configured LLM.');
        console.warn('[Demo] Please set OPENAI_BASE_URL (for local), OPENAI_API_KEY, or OLLAMA_URL.');
        console.warn('[Demo] See AGENTS.md for setup instructions.\n');
        // We continue, as the user might only want to use 'prove' with manual premises.
    } else {
        console.log('[Demo] LLM Configuration detected. Ready for Natural Language inputs.');
    }

    // 2. Connect MCP Client
    // We spawn the server process directly.
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
        process.exit(1);
    }

    // 3. Interactive Loop
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
                    if (transContent.errors) console.error('Details:', transContent.errors);
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
        // Force exit to kill MCP subprocess if it hangs
        setTimeout(() => process.exit(0), 100);
    });
}

runInteractiveMode();

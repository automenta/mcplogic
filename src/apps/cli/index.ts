import 'dotenv/config';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, CoreMessage } from 'ai';
import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import { StateManager } from './state.js';
import { tools } from './tools.js';

// Configuration
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OLLAMA_API_KEY || 'dummy-key';
const MODEL_NAME = process.env.OLLAMA_MODEL || process.env.MODEL_NAME || 'gpt-4o';

// Initialize Provider
const openai = createOpenAI({
    baseURL: OPENAI_BASE_URL,
    apiKey: OPENAI_API_KEY,
});

const stateManager = new StateManager();

async function main() {
    console.log(chalk.bold.blue('Welcome to MCPLOGIC Agent CLI'));
    console.log(chalk.dim(`Connected to: ${OPENAI_BASE_URL}`));
    console.log(chalk.dim(`Model: ${MODEL_NAME}`));
    console.log(chalk.gray('Type /help for commands, /exit to quit.\n'));

    const state = await stateManager.load();
    let messages: CoreMessage[] = state.messages || [];

    // System Prompt
    const systemMessage: CoreMessage = {
        role: 'system',
        content: `You are an advanced logic reasoning agent powered by MCPLOGIC.
You can Prove theorems, Find Models, and Translate natural language to First-Order Logic (FOL).

Workflow:
1. If the user gives a natural language problem, translate it to FOL first using 'translateText'.
2. Use 'prove' to verify conclusions.
3. Use 'findModel' or 'findCounterexample' if validity is unsure.
4. Use Session tools (createSession, assertPremise) for multi-turn reasoning or complex knowledge bases.

Always explain your reasoning steps. Be concise but rigorous.`
    };

    while (true) {
        try {
            const userQuery = await input({ message: chalk.green('You >') });

            if (!userQuery.trim()) continue;

            // Handle Slash Commands
            if (userQuery.startsWith('/')) {
                const [cmd, ...args] = userQuery.slice(1).split(' ');
                switch (cmd) {
                    case 'exit':
                    case 'quit':
                        console.log(chalk.yellow('Goodbye!'));
                        process.exit(0);
                    case 'clear':
                        messages = [];
                        await stateManager.save({ ...state, messages: [] });
                        console.log(chalk.gray('Conversation history cleared.'));
                        continue;
                    case 'memory':
                        console.log(chalk.cyan('Current Memory/Context:'));
                        console.log(JSON.stringify(messages, null, 2));
                        continue;
                    case 'help':
                        console.log(chalk.yellow(`
Commands:
  /help       Show this help
  /clear      Clear conversation history
  /memory     View current context
  /model      Show current model info
  /exit       Quit
`));
                        continue;
                    case 'model':
                        console.log(chalk.cyan(`Current Model: ${MODEL_NAME}`));
                        console.log(chalk.dim(`Provider URL: ${OPENAI_BASE_URL}`));
                        continue;
                    default:
                        console.log(chalk.red(`Unknown command: /${cmd}`));
                        continue;
                }
            }

            // Add user message
            messages.push({ role: 'user', content: userQuery });

            process.stdout.write(chalk.blue('Agent > '));

            // Cast options to any to avoid potential type definition mismatches with maxSteps
            const result = streamText({
                model: openai(MODEL_NAME),
                messages: [systemMessage, ...messages],
                tools: tools,
                maxSteps: 10,
                onStepFinish: (step: any) => {
                    // Log tool calls nicely
                    if (step.toolCalls && step.toolCalls.length > 0) {
                        step.toolCalls.forEach((call: any) => {
                            console.log(chalk.dim(`\n[Tool Call] ${call.toolName}`));
                        });
                    }
                },
            } as any);

            let fullResponse = '';
            for await (const delta of result.textStream) {
                process.stdout.write(delta);
                fullResponse += delta;
            }
            console.log('\n'); // Newline after stream

            // Update messages with the result from the stream
            // result.response is a promise that resolves to the final response object
            const response = await result.response;

            // To properly persist the conversation, we should ideally append the NEW messages
            // (including tool calls and results).
            // Since accessing them cleanly from the stream result requires careful handling,
            // we will just append the *final* assistant response text for now to keep state simple.
            // A more advanced version would use `response.messages` if available or reconstruct it.

            messages.push({ role: 'assistant', content: fullResponse });
            await stateManager.save({ ...state, messages });

        } catch (error) {
            console.error(chalk.red('\nError:'), error);
        }
    }
}

main().catch(console.error);

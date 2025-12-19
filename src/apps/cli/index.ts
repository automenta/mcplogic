import 'dotenv/config';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, generateObject, CoreMessage } from 'ai';
import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import fs from 'fs/promises';
import { z } from 'zod';
import { StateManager } from './state.js';
import { tools } from './tools.js';
import { createTransformersModel } from './providers/transformers.js';

// Configuration
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OLLAMA_API_KEY || 'dummy-key';
const MODEL_NAME = process.env.OLLAMA_MODEL || process.env.MODEL_NAME || 'gpt-4o';

// Model Selection
const isLocal = process.argv.includes('--local');
const openai = createOpenAI({
    baseURL: OPENAI_BASE_URL,
    apiKey: OPENAI_API_KEY,
});

const model = isLocal ? createTransformersModel() : openai(MODEL_NAME);
const modelNameDisplay = isLocal ? 'transformers-local (Qwen1.5-0.5B)' : MODEL_NAME;

const stateManager = new StateManager();

async function main() {
    console.log(chalk.bold.blue('Welcome to MCPLOGIC Agent CLI'));
    if (!isLocal) {
        console.log(chalk.dim(`Connected to: ${OPENAI_BASE_URL}`));
    }
    console.log(chalk.dim(`Model: ${modelNameDisplay}`));
    if (isLocal) {
        console.log(chalk.yellow('Running in local offline mode. Initial loading may take time.'));
    }
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
                const parts = userQuery.slice(1).split(' ');
                const cmd = parts[0];
                const args = parts.slice(1);

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
  /help           Show this help
  /clear          Clear conversation history
  /memory         View current context
  /model          Show current model info
  /load <file>    Load text content from a file
  /save <file>    Save conversation history to a JSON file
  /extract <text> Extract logical premises from text (Structured Output)
  /exit           Quit
`));
                        continue;
                    case 'model':
                        console.log(chalk.cyan(`Current Model: ${modelNameDisplay}`));
                        if (!isLocal) console.log(chalk.dim(`Provider URL: ${OPENAI_BASE_URL}`));
                        continue;
                    case 'load':
                        if (args.length === 0) {
                            console.log(chalk.red('Usage: /load <filepath>'));
                            continue;
                        }
                        try {
                            const content = await fs.readFile(args[0], 'utf-8');
                            messages.push({ role: 'user', content: `[Loaded from ${args[0]}]:\n${content}` });
                            console.log(chalk.green(`Loaded ${args[0]} into context.`));
                        } catch (e) {
                            console.log(chalk.red(`Failed to load file: ${(e as Error).message}`));
                        }
                        continue;
                    case 'save':
                         if (args.length === 0) {
                            console.log(chalk.red('Usage: /save <filepath>'));
                            continue;
                        }
                        try {
                            await fs.writeFile(args[0], JSON.stringify(messages, null, 2), 'utf-8');
                            console.log(chalk.green(`Saved conversation to ${args[0]}.`));
                        } catch (e) {
                             console.log(chalk.red(`Failed to save file: ${(e as Error).message}`));
                        }
                        continue;
                    case 'extract':
                        const textToExtract = args.join(' ');
                        if (!textToExtract) {
                            console.log(chalk.red('Usage: /extract <text>'));
                            continue;
                        }
                        const spinnerExtract = ora('Extracting premises...').start();
                        try {
                            const { object } = await generateObject({
                                model: model as any,
                                schema: z.object({
                                    premises: z.array(z.string()).describe('List of FOL premises or clear English statements'),
                                    conclusion: z.string().optional().describe('Inferred conclusion if any'),
                                    entities: z.array(z.string()).describe('List of entities mentioned')
                                }),
                                prompt: `Extract logical components from this text:\n"${textToExtract}"`
                            });
                            spinnerExtract.stop();
                            console.log(boxen(JSON.stringify(object, null, 2), { title: 'Extraction Result', borderColor: 'magenta' }));
                        } catch (e) {
                            spinnerExtract.stop();
                            console.log(chalk.red(`Extraction failed: ${(e as Error).message}`));
                        }
                        continue;
                    default:
                        console.log(chalk.red(`Unknown command: /${cmd}`));
                        continue;
                }
            }

            // Add user message
            messages.push({ role: 'user', content: userQuery });

            process.stdout.write(chalk.blue('Agent > '));

            const spinner = ora('Thinking...').start();

            // Cast options to any to avoid potential type definition mismatches
            const result = streamText({
                model: model as any,
                messages: [systemMessage, ...messages],
                tools: tools,
                maxSteps: 10,
                // Retry logic (middleware-like)
                experimental_toolCallNotification: true, // V5 feature if supported
            } as any);

            let fullResponseText = '';

            for await (const part of result.fullStream) {
                switch (part.type) {
                    case 'text-delta':
                        if (spinner.isSpinning) spinner.stop();
                        // @ts-ignore
                        const text = part.textDelta ?? part.text;
                        process.stdout.write(text);
                        fullResponseText += text;
                        break;
                    case 'tool-call':
                        if (!spinner.isSpinning) {
                            process.stdout.write('\n'); // newline if we were printing text
                        }
                        spinner.start(chalk.dim(`Executing ${part.toolName}...`));
                        break;
                    case 'tool-result':
                         // Stop spinner to print result
                         if (spinner.isSpinning) spinner.stop();

                         // @ts-ignore
                         const toolResult = part.result ?? part.output;
                         const output = JSON.stringify(toolResult, null, 2);
                         const truncated = output.length > 2000 ? output.slice(0, 2000) + '...' : output;

                         console.log(boxen(truncated, {
                             title: chalk.bold.cyan(`Tool: ${part.toolName}`),
                             padding: 0,
                             borderColor: 'gray',
                             dimBorder: true
                         }));
                         break;
                    case 'error':
                        if (spinner.isSpinning) spinner.stop();
                        console.error(chalk.red(`\nError: ${part.error}`));
                        break;
                }
            }
            if (spinner.isSpinning) spinner.stop();
            console.log('\n');

            // Correctly persist ALL new messages (including tool calls)
            const response = await result.response;
            messages.push(...response.messages);
            await stateManager.save({ ...state, messages });

        } catch (error) {
            console.error(chalk.red('\nError:'), error);
        }
    }
}

main().catch(console.error);

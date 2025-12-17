import * as readline from 'readline';
import { createMcpClient, translateText, proveGoal, findModel } from './common.js';
import { SCENARIOS } from './scenarios.js';

// Simple ANSI colors
const DIM = '\x1b[2m';
const BRIGHT = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query: string): Promise<string> => {
    return new Promise((resolve) => rl.question(query, resolve));
};

// Global state
let client: any = null;
let transport: any = null;
let envConfig: Record<string, string> = {};

async function setupConnection() {
    if (client) {
        // Close existing
        try { await transport.close(); } catch {}
        client = null;
    }

    console.log(`${DIM}Connecting to MCP Logic Server...${RESET}`);
    try {
        const res = await createMcpClient(envConfig);
        client = res.client;
        transport = res.transport;
        console.log(`${GREEN}✓ Connected.${RESET}`);
    } catch (e) {
        console.error(`${RED}✗ Connection failed: ${(e as Error).message}${RESET}`);
    }
}

async function runAnalysis(input: string) {
    if (!client) await setupConnection();
    if (!client) return;

    console.log(`\n${CYAN}=== Analyzing Input ===${RESET}`);
    console.log(`${DIM}"${input}"${RESET}\n`);

    try {
        // 1. Translation
        process.stdout.write(`${YELLOW}Thinking (Translating)... ${RESET}`);
        const transStart = Date.now();
        const transResult = await translateText(client, input);
        const transTime = Date.now() - transStart;
        console.log(`${GREEN}✓ Done (${transTime}ms)${RESET}`);

        if (transResult.errors && transResult.errors.length > 0) {
             console.log(`${RED}Translation Errors:${RESET}`);
             transResult.errors.forEach((e: string) => console.log(`  - ${e}`));
        }

        const premises = transResult.premises || [];
        const conclusion = transResult.conclusion;

        if (premises.length > 0) {
            console.log(`\n${BRIGHT}Generated Formulas:${RESET}`);
            premises.forEach((p: string, i: number) => console.log(`  ${DIM}${i+1}.${RESET} ${p}`));
        }

        // Determine Goal
        let goal = conclusion;
        if (!goal && premises.length > 0) {
            // Check if input looks like a question?
            // Heuristic: If we have premises but no conclusion, assume we want to find a model
            // But if user asks "Prove X", X might be in premises list if parser wasn't strict.
            // For now, let's ask user or infer?
            // Actually, we'll try to prove the last premise if no conclusion.
            goal = premises[premises.length - 1];
            console.log(`${DIM}(Assuming last formula is the goal: ${goal})${RESET}`);
        }

        if (goal) {
            // 2. Proving
            console.log(`\n${YELLOW}Reasoning (Proving)... ${RESET}`);
            const proveStart = Date.now();
            const proveResult = await proveGoal(client, premises.filter((p: string) => p !== goal), goal);
            const proveTime = Date.now() - proveStart;

            if (proveResult.result === 'proved') {
                console.log(`${GREEN}✓ PROVED (${proveTime}ms)${RESET}`);
                console.log(`\n${BRIGHT}Conclusion:${RESET} The statement follows from the premises.`);
            } else {
                console.log(`${RED}✗ NOT PROVED (${proveResult.result})${RESET}`);

                // 3. Counter-example / Model Finding
                console.log(`\n${YELLOW}Checking Consistency (Model Finding)... ${RESET}`);
                const modelResult = await findModel(client, premises);

                if (modelResult.success) {
                    console.log(`${GREEN}✓ Model Found (Consistent)${RESET}`);
                    // Only show model if verbosity is high? For now, just say found.
                } else {
                    console.log(`${RED}✗ No Model Found (Contradiction?)${RESET}`);
                }
            }
        } else {
            console.log(`\n${YELLOW}No explicit goal found.${RESET} Checking consistency...`);
            const modelResult = await findModel(client, premises);
             if (modelResult.success) {
                console.log(`${GREEN}✓ Premises are Consistent.${RESET}`);
            } else {
                console.log(`${RED}✗ Premises are Contradictory.${RESET}`);
            }
        }

    } catch (e) {
        console.error(`\n${RED}Error during analysis: ${(e as Error).message}${RESET}`);
    }
}

async function showMenu() {
    console.log(`\n${BRIGHT}--- MCP Logic Interactive Demo ---${RESET}`);
    console.log(`LLM: ${envConfig.OPENAI_BASE_URL || 'Default (Env)'}`);
    console.log('1. Run Scenario');
    console.log('2. Custom Input');
    console.log('3. Configure LLM');
    console.log('4. Exit');

    const choice = await question('\nSelect option: ');

    switch (choice.trim()) {
        case '1':
            console.log('\nAvailable Scenarios:');
            SCENARIOS.forEach((s, i) => {
                console.log(`${i+1}. ${BRIGHT}${s.title}${RESET} - ${DIM}${s.description}${RESET}`);
            });
            const sIdx = parseInt(await question('Select scenario (number): ')) - 1;
            if (SCENARIOS[sIdx]) {
                await runAnalysis(SCENARIOS[sIdx].text);
            } else {
                console.log('Invalid selection.');
            }
            break;
        case '2':
            const text = await question('Enter text to analyze: ');
            if (text.trim()) await runAnalysis(text);
            break;
        case '3':
            const url = await question(`Base URL [${envConfig.OPENAI_BASE_URL || ''}]: `);
            if (url.trim()) envConfig.OPENAI_BASE_URL = url.trim();
            const key = await question(`API Key [${envConfig.OPENAI_API_KEY ? '***' : ''}]: `);
            if (key.trim()) envConfig.OPENAI_API_KEY = key.trim();

            // Reconnect
            await setupConnection();
            break;
        case '4':
            console.log('Goodbye.');
            rl.close();
            process.exit(0);
            break;
        default:
            console.log('Unknown option.');
    }

    showMenu();
}

// Start
console.clear();
setupConnection().then(showMenu);

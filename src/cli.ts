#!/usr/bin/env node
import { readFileSync } from 'fs';
import * as readline from 'readline';
import { createLogicEngine } from './logicEngine.js';
import { createModelFinder } from './modelFinder.js';
import { parse } from './parser.js';
import { DEFAULTS } from './types/index.js';

const VERSION = '1.0.0';
const HELP = `
MCP Logic CLI v${VERSION}

Usage:
  mcplogic prove <file.p>     Prove last line from preceding premises
  mcplogic model <file.p>     Find model satisfying all lines
  mcplogic validate <file.p>  Check syntax of all lines
  mcplogic repl               Interactive mode

Options:
  --high-power, -H   Enable extended limits (300s, 100k inferences)
  --help, -h         Show this help
  --version, -v      Show version

Examples:
  mcplogic prove problem.p
  mcplogic model --high-power theory.p
  mcplogic repl
`;

const args = process.argv.slice(2);
const highPower = args.includes('--high-power') || args.includes('-H');
const command = args.find(a => !a.startsWith('-'));
const file = args.find(a => !a.startsWith('-') && a !== command);

async function main() {
    if (args.includes('--help') || args.includes('-h') || !command) {
        console.log(HELP);
        return;
    }

    if (args.includes('--version') || args.includes('-v')) {
        console.log(VERSION);
        return;
    }

    if (command === 'repl') {
        return runRepl(highPower);
    }

    if (!file) {
        console.error('Error: file argument required');
        process.exit(1);
    }

    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#') && !l.startsWith('%'));

    const limit = highPower ? DEFAULTS.highPowerMaxInferences : DEFAULTS.maxInferences;
    const timeout = highPower ? DEFAULTS.highPowerMaxSeconds * 1000 : DEFAULTS.maxSeconds * 1000;

    switch (command) {
        case 'prove': {
            const premises = lines.slice(0, -1);
            const conclusion = lines[lines.length - 1];
            console.log(`Proving: ${conclusion}`);
            console.log(`From ${premises.length} premises...`);

            const engine = createLogicEngine(timeout, limit);
            const start = Date.now();
            const result = await engine.prove(premises, conclusion, { includeTrace: true });
            const elapsed = Date.now() - start;

            console.log(result.success ? '✓ PROVED' : '✗ NOT PROVED');
            console.log(`Time: ${elapsed}ms`);
            if (result.inferenceSteps) console.log('\nTrace:\n' + result.inferenceSteps.join('\n'));
            process.exit(result.success ? 0 : 1);
            break;
        }
        case 'model': {
            console.log(`Finding model for ${lines.length} formulas...`);
            const finder = createModelFinder(timeout, highPower ? 25 : 10);
            const start = Date.now();
            const result = await finder.findModel(lines);
            const elapsed = Date.now() - start;

            console.log(result.success ? '✓ MODEL FOUND' : '✗ NO MODEL');
            console.log(`Time: ${elapsed}ms`);
            if (result.model) console.log('\n' + JSON.stringify(result.model, null, 2));
            process.exit(result.success ? 0 : 1);
            break;
        }
        case 'validate': {
            let allValid = true;
            for (const stmt of lines) {
                try {
                    parse(stmt);
                    console.log(`✓ ${stmt}`);
                } catch (e) {
                    console.log(`✗ ${stmt}`);
                    console.log(`  Error: ${(e as Error).message}`);
                    allValid = false;
                }
            }
            process.exit(allValid ? 0 : 1);
            break;
        }
        default:
            console.error(`Unknown command: ${command}`);
            console.log(HELP);
            process.exit(1);
    }
}

async function runRepl(highPower: boolean) {
    const limit = highPower ? DEFAULTS.highPowerMaxInferences : 5000;
    const engine = createLogicEngine(30000, limit);
    const premises: string[] = [];

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'mcplogic> '
    });

    console.log(`MCP Logic REPL v${VERSION}${highPower ? ' [HIGH-POWER]' : ''}`);
    console.log('Commands: .assert <formula>, .prove <goal>, .list, .clear, .quit\n');
    rl.prompt();

    rl.on('line', async (line) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('.assert ')) {
            const formula = trimmed.slice(8).trim();
            try {
                parse(formula);
                premises.push(formula);
                console.log(`✓ Asserted (${premises.length} total)`);
            } catch (e) {
                console.log(`✗ ${(e as Error).message}`);
            }
        } else if (trimmed.startsWith('.prove ')) {
            const goal = trimmed.slice(7).trim();
            try {
                parse(goal);
                const result = await engine.prove(premises, goal, { includeTrace: true });
                console.log(result.success ? '✓ Proved' : '✗ Not proved');
                if (result.inferenceSteps) console.log(result.inferenceSteps.join('\n'));
            } catch (e) {
                console.log(`✗ ${(e as Error).message}`);
            }
        } else if (trimmed === '.list') {
            if (premises.length === 0) {
                console.log('(no premises)');
            } else {
                premises.forEach((p, i) => console.log(`${i + 1}. ${p}`));
            }
        } else if (trimmed === '.clear') {
            premises.length = 0;
            console.log('Cleared.');
        } else if (trimmed === '.quit' || trimmed === '.exit' || trimmed === '.q') {
            rl.close();
            return;
        } else if (trimmed && !trimmed.startsWith('.')) {
            console.log('Unknown command. Use .assert, .prove, .list, .clear, or .quit');
        }
        rl.prompt();
    });

    rl.on('close', () => process.exit(0));
}

main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});

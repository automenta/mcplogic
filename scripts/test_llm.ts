import { createMcpClient, translateText, proveGoal } from './common.js';
import { SCENARIOS } from './scenarios.js';

async function main() {
    const args = process.argv.slice(2);
    const urlArg = args.find(a => a.startsWith('--url='));
    const keyArg = args.find(a => a.startsWith('--key='));

    const envOverride: Record<string, string> = {};
    if (urlArg) envOverride.OPENAI_BASE_URL = urlArg.split('=')[1];
    if (keyArg) envOverride.OPENAI_API_KEY = keyArg.split('=')[1];

    console.log('--- MCP Logic LLM Test Runner ---');
    console.log(`Config: URL=${envOverride.OPENAI_BASE_URL || 'env'}, Key=${envOverride.OPENAI_API_KEY ? '***' : 'env'}\n`);

    const { client, transport } = await createMcpClient(envOverride);

    let passed = 0;
    let failed = 0;

    try {
        for (const scenario of SCENARIOS) {
            console.log(`\nTesting Scenario: [${scenario.id}] ${scenario.title}`);
            console.log(`Input: "${scenario.text}"`);

            try {
                // 1. Translate
                console.log('  > Translating...');
                const transResult = await translateText(client, scenario.text);

                if (transResult.errors && transResult.errors.length > 0) {
                    console.error('  X Translation Errors:', transResult.errors);
                    failed++;
                    continue;
                }

                const premises = transResult.premises || [];
                const conclusion = transResult.conclusion;

                console.log(`  > Generated ${premises.length} premises.`);
                if (conclusion) console.log(`  > Conclusion: ${conclusion}`);

                let goal = conclusion;
                if (!goal && premises.length > 0) {
                    // Heuristic: Last premise might be goal if structured that way,
                    // or we check if scenario has expected goal
                     goal = scenario.expectedGoal;
                }

                if (!goal) {
                    console.warn('  ! No goal found in translation or scenario.');
                    failed++;
                    continue;
                }

                // 2. Prove
                console.log(`  > Proving goal: ${goal}...`);
                const proveResult = await proveGoal(client, premises, goal);

                if (proveResult.result === 'proved') {
                    console.log('  ✓ PROVED');
                    passed++;
                } else {
                    console.log(`  X Failed to prove. Result: ${proveResult.result}`);
                    failed++;
                }

            } catch (e) {
                console.error('  ! Error:', (e as Error).message);
                failed++;
            }
        }
    } finally {
        await transport.close();
    }

    console.log('\n-----------------------------------');
    console.log(`Summary: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
    console.error('Fatal Error:', e);
    process.exit(1);
});

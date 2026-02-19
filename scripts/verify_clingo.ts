import { ClingoEngine } from '../src/engines/clingo/index.js';

async function main() {
    console.log('Verifying Clingo Engine...');
    const engine = new ClingoEngine();

    try {
        await engine.init();
        console.log('Clingo initialized.');

        const premises = ['p -> q', 'p'];
        const conclusion = 'q';

        console.log(`Proving: ${premises.join(', ')} |- ${conclusion}`);
        const result = await engine.prove(premises, conclusion);

        console.log('Result:', result);

        if (result.success && result.result === 'proved') {
            console.log('Clingo verification successful!');
        } else {
            console.error('Clingo verification failed: expected success/proved');
            process.exit(1);
        }

    } catch (e) {
        console.error('Clingo verification failed with error:', e);
        process.exit(1);
    }
}

main();

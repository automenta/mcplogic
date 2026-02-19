import { Z3Engine } from '../src/engines/z3/index.js';

async function main() {
    console.log('Verifying Z3 Engine...');
    const engine = new Z3Engine();

    try {
        await engine.init();
        console.log('Z3 initialized.');

        // Expose internal context for inspection
        const ctx = (engine as any).ctx;
        console.log('Context keys:', JSON.stringify(Object.keys(ctx)));

        console.log('ctx.Function:', typeof ctx.Function);
        try {
            const s = ctx.Sort.declare('U');
            console.log('Declared sort U:', s);
            const f = ctx.Function.declare('f', s, s);
            console.log('Declared function f:', typeof f);
            const proto = Object.getPrototypeOf(f);
            console.log('f proto names:', Object.getOwnPropertyNames(proto));
            if (proto.call) console.log('proto.call exists');

            // Try creating an application
            const c = ctx.Const('c', s);
            const app = f.call(c); // Use method directly
            console.log('Application created:', app);

        } catch(e) {
            console.log('Function declaration/application failed:', e);
        }

        const premises = ['p -> q', 'p'];
        const conclusion = 'q';

        console.log(`Proving: ${premises.join(', ')} |- ${conclusion}`);
        const result = await engine.prove(premises, conclusion);

        console.log('Result:', result);

        if (result.success && result.result === 'proved') {
            console.log('Z3 verification successful!');
        } else {
            console.error('Z3 verification failed: expected success/proved');
            process.exit(1);
        }

    } catch (e) {
        console.error('Z3 verification failed with error:', e);
        process.exit(1);
    }
}

main();

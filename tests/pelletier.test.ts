import { EngineManager } from '../src/engines/manager';
import pelletier from './data/pelletier.json';

describe('Pelletier Problems', () => {
    // We use EngineManager in 'auto' mode which should select SAT for non-Horn problems
    // and Prolog for Horn problems.
    const manager = new EngineManager(30000, 10000);

    test.each(pelletier)('$name', async ({ premises, conclusion }) => {
        // We use 'auto' which should route to SAT for complex propositional stuff
        const result = await manager.prove(premises, conclusion, { engine: 'auto' });

        // Debugging output for failed tests
        if (result.result !== 'proved') {
            console.log(`Failed ${premises} |- ${conclusion}`);
            console.log('Result:', result);
        }

        expect(result.result).toBe('proved');
    });
});

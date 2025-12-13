import { EngineManager } from '../src/engines/manager';
import pelletier from './data/pelletier.json';

describe('Pelletier Problems', () => {
    // Use EngineManager to allow auto-selection (likely SAT for propositional tautologies)
    const engine = new EngineManager();

    test.each(pelletier)('$name', async ({ premises, conclusion }) => {
        const result = await engine.prove(premises, conclusion, {
            // Increase limit for SAT solver if needed, though simple problems should be fast
            // 'auto' engine will pick SAT if Prolog fails or if configured
            // But we want to ensure it works.
            engine: 'auto',
            verbosity: 'standard'
        });
        expect(result.result).toBe('proved');
    });
});

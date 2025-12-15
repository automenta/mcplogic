
import { createLogicEngine, parse } from '../src/lib.js';
import { LogicEngine } from '../src/logicEngine.js';

describe('Library Export', () => {
    test('should import createLogicEngine and use it', async () => {
        const engine = createLogicEngine();
        expect(engine).toBeInstanceOf(LogicEngine);

        const premises = ['all x (man(x) -> mortal(x))', 'man(socrates)'];
        const conclusion = 'mortal(socrates)';

        const result = await engine.prove(premises, conclusion);
        expect(result.success).toBe(true);
        expect(result.result).toBe('proved');
    });

    test('should import parse and use it', () => {
        expect(() => parse('P(x)')).not.toThrow();
        expect(() => parse('(')).toThrow();
    });
});

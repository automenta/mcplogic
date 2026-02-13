/**
 * Engine Manager Tests
 * 
 * Tests for the engine manager with automatic engine selection.
 * Note: Use multi-character predicate names to avoid confusion with variables.
 */

import { EngineManager, createEngineManager } from '../src/engines/manager';
import { clausify, isHornFormula } from '../src/logic/index';

describe('EngineManager', () => {
    let manager: EngineManager;

    beforeEach(() => {
        manager = createEngineManager();
    });

    describe('engine access', () => {
        it('should provide access to Prolog engine', () => {
            const prolog = manager.getPrologEngine();
            expect(prolog.name).toBe('prolog/tau-prolog');
        });

        it('should provide access to SAT engine', () => {
            const sat = manager.getSATEngine();
            expect(sat.name).toBe('sat/minisat');
        });

        it('should list available engines', () => {
            const engines = manager.getEngines();
            expect(engines.length).toBe(2);
            expect(engines.map(e => e.name)).toContain('prolog/tau-prolog');
            expect(engines.map(e => e.name)).toContain('sat/minisat');
        });
    });

    describe('explicit engine selection', () => {
        it('should use Prolog when explicitly requested', async () => {
            const result = await manager.prove(
                ['man(socrates)', 'all x (man(x) -> mortal(x))'],
                'mortal(socrates)',
                { engine: 'prolog' }
            );
            expect(result.success).toBe(true);
            expect(result.engineUsed).toBe('prolog/tau-prolog');
        });

        it('should use SAT when explicitly requested', async () => {
            const result = await manager.prove(
                ['foo', 'foo -> bar'],
                'bar',
                { engine: 'sat' }
            );
            expect(result.success).toBe(true);
            expect(result.engineUsed).toBe('sat/minisat');
        });
    });

    describe('automatic engine selection', () => {
        it('should use Prolog for Horn formulas (auto mode)', async () => {
            // This is a Horn formula (single positive literal per clause)
            const result = await manager.prove(
                ['man(socrates)', 'all x (man(x) -> mortal(x))'],
                'mortal(socrates)',
                { engine: 'auto' }
            );
            expect(result.success).toBe(true);
            expect(result.engineUsed).toBe('prolog/tau-prolog');
        });

        it('should use SAT for non-Horn formulas (auto mode)', async () => {
            // foo ∨ bar (two positive literals = non-Horn)
            // Using explicit disjunction in premises forces non-Horn
            const result = await manager.prove(
                ['foo | bar', '-foo'],
                'bar',
                { engine: 'auto' }
            );
            expect(result.success).toBe(true);
            // Should use SAT for non-Horn
            expect(result.engineUsed).toBe('sat/minisat');
        });

        it('should default to auto mode', async () => {
            const result = await manager.prove(
                ['foo', 'foo -> bar'],
                'bar'
                // No engine specified - should default to auto
            );
            expect(result.success).toBe(true);
            expect(result.engineUsed).toBeDefined();
        });
    });

    describe('prove operations', () => {
        it('should prove modus ponens', async () => {
            const result = await manager.prove(
                ['foo', 'foo -> bar'],
                'bar'
            );
            expect(result.success).toBe(true);
            expect(result.result).toBe('proved');
        });

        it('should prove Socrates syllogism', async () => {
            const result = await manager.prove(
                ['man(socrates)', 'all x (man(x) -> mortal(x))'],
                'mortal(socrates)'
            );
            expect(result.success).toBe(true);
        });

        it('should fail to prove non-theorem', async () => {
            const result = await manager.prove(
                ['foo'],
                'bar'
            );
            expect(result.success).toBe(false);
        });

        it('should handle complex formulas via SAT', async () => {
            // Non-Horn formula uses SAT engine
            const result = await manager.prove(
                ['alpha | beta', 'alpha -> gamma', 'beta -> gamma'],
                'gamma',
                { engine: 'sat' }  // Explicitly use SAT for non-Horn
            );
            expect(result.success).toBe(true);
        });
    });

    describe('checkSat operations', () => {
        it('should check satisfiability with auto engine', async () => {
            const clausifyResult = clausify('foo & bar');
            expect(clausifyResult.success).toBe(true);

            const satResult = await manager.checkSat(clausifyResult.clauses!);
            expect(satResult.sat).toBe(true);
        });

        it('should detect unsatisfiability', async () => {
            const clausifyResult = clausify('foo & -foo');
            expect(clausifyResult.success).toBe(true);

            const satResult = await manager.checkSat(clausifyResult.clauses!);
            expect(satResult.sat).toBe(false);
        });

        it('should use specified engine for checkSat', async () => {
            const clausifyResult = clausify('foo');
            expect(clausifyResult.success).toBe(true);

            const satResult = await manager.checkSat(clausifyResult.clauses!, 'sat');
            expect(satResult.sat).toBe(true);
        });
    });

    describe('options forwarding', () => {
        it('should forward verbosity to Prolog engine', async () => {
            const result = await manager.prove(
                ['man(socrates)', 'all x (man(x) -> mortal(x))'],
                'mortal(socrates)',
                { engine: 'prolog', verbosity: 'detailed' }
            );
            expect(result.success).toBe(true);
            expect(result.statistics).toBeDefined();
        });

        it('should forward verbosity to SAT engine', async () => {
            const result = await manager.prove(
                ['foo'],
                'foo',
                { engine: 'sat', verbosity: 'detailed' }
            );
            expect(result.success).toBe(true);
            expect(result.statistics).toBeDefined();
        });

        it('should support minimal verbosity', async () => {
            const result = await manager.prove(
                ['foo'],
                'foo',
                { verbosity: 'minimal' }
            );
            expect(result.success).toBe(true);
            expect(result.result).toBe('proved');
            expect(result.message).toBeUndefined();
        });
    });
});

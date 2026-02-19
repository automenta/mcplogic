import { clausify } from '../src/logic/clausifier.js';
import { createSATEngine } from '../src/engines/sat/index.js';

describe('Tseitin Transformation', () => {
    const sat = createSATEngine();

    test('preserves satisfiability of simple formula', async () => {
        const formula = 'P & Q';
        const res = clausify(formula, { strategy: 'tseitin' });
        expect(res.success).toBe(true);
        // Tseitin introduces aux variables, so clause count might be different
        // but it should be satisfiable.
        const check = await sat.checkSat(res.clauses!);
        expect(check.sat).toBe(true);
    });

    test('preserves unsatisfiability', async () => {
        const formula = 'P & -P';
        const res = clausify(formula, { strategy: 'tseitin' });
        expect(res.success).toBe(true);
        const check = await sat.checkSat(res.clauses!);
        expect(check.sat).toBe(false);
    });

    test('handles complex nested formula', async () => {
        // (A & B) | (C & D)
        const formula = '(A & B) | (C & D)';
        const res = clausify(formula, { strategy: 'tseitin' });
        expect(res.success).toBe(true);

        // Should be satisfiable
        const check = await sat.checkSat(res.clauses!);
        expect(check.sat).toBe(true);
    });

    test('prevents exponential blowup (heuristic check)', () => {
        // (A1 & B1) | (A2 & B2) | ... | (A10 & B10)
        // Standard distribution: 2^10 = 1024 clauses
        // Tseitin: Linear ~ 30-40 clauses

        const parts = [];
        for(let i=0; i<10; i++) {
            parts.push(`(A${i} & B${i})`);
        }
        const formula = parts.join(' | ');

        const resTseitin = clausify(formula, { strategy: 'tseitin' });
        expect(resTseitin.clauses!.length).toBeLessThan(100);

        // const resStandard = clausify(formula, { strategy: 'standard' });
        // expect(resStandard.clauses!.length).toBeGreaterThan(1000);
    });
});

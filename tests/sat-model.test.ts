import { ModelFinder } from '../src/modelFinder';

describe('SAT Model Finding', () => {
    const finder = new ModelFinder(30000, 25);

    it('finds group of order 4 via SAT', async () => {
        const axioms = [
            'all X (op(e, X) = X)',
            'all X (op(inv(X), X) = e)',
            'all X all Y all Z (op(op(X, Y), Z) = op(X, op(Y, Z)))'
        ];
        const result = await finder.findModel(axioms, { useSAT: true, maxDomainSize: 4 });
        expect(result.success).toBe(true);
    });
});

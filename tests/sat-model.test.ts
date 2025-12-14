import { ModelFinder } from '../src/modelFinder';
import { createTestModelFinder, expectModelFound } from './fixtures.js';

describe('SAT Model Finding', () => {
    // Uses default test finder (maxDomainSize: 10, highPower: false)
    const finder = createTestModelFinder({ highPower: true, maxDomainSize: 25 });

    it('finds group of order 4 via SAT', async () => {
        const axioms = [
            'all X (op(e, X) = X)',
            'all X (op(inv(X), X) = e)',
            'all X all Y all Z (op(op(X, Y), Z) = op(X, op(Y, Z)))'
        ];
        // SAT should be used automatically or forced
        const result = await finder.findModel(axioms, { useSAT: true, maxDomainSize: 4 });
        expect(result.success).toBe(true);
        expect(result.result).toBe('model_found');
        expectModelFound(result);
        if (result.model) {
            expect(result.model.domainSize).toBeGreaterThanOrEqual(1);
        }
    });
});

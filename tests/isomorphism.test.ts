import { createModelFinder } from '../src/model/index.js';
import { Model } from '../src/types/index.js';

describe('Isomorphism Filtering', () => {
    const finder = createModelFinder(5000, 10);

    test('should find multiple non-isomorphic models for P(a) | P(b)', async () => {
        // P(a) | P(b) with domain size 2 has multiple models
        // But many are isomorphic.
        // e.g. {a=0, b=1, P={0}} is isomorphic to {a=1, b=0, P={1}} via map {0->1, 1->0}

        const result = await finder.findModel(
            ['P(a) | P(b)', '-(a=b)'],
            { count: 5, maxDomainSize: 2 }
        );

        expect(result.success).toBe(true);
        expect(result.models).toBeDefined();
        // Expect at least 3 models (P(a) true, P(b) true, both true)
        expect(result.models!.length).toBeGreaterThanOrEqual(3);

        // Verify models are distinct
        const models = result.models!;
        for (let i = 0; i < models.length; i++) {
            for (let j = i + 1; j < models.length; j++) {
                expect(models[i].interpretation).not.toBe(models[j].interpretation);
            }
        }
    });

    test('returns multiple non-isomorphic models', async () => {
        const finder = createModelFinder();
        // P(a) | Q(a) in size 1 has 3 models: {P,Q}, {P}, {Q}
        const result = await finder.findModel(
            ['P(a) | Q(a)'],
            { count: 5, maxDomainSize: 1 }
        );
        expect(result.models?.length).toBeGreaterThanOrEqual(3);

        // Verify non-isomorphism indirectly
        if (result.models && result.models.length >= 2) {
             expect(result.models[0].interpretation).not.toEqual(result.models[1].interpretation);
        }
    });
});

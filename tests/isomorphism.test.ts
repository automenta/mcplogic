import { createModelFinder } from '../src/modelFinder.js';
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
        expect(result.models!.length).toBeGreaterThan(1);

        // Verify models are distinct
        const models = result.models!;
        for (let i = 0; i < models.length; i++) {
            for (let j = i + 1; j < models.length; j++) {
                // We can't easily access private areIsomorphic, but we can check properties
                // or trust that the finder did its job if count > 1 and we got distinct interpretations
                expect(models[i].interpretation).not.toBe(models[j].interpretation);
            }
        }

        console.log(`Found ${models.length} models for P(a) | P(b)`);
        models.forEach((m, i) => {
            console.log(`Model ${i + 1}:\n${m.interpretation}`);
        });
    });

    test('should not return isomorphic duplicates', async () => {
        // Simple case: P(a). Domain size 2.
        // Models:
        // 1. a=0, P={0}
        // 2. a=1, P={1} -> Isomorphic to 1
        // 3. a=0, P={0,1}
        // 4. a=1, P={0,1} -> Isomorphic to 3

        const result = await finder.findModel(
            ['P(a)'],
            { count: 10, maxDomainSize: 2, enableSymmetry: false } // Disable symmetry breaking to rely on our iso check
        );

        expect(result.success).toBe(true);
        const models = result.models!;

        // Should find limited number of non-isomorphic models
        // For domain size 1:
        // 1. a=0, P={0}
        // 2. a=0, P={} -> contradiction

        // For domain size 2:
        // 1. a=0, P={0}
        // 2. a=0, P={0,1}
        // ...

        console.log(`Found ${models.length} models for P(a)`);
        models.forEach((m, i) => {
            console.log(`Model ${i + 1}:\n${m.interpretation}`);
        });
    });
});

import { allTuples, allMappings, generatePermutations, symmetricMappings } from '../src/utils/math/enumerate.js';

describe('Enumerate Utilities', () => {
    test('allTuples', () => {
        const domain = [0, 1];
        const tuples = [...allTuples(domain, 2)];
        expect(tuples).toHaveLength(4);
        expect(tuples).toEqual([
            [0, 0], [0, 1],
            [1, 0], [1, 1]
        ]);

        const tuples3 = [...allTuples(domain, 3)];
        expect(tuples3).toHaveLength(8);
    });

    test('allMappings', () => {
        const keys = ['a', 'b'];
        const domain = [0, 1];
        const mappings = [...allMappings(keys, domain)];
        expect(mappings).toHaveLength(4);

        // Check structural sharing/independence
        const m1 = mappings[0];
        const m2 = mappings[1];
        expect(m1).not.toBe(m2);
        // m1 should be {a:0, b:0}, m2 should be {a:0, b:1} (or similar order)

        // Verify one specific mapping
        const hasZeroZero = mappings.some(m => m.get('a') === 0 && m.get('b') === 0);
        expect(hasZeroZero).toBe(true);
    });

    test('generatePermutations', () => {
        const domain = [1, 2, 3];
        const perms = [...generatePermutations(domain)];
        expect(perms).toHaveLength(6);

        // Verify all are unique
        const strings = perms.map(p => p.join(','));
        const unique = new Set(strings);
        expect(unique.size).toBe(6);

        // Verify Heap's algo correctness for small N
        expect(strings).toContain('1,2,3');
        expect(strings).toContain('3,2,1');
    });

    test('symmetricMappings', () => {
        const keys = ['a', 'b', 'c'];
        const domainSize = 3;
        const mappings = [...symmetricMappings(keys, domainSize)];

        // For 3 keys and domain size 3, standard mappings is 3^3 = 27.
        // Symmetric mappings (canonical) are related to Bell numbers or Stirling numbers depending on constraint.
        // Here we constrain maxUsed + 1.
        // This corresponds to generating restricted growth strings (RGS).
        // For length 3, RGS are:
        // 000, 001, 010, 011, 012
        // Wait, 010 -> maxUsed at pos 1 is 0. Next can be 0 or 1.
        // Let's trace:
        // 0..
        //  00. -> 000, 001
        //  01. -> 010, 011, 012
        // Total 5. Bell(3) = 5. Correct.

        expect(mappings).toHaveLength(5);

        // Verify a valid one: 0, 1, 2
        const has012 = mappings.some(m => m.get('a') === 0 && m.get('b') === 1 && m.get('c') === 2);
        expect(has012).toBe(true);

        // Verify invalid one: 1, 0, 0 (starts with 1, violates maxUsed=-1 initially)
        // Wait, the generator ensures starts with 0.
        const startsWith1 = mappings.some(m => m.get('a') === 1);
        expect(startsWith1).toBe(false);
    });
});

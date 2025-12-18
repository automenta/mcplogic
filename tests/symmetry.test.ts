import { symmetricMappings, allMappings } from '../src/utils/math/enumerate.js';

describe('Symmetry Breaking', () => {
    it('reduces 3 keys from 64 to 5', () => {
        const sym = [...symmetricMappings(['a', 'b', 'c'], 4)];
        const brute = [...allMappings(['a', 'b', 'c'], [0, 1, 2, 3])];
        expect(sym.length).toBe(5);    // Bell(3)
        expect(brute.length).toBe(64); // 4^3
    });

    it('reduces 4 keys from 256 to 15', () => {
        const sym = [...symmetricMappings(['a', 'b', 'c', 'd'], 4)];
        expect(sym.length).toBe(15);   // Bell(4)
    });
});

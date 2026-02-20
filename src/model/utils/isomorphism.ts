import { Model } from '../../types/index.js';
import { generatePermutations } from '../../utils/math/enumerate.js';

/**
 * Check if two models are isomorphic
 */
export function areIsomorphic(m1: Model, m2: Model): boolean {
    if (m1.domainSize !== m2.domainSize) return false;

    // Safety check: Don't attempt isomorphism check for large domains
    // n=9 -> 362,880 permutations, which is too slow for interactive use
    if (m1.domainSize > 8) return false;

    // Generate all permutations of the domain
    // generatePermutations yields arrays (number[]) representing the permutation
    const permutations = generatePermutations(m1.domain);

    for (const p of permutations) {
        // Convert array permutation to Map
        const mapping = new Map<number, number>();
        // Assuming m1.domain is sorted or consistent, map domain[i] -> p[i]
        // Actually generatePermutations returns permutations of the values in the array passed.
        // So p is a permutation of m1.domain.
        // If m1.domain is [0, 1], p could be [1, 0].
        // This means 0 maps to 1, 1 maps to 0? Or index mapping?
        // generatePermutations implementation swaps elements.
        // So p is a valid ordering of domain elements.
        // An isomorphism is a bijection f: D1 -> D2. Here D1=D2=domain.
        // We can define f(domain[i]) = p[i].

        for (let i = 0; i < m1.domain.length; i++) {
            mapping.set(m1.domain[i], p[i]);
        }

        if (isIsomorphism(m1, m2, mapping)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if a specific permutation is an isomorphism
 */
export function isIsomorphism(m1: Model, m2: Model, mapping: Map<number, number>): boolean {
    // Check constants
    for (const [name, val1] of m1.constants) {
        // If constant exists in m1, it must exist in m2 and map correctly
        const val2 = m2.constants.get(name);
        if (val2 === undefined) return false; // Signature mismatch

        // mapped(val1) should equal val2
        const mappedVal1 = mapping.get(val1);
        if (mappedVal1 === undefined || mappedVal1 !== val2) return false;
    }

    // Check predicates
    for (const [name, ext1] of m1.predicates) {
        const ext2 = m2.predicates.get(name);
        if (!ext2) return false; // Should not happen if signatures match
        if (ext1.size !== ext2.size) return false;

        // Check if every tuple in ext1 maps to a tuple in ext2
        // Since sizes are equal and mapping is bijection, this implies full equality of extensions
        for (const tupleStr of ext1) {
            const args = tupleStr === '' ? [] : tupleStr.split(',').map(Number);
            const mappedArgs = args.map(a => mapping.get(a)!);
            const mappedTupleStr = mappedArgs.join(',');

            if (!ext2.has(mappedTupleStr)) return false;
        }
    }

    // Check functions
    for (const [name, table1] of m1.functions) {
        const table2 = m2.functions.get(name);
        if (!table2) return false;

        for (const [argsStr, val1] of table1) {
            const args = argsStr === '' ? [] : argsStr.split(',').map(Number);
            const mappedArgs = args.map(a => mapping.get(a)!);
            const mappedArgsStr = mappedArgs.join(',');

            // f(mappedArgs) in M2 must equal mapped(val1)
            const val2 = table2.get(mappedArgsStr);
            const mappedVal1 = mapping.get(val1);

            if (val2 === undefined || mappedVal1 === undefined || val2 !== mappedVal1) return false;
        }
    }

    return true;
}

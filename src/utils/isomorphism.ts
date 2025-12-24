import { Model } from '../types/index.js';
import { generatePermutations } from './enumerate.js';

/**
 * Check if two models are isomorphic
 */
export function areIsomorphic(m1: Model, m2: Model): boolean {
    if (m1.domainSize !== m2.domainSize) return false;

    // Safety check: Don't attempt isomorphism check for large domains
    // n=9 -> 362,880 permutations, which is too slow for interactive use
    if (m1.domainSize > 8) return false;

    // Generate all permutations of the domain
    const permutations = generatePermutations(m1.domain);

    for (const p of permutations) {
        if (isIsomorphism(m1, m2, p)) {
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
        const val2 = m2.constants.get(name);
        if (val2 === undefined || mapping.get(val1) !== val2) return false;
    }

    // Check predicates
    for (const [name, ext1] of m1.predicates) {
        const ext2 = m2.predicates.get(name);
        if (!ext2) return false; // Should not happen if signatures match
        if (ext1.size !== ext2.size) return false;

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

            const val2 = table2.get(mappedArgsStr);
            if (val2 === undefined || mapping.get(val1) !== val2) return false;
        }
    }

    return true;
}

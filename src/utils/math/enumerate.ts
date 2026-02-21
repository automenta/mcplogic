import { createGenericError } from '../../types/errors.js';

/**
 * Shared enumeration utilities.
 * Used by: Model finding, SAT grounding, function interpretation.
 */

/**
 * Generate all n-tuples over domain.
 * Example: domain=[0,1], arity=2 -> [[0,0], [0,1], [1,0], [1,1]]
 */
export function* allTuples<T>(domain: T[], arity: number): Generator<T[]> {
    if (arity < 0) throw createGenericError('MATH_ERROR', 'Arity must be non-negative');
    if (arity === 0) {
        yield [];
        return;
    }

    if (arity === 1) {
        for (const d of domain) {
            yield [d];
        }
        return;
    }

    // Base case for recursion handled by loop over domain
    for (const d of domain) {
        for (const rest of allTuples(domain, arity - 1)) {
            yield [d, ...rest];
        }
    }
}

/**
 * Generate all mappings from keys to domain values.
 * Note: Yields a new Map for each mapping to ensure immutability.
 */
export function* allMappings<K, V>(
    keys: K[],
    domain: V[]
): Generator<Map<K, V>> {
    if (keys.length === 0) {
        yield new Map();
        return;
    }

    // Recursive helper
    function* generate(index: number, currentMap: Map<K, V>): Generator<Map<K, V>> {
        if (index === keys.length) {
            yield new Map(currentMap);
            return;
        }

        const key = keys[index];
        for (const value of domain) {
            currentMap.set(key, value);
            yield* generate(index + 1, currentMap);
        }
        // Cleanup not strictly necessary as we overwrite or copy, but good practice if reused
        currentMap.delete(key);
    }

    yield* generate(0, new Map());
}

/**
 * Generate all permutations of a domain using Heap's Algorithm.
 * Memory efficient: yields one by one, does not store all in memory.
 */
export function* generatePermutations<T>(domain: T[]): Generator<T[]> {
    const n = domain.length;
    if (n === 0) {
        yield [];
        return;
    }

    // Copy to avoid mutating input array in place during generation
    const c = [...domain];

    // Use an iterative approach (Heap's Algorithm) to avoid stack depth issues
    const cIdx = new Array(n).fill(0);

    yield [...c];

    let i = 0;
    while (i < n) {
        if (cIdx[i] < i) {
            if (i % 2 === 0) {
                // Swap 0 and i
                [c[0], c[i]] = [c[i], c[0]];
            } else {
                // Swap cIdx[i] and i
                [c[cIdx[i]], c[i]] = [c[i], c[cIdx[i]]];
            }
            yield [...c];
            cIdx[i]++;
            i = 0;
        } else {
            cIdx[i] = 0;
            i++;
        }
    }
}

/**
 * Generate function table mappings.
 * A function table maps string keys (tuple args joined by comma) to domain values.
 * domain is expected to be number[] for simplicity as typical in finite model finding.
 */
export function* allFunctionTables(
    arity: number,
    domain: number[]
): Generator<Map<string, number>> {
    // Generate all possible input tuples once
    const tuplesGen = allTuples(domain, arity);
    const tupleKeys: string[] = [];
    for (const t of tuplesGen) {
        tupleKeys.push(t.join(','));
    }

    const numTuples = tupleKeys.length;
    const domainSize = domain.length;

    if (domainSize === 0) return;

    // Counter-based enumeration (base-domainSize)
    // Values represent indices into domain array
    const currentValues = new Array(numTuples).fill(0);

    while (true) {
        const table = new Map<string, number>();
        for (let i = 0; i < numTuples; i++) {
            table.set(tupleKeys[i], domain[currentValues[i]]);
        }
        yield table;

        // Increment counter (lexicographic order)
        let i = numTuples - 1;
        while (i >= 0) {
            currentValues[i]++;
            if (currentValues[i] < domainSize) {
                break; // Carry propagation done
            }
            currentValues[i] = 0; // Reset this digit and carry to next
            i--;
        }

        if (i < 0) break; // Overflow, done
    }
}

/**
 * Generate symmetric mappings (lex-leader constraint).
 * Used for symmetry breaking in model finding.
 * Reduces search space by generating only canonical representatives of isomorphic models.
 */
export function* symmetricMappings<K>(
    keys: K[],
    domainSize: number
): Generator<Map<K, number>> {
    const n = keys.length;
    if (n === 0) { yield new Map(); return; }

    function* backtrack(i: number, maxUsed: number, currentMap: Map<K, number>): Generator<Map<K, number>> {
        if (i === n) {
            yield new Map(currentMap);
            return;
        }

        const bound = Math.min(maxUsed + 1, domainSize - 1);

        for (let v = 0; v <= bound; v++) {
            currentMap.set(keys[i], v);
            yield* backtrack(i + 1, Math.max(maxUsed, v), currentMap);
        }
        currentMap.delete(keys[i]);
    }

    yield* backtrack(0, -1, new Map());
}

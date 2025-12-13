/**
 * Shared enumeration utilities.
 * Used by: Model finding, SAT grounding, function interpretation.
 */

/**
 * Generate all n-tuples over domain.
 */
export function* allTuples(domain: number[], arity: number): Generator<number[]> {
    if (arity === 0) { yield []; return; }
    if (arity === 1) { for (const d of domain) yield [d]; return; }
    for (const d of domain) {
        for (const rest of allTuples(domain, arity - 1)) {
            yield [d, ...rest];
        }
    }
}

/**
 * Generate all mappings from keys to domain values.
 */
export function* allMappings<K>(
    keys: K[],
    domain: number[]
): Generator<Map<K, number>> {
    if (keys.length === 0) { yield new Map(); return; }
    const [first, ...rest] = keys;
    for (const v of domain) {
        for (const m of allMappings(rest, domain)) {
            m.set(first, v);
            yield m;
        }
    }
}

/**
 * Generate symmetric mappings (lex-leader constraint).
 * Reduces n! redundant assignments for n keys.
 *
 * Bell numbers: B(1)=1, B(2)=2, B(3)=5, B(4)=15, B(5)=52
 */
export function* symmetricMappings<K>(
    keys: K[],
    domainSize: number
): Generator<Map<K, number>> {
    const n = keys.length;
    if (n === 0) { yield new Map(); return; }

    const assignment = new Map<K, number>();

    function* backtrack(i: number, maxUsed: number): Generator<Map<K, number>> {
        if (i === n) { yield new Map(assignment); return; }
        const bound = Math.min(maxUsed + 1, domainSize - 1);
        for (let v = 0; v <= bound; v++) {
            assignment.set(keys[i], v);
            yield* backtrack(i + 1, Math.max(maxUsed, v));
        }
    }

    yield* backtrack(0, -1);
}

/**
 * Generate all function tables: Map<argsKey, result>
 */
export function* allFunctionTables(
    arity: number,
    domain: number[]
): Generator<Map<string, number>> {
    const tuples = [...allTuples(domain, arity)];
    const numTables = Math.pow(domain.length, tuples.length);

    for (let tableIdx = 0; tableIdx < numTables; tableIdx++) {
        const table = new Map<string, number>();
        let rem = tableIdx;
        for (const tuple of tuples) {
            table.set(tuple.join(','), domain[rem % domain.length]);
            rem = Math.floor(rem / domain.length);
        }
        yield table;
    }
}

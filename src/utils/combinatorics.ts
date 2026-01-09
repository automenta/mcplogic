/**
 * Combinatorics Utilities
 *
 * Helper functions for generating combinations, permutations, and subsets.
 */

/**
 * Generate all n-tuples from domain
 */
export function allTuples(domain: number[], n: number): number[][] {
    if (n === 0) return [[]];
    const result: number[][] = [];
    const smaller = allTuples(domain, n - 1);
    for (const tuple of smaller) {
        for (const elem of domain) {
            result.push([...tuple, elem]);
        }
    }
    return result;
}

/**
 * Generate all subsets of a set
 */
export function* allSubsets<T>(set: T[]): Generator<T[]> {
    const n = set.length;
    const total = 1 << n;
    for (let mask = 0; mask < total; mask++) {
        const subset: T[] = [];
        for (let i = 0; i < n; i++) {
            if (mask & (1 << i)) {
                subset.push(set[i]);
            }
        }
        yield subset;
    }
}

/**
 * Enumerate all possible constant assignments
 */
export function* enumerateConstantAssignments(
    constants: string[],
    domain: number[]
): Generator<Map<string, number>> {
    if (constants.length === 0) {
        yield new Map();
        return;
    }

    const [first, ...rest] = constants;
    for (const value of domain) {
        for (const restAssignment of enumerateConstantAssignments(rest, domain)) {
            const assignment = new Map(restAssignment);
            assignment.set(first, value);
            yield assignment;
        }
    }
}

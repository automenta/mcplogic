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
 * Enumerate all possible constant assignments with Symmetry Breaking
 *
 * Uses the Least Number Heuristic:
 * The k-th constant can only be assigned a value v such that v <= max(assigned) + 1.
 * This avoids generating isomorphic models that differ only by a permutation of domain elements.
 */
export function* enumerateConstantAssignments(
    constants: string[],
    domain: number[],
    maxUsed: number = -1
): Generator<Map<string, number>> {
    if (constants.length === 0) {
        yield new Map();
        return;
    }

    const [first, ...rest] = constants;

    // Determine the range of values we can assign to 'first'.
    // We can pick any value from 0 up to maxUsed + 1.
    // However, we must ensure we don't go out of domain bounds.
    // Also, we must check if we are allowed to pick ANY value in domain if maxUsed is "saturated"?
    // No, standard LNH says: value <= maxUsed + 1.

    const limit = Math.min(maxUsed + 1, domain.length - 1);

    for (let value = 0; value <= limit; value++) {
        // Calculate new maxUsed
        const newMaxUsed = Math.max(maxUsed, value);

        for (const restAssignment of enumerateConstantAssignments(rest, domain, newMaxUsed)) {
            const assignment = new Map(restAssignment);
            assignment.set(first, value);
            yield assignment;
        }
    }
}

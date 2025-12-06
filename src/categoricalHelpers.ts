/**
 * Categorical Helpers for FOL
 * 
 * Port of categorical_helpers.py - generates category theory axioms and
 * commutativity verification premises.
 */

export interface CommutativityResult {
    premises: string[];
    conclusion: string;
}

/**
 * Categorical reasoning helpers for first-order logic
 */
export class CategoricalHelpers {
    /**
     * Generate basic category theory axioms
     */
    categoryAxioms(): string[] {
        return [
            // Identity morphisms exist
            'all x (object(x) -> exists i (morphism(i) & source(i,x) & target(i,x) & identity(i,x)))',
            // Identity is unique
            'all x all i1 all i2 ((identity(i1,x) & identity(i2,x)) -> i1 = i2)',
            // Composition exists when source/target match
            'all f all g ((morphism(f) & morphism(g) & target(f) = source(g)) -> exists h (morphism(h) & compose(g,f,h)))',
            // Composition is associative
            'all f all g all h all fg all gh all fgh all gfh ((compose(g,f,fg) & compose(h,g,gh) & compose(h,fg,fgh) & compose(gh,f,gfh)) -> fgh = gfh)',
            // Left identity law
            'all f all a all id ((morphism(f) & source(f,a) & identity(id,a) & compose(f,id,comp)) -> comp = f)',
            // Right identity law
            'all f all b all id ((morphism(f) & target(f,b) & identity(id,b) & compose(id,f,comp)) -> comp = f)'
        ];
    }

    /**
     * Generate functor axioms
     */
    functorAxioms(functorName: string = 'F'): string[] {
        const f = functorName.toLowerCase();
        return [
            // Functor preserves identity
            `all x all id (identity(id,x) -> identity(${f}(id), ${f}(x)))`,
            // Functor preserves composition
            `all g all h all gh ((compose(g,h,gh)) -> compose(${f}(g), ${f}(h), ${f}(gh)))`
        ];
    }

    /**
     * Generate FOL to verify diagram commutativity
     * 
     * Two paths commute if composing morphisms along each yields the same result.
     */
    verifyCommutativity(
        pathA: string[],
        pathB: string[],
        objectStart: string,
        objectEnd: string
    ): CommutativityResult {
        const premises: string[] = [];

        // Define morphisms for both paths
        [pathA, pathB].forEach(path => {
            path.forEach((morph, i) => {
                premises.push(`morphism(${morph})`);
                if (i === 0) {
                    premises.push(`source(${morph}, ${objectStart})`);
                }
                if (i === path.length - 1) {
                    premises.push(`target(${morph}, ${objectEnd})`);
                }
            });
        });

        // Compose paths
        const compA = this.composePathHelper(pathA, 'comp_a');
        const compB = this.composePathHelper(pathB, 'comp_b');

        premises.push(...compA.premises);
        premises.push(...compB.premises);

        // Conclusion: composed paths are equal
        const conclusion = `${compA.result} = ${compB.result}`;

        return { premises, conclusion };
    }

    /**
     * Generate naturality condition for natural transformation
     * 
     * For α: F ⇒ G, the naturality square must commute:
     * G(f) ∘ α_A = α_B ∘ F(f)
     */
    naturalTransformationCondition(
        functorF: string = 'F',
        functorG: string = 'G',
        component: string = 'alpha'
    ): string[] {
        const fLower = functorF.toLowerCase();
        const gLower = functorG.toLowerCase();

        return [
            `all morph all a all b ((morphism(morph) & source(morph,a) & target(morph,b)) -> exists comp1 exists comp2 (compose(${gLower}(morph), ${component}(a), comp1) & compose(${component}(b), ${fLower}(morph), comp2) & comp1 = comp2))`
        ];
    }

    /**
     * Helper to generate composition premises for a path
     */
    private composePathHelper(
        path: string[],
        resultName: string
    ): { premises: string[]; result: string } {
        if (path.length === 1) {
            return { premises: [], result: path[0] };
        }

        const premises: string[] = [];
        let current = path[0];

        for (let i = 1; i < path.length; i++) {
            const tempName = i < path.length - 1 ? `${resultName}_temp_${i}` : resultName;
            premises.push(`compose(${path[i]}, ${current}, ${tempName})`);
            current = tempName;
        }

        return { premises, result: current };
    }
}

/**
 * Generate monoid axioms (category with one object)
 */
export function monoidAxioms(): string[] {
    return [
        // Binary operation
        'all x all y exists z (mult(x,y,z))',
        // Associativity
        'all x all y all z all xy all yz all xyz all xyz2 ((mult(x,y,xy) & mult(y,z,yz) & mult(xy,z,xyz) & mult(x,yz,xyz2)) -> xyz = xyz2)',
        // Identity exists
        'exists e (all x (mult(e,x,x) & mult(x,e,x)))'
    ];
}

/**
 * Generate group axioms
 */
export function groupAxioms(): string[] {
    return [
        ...monoidAxioms(),
        // Inverses exist
        'all x exists y (mult(x,y,e) & mult(y,x,e))'
    ];
}

// Export singleton instance for convenience
export const categoricalHelpers = new CategoricalHelpers();

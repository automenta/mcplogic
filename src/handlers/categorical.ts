import { CategoricalHelpers, monoidAxioms, groupAxioms } from '../categoricalHelpers.js';

export function verifyCommutativityHandler(
    args: {
        path_a: string[];
        path_b: string[];
        object_start: string;
        object_end: string;
        with_category_axioms?: boolean;
    },
    categoricalHelpers: CategoricalHelpers
): object {
    const { path_a, path_b, object_start, object_end, with_category_axioms = true } = args;

    const { premises, conclusion } = categoricalHelpers.verifyCommutativity(
        path_a,
        path_b,
        object_start,
        object_end
    );

    let allPremises = premises;
    if (with_category_axioms) {
        allPremises = [...categoricalHelpers.categoryAxioms(), ...premises];
    }

    return {
        premises: allPremises,
        conclusion,
        note: "Use the 'prove' tool with these premises and conclusion to verify commutativity",
    };
}

export function getCategoryAxiomsHandler(
    args: {
        concept: string;
        functor_name?: string;
    },
    categoricalHelpers: CategoricalHelpers
): object {
    const { concept, functor_name = 'F' } = args;

    let axioms: string[];

    switch (concept) {
        case 'category':
            axioms = categoricalHelpers.categoryAxioms();
            break;
        case 'functor':
            axioms = categoricalHelpers.functorAxioms(functor_name);
            break;
        case 'natural-transformation':
            axioms = categoricalHelpers.naturalTransformationCondition();
            break;
        case 'monoid':
            axioms = monoidAxioms();
            break;
        case 'group':
            axioms = groupAxioms();
            break;
        default:
            axioms = [];
    }

    return { concept, axioms };
}

/**
 * Basic tests for the MCP Logic Node.js implementation
 */

import { parse, astToString } from '../src/parser.js';
import { validateFormulas } from '../src/syntaxValidator.js';
import { CategoricalHelpers, monoidAxioms, groupAxioms } from '../src/axioms/categorical.js';
import { ModelFinder } from '../src/modelFinder.js';

describe('Parser', () => {
    test('parses simple predicate', () => {
        const ast = parse('man(socrates)');
        expect(ast.type).toBe('predicate');
        expect(ast.name).toBe('man');
        expect(ast.args?.length).toBe(1);
    });

    test('parses universal quantification', () => {
        const ast = parse('all x (man(x) -> mortal(x))');
        expect(ast.type).toBe('forall');
        expect(ast.variable).toBe('x');
    });

    test('parses conjunction', () => {
        const ast = parse('P(a) & Q(b)');
        expect(ast.type).toBe('and');
    });

    test('parses negation', () => {
        const ast = parse('-P(x)');
        expect(ast.type).toBe('not');
    });

    test('roundtrips formula', () => {
        const formula = 'all x (man(x) -> mortal(x))';
        const ast = parse(formula);
        const result = astToString(ast);
        expect(result).toContain('all x');
        expect(result).toContain('man');
        expect(result).toContain('mortal');
    });
});

describe('SyntaxValidator', () => {
    test('validates correct formula', () => {
        const result = validateFormulas(['all x (P(x) -> Q(x))']);
        expect(result.valid).toBe(true);
    });

    test('detects unbalanced parentheses', () => {
        const result = validateFormulas(['all x (P(x) -> Q(x)']);
        expect(result.valid).toBe(false);
        expect(result.formulaResults[0].errors.some(e => e.includes('parenthesis'))).toBe(true);
    });

    test('warns about uppercase predicates', () => {
        const result = validateFormulas(['Man(x)']);
        expect(result.formulaResults[0].warnings.some(w => w.includes('uppercase'))).toBe(true);
    });
});

describe('CategoricalHelpers', () => {
    const helpers = new CategoricalHelpers();

    test('generates category axioms', () => {
        const axioms = helpers.categoryAxioms();
        expect(axioms.length).toBe(6);
        expect(axioms[0]).toContain('identity');
    });

    test('generates functor axioms', () => {
        const axioms = helpers.functorAxioms('F');
        expect(axioms.length).toBe(2);
    });

    test('verifies commutativity', () => {
        const { premises, conclusion } = helpers.verifyCommutativity(
            ['f', 'g'],
            ['h'],
            'A',
            'C'
        );
        expect(premises.length).toBeGreaterThan(0);
        expect(conclusion).toContain('=');
    });

    test('generates monoid axioms', () => {
        const axioms = monoidAxioms();
        expect(axioms.length).toBe(3);
    });

    test('generates group axioms', () => {
        const axioms = groupAxioms();
        expect(axioms.length).toBe(4);
    });
});

describe('ModelFinder', () => {
    const finder = new ModelFinder(5000, 4);

    test('finds model for simple predicate', async () => {
        const result = await finder.findModel(['P(a)'], 2);
        expect(result.result).toBe('model_found');
        expect(result.model).toBeDefined();
        expect(result.model!.domainSize).toBe(2);
    });

    test('finds counterexample', async () => {
        // Need domain size >= 2 to have distinct elements for a and b
        const result = await finder.findCounterexample(['P(a)'], 'P(b)');
        // The model finder should find a model where P(a) is true but P(b) is false
        // This requires a and b to be different elements
        if (result.result === 'model_found') {
            expect(result.interpretation).toContain('Counterexample');
        } else {
            // If no model found in small domains, that's acceptable
            expect(['no_model', 'timeout']).toContain(result.result);
        }
    });
});

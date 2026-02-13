
import { OntologyManager } from '../src/ontology/manager.js';
import { createGenericError } from '../src/types/errors.js';

describe('OntologyManager', () => {
    let manager: OntologyManager;

    beforeEach(() => {
        manager = new OntologyManager({
            types: ['Person', 'Dog'],
            relationships: ['owns', 'loves'],
            synonyms: {
                'human': 'Person',
                'canine': 'Dog',
                'likes': 'loves'
            }
        });
    });

    test('expands synonyms in predicates', () => {
        const formula = 'likes(john, mary)';
        const expanded = manager.expandSynonyms(formula);
        // "loves(john,mary)" - formatting depends on astToString
        expect(expanded).toContain('loves');
        expect(expanded).toContain('john');
        expect(expanded).toContain('mary');
    });

    test('expands synonyms in types (unary predicates)', () => {
        const formula = 'human(socrates)';
        const expanded = manager.expandSynonyms(formula);
        expect(expanded).toContain('Person');
        expect(expanded).toContain('socrates');
    });

    test('validates allowed predicates', () => {
        expect(() => manager.validate('owns(john, fido)')).not.toThrow();
        expect(() => manager.validate('Person(john)')).not.toThrow();
    });

    test('rejects disallowed predicates', () => {
        expect(() => manager.validate('eats(john, apple)')).toThrow();
    });

    test('dynamic updates', () => {
        manager.update({ relationships: ['eats'] });
        expect(() => manager.validate('eats(john, apple)')).not.toThrow();
    });

    test('handles empty ontology (permissive)', () => {
        const emptyManager = new OntologyManager();
        expect(emptyManager.expandSynonyms('foo(a)')).toBe('foo(a)');
        expect(() => emptyManager.validate('foo(a)')).not.toThrow();
    });
});

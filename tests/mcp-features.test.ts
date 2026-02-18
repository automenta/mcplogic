/**
 * Tests for MCP Resources and Prompts
 * 
 * Tests the new Phase 3 features: axiom libraries and reasoning templates.
 */

import { listResources, getResourceContent } from '../src/resources/index.js';
import { listPrompts, getPrompt } from '../src/prompts/index.js';

describe('MCP Resources', () => {
    describe('listResources', () => {
        test('returns all resources', () => {
            const resources = listResources();
            expect(resources.length).toBe(11);  // 10 axiom resources + 1 engine info
        });

        test('each resource has required fields', () => {
            const resources = listResources();
            for (const r of resources) {
                expect(r.uri).toBeDefined();
                expect(r.name).toBeDefined();
                expect(r.description).toBeDefined();
                expect(['text/plain', 'application/json']).toContain(r.mimeType);
            }
        });

        test('includes expected axiom URIs', () => {
            const resources = listResources();
            const uris = resources.map(r => r.uri);

            expect(uris).toContain('logic://axioms/category');
            expect(uris).toContain('logic://axioms/monoid');
            expect(uris).toContain('logic://axioms/group');
            expect(uris).toContain('logic://axioms/peano');
            expect(uris).toContain('logic://axioms/set-zfc');
            expect(uris).toContain('logic://axioms/propositional');
            expect(uris).toContain('logic://templates/syllogism');
        });
    });

    describe('getResourceContent', () => {
        test('returns content for category axioms', () => {
            const content = getResourceContent('logic://axioms/category');
            expect(content).not.toBeNull();
            expect(content).toContain('Category Theory Axioms');
            expect(content).toContain('identity');
            expect(content).toContain('compose');
        });

        test('returns content for monoid axioms', () => {
            const content = getResourceContent('logic://axioms/monoid');
            expect(content).not.toBeNull();
            expect(content).toContain('Monoid');
            expect(content).toContain('mult');
        });

        test('returns content for group axioms', () => {
            const content = getResourceContent('logic://axioms/group');
            expect(content).not.toBeNull();
            expect(content).toContain('Group');
            // Groups include monoid axioms plus inverses
            expect(content).toContain('mult');
        });

        test('returns content for peano axioms', () => {
            const content = getResourceContent('logic://axioms/peano');
            expect(content).not.toBeNull();
            expect(content).toContain('Peano');
            expect(content).toContain('nat(zero)');
            expect(content).toContain('succ');
        });

        test('returns content for zfc axioms', () => {
            const content = getResourceContent('logic://axioms/set-zfc');
            expect(content).not.toBeNull();
            expect(content).toContain('ZFC');
            expect(content).toContain('member');
            expect(content).toContain('subset');
        });

        test('returns content for propositional axioms', () => {
            const content = getResourceContent('logic://axioms/propositional');
            expect(content).not.toBeNull();
            expect(content).toContain('Propositional');
            expect(content).toContain('->');
        });

        test('returns content for syllogism patterns', () => {
            const content = getResourceContent('logic://templates/syllogism');
            expect(content).not.toBeNull();
            expect(content).toContain('Syllogism');
            expect(content).toContain('Barbara');
        });

        test('returns null for unknown URI', () => {
            const content = getResourceContent('logic://unknown/resource');
            expect(content).toBeNull();
        });

        test('axiom content is valid FOL syntax', () => {
            // Category axioms should contain FOL formulas
            const content = getResourceContent('logic://axioms/category');
            expect(content).toContain('all x');
            expect(content).toContain('->');
        });

        test('returns content for engines resource', () => {
            const content = getResourceContent('logic://engines');
            expect(content).not.toBeNull();
            const parsed = JSON.parse(content!);
            expect(parsed.engines).toBeDefined();
            expect(parsed.engines.length).toBeGreaterThan(0);
            expect(parsed.engines[0].name).toBeDefined();
            expect(parsed.engines[0].capabilities).toBeDefined();
        });
    });
});

describe('MCP Prompts', () => {
    describe('listPrompts', () => {
        test('returns all prompts', () => {
            const prompts = listPrompts();
            expect(prompts.length).toBe(5);
        });

        test('each prompt has required fields', () => {
            const prompts = listPrompts();
            for (const p of prompts) {
                expect(p.name).toBeDefined();
                expect(p.description).toBeDefined();
                expect(p.arguments).toBeDefined();
                expect(Array.isArray(p.arguments)).toBe(true);
            }
        });

        test('includes expected prompt names', () => {
            const prompts = listPrompts();
            const names = prompts.map(p => p.name);

            expect(names).toContain('prove-by-contradiction');
            expect(names).toContain('verify-equivalence');
            expect(names).toContain('formalize');
            expect(names).toContain('diagnose-unsat');
            expect(names).toContain('explain-proof');
        });
    });

    describe('getPrompt', () => {
        test('renders prove-by-contradiction', () => {
            const result = getPrompt('prove-by-contradiction', { statement: 'P(a)' });
            expect(result).not.toBeNull();
            expect(result!.description).toBe('Proof by contradiction setup');
            expect(result!.messages).toHaveLength(1);
            expect(result!.messages[0].role).toBe('user');
            expect(result!.messages[0].content.text).toContain('P(a)');
            expect(result!.messages[0].content.text).toContain('contradiction');
        });

        test('renders verify-equivalence', () => {
            const result = getPrompt('verify-equivalence', {
                formula_a: 'P(x)',
                formula_b: 'Q(x)'
            });
            expect(result).not.toBeNull();
            expect(result!.description).toBe('Equivalence verification');
            expect(result!.messages[0].content.text).toContain('P(x)');
            expect(result!.messages[0].content.text).toContain('Q(x)');
            expect(result!.messages[0].content.text).toContain('BOTH directions');
        });

        test('renders formalize with domain hint', () => {
            const result = getPrompt('formalize', {
                natural_language: 'All cats are mammals',
                domain_hint: 'biology'
            });
            expect(result).not.toBeNull();
            expect(result!.description).toBe('Natural language to FOL translation guide');
            expect(result!.messages[0].content.text).toContain('All cats are mammals');
            expect(result!.messages[0].content.text).toContain('biology');
        });

        test('renders formalize without domain hint', () => {
            const result = getPrompt('formalize', {
                natural_language: 'Some birds fly'
            });
            expect(result).not.toBeNull();
            expect(result!.messages[0].content.text).toContain('Some birds fly');
            expect(result!.messages[0].content.text).not.toContain('Domain context');
        });

        test('renders diagnose-unsat', () => {
            const result = getPrompt('diagnose-unsat', {
                premises: '["P(a)", "-P(a)"]'
            });
            expect(result).not.toBeNull();
            expect(result!.description).toBe('Unsatisfiable premise diagnosis');
            expect(result!.messages[0].content.text).toContain('P(a)');
        });

        test('renders explain-proof', () => {
            const result = getPrompt('explain-proof', {
                premises: '["man(socrates)", "all x (man(x) -> mortal(x))"]',
                conclusion: 'mortal(socrates)'
            });
            expect(result).not.toBeNull();
            expect(result!.description).toBe('Proof explanation');
            expect(result!.messages[0].content.text).toContain('mortal(socrates)');
            expect(result!.messages[0].content.text).toContain('man(socrates)');
        });

        test('returns null for unknown prompt', () => {
            const result = getPrompt('unknown-prompt', {});
            expect(result).toBeNull();
        });

        test('handles empty arguments gracefully', () => {
            const result = getPrompt('prove-by-contradiction', {});
            expect(result).not.toBeNull();
            // Should still work, just with empty statement
            expect(result!.messages[0].content.text).toContain('by contradiction');
        });
    });
});

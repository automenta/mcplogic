import type { ASTNode, ASTNodeType } from '../types/index.js';
import type { Token, TokenType } from '../types/parser.js';
import { createParseError } from '../types/errors.js';

/**
 * Parser for FOL formulas
 *
 * Grammar (EBNF-ish):
 *   formula     = iff
 *   iff         = implies (('<->' implies)*)
 *   implies     = disjunction (('->' implies)?)
 *   disjunction = conjunction (('|' conjunction)*)
 *   conjunction = unary (('&' unary)*)
 *   unary       = '-' unary | quantified | atom
 *   quantified  = ('all' | 'exists') VARIABLE formula
 *   atom        = predicate | '(' formula ')' | term '=' term
 *   predicate   = IDENTIFIER '(' term-list ')'
 *   term        = IDENTIFIER ('(' term-list ')')? | VARIABLE
 *   term-list   = term (',' term)*
 */
export class Parser {
    private tokens: Token[];
    private originalInput: string;
    private pos: number = 0;
    private boundVariables: Set<string> = new Set();

    constructor(tokens: Token[], originalInput: string) {
        this.tokens = tokens;
        this.originalInput = originalInput;
    }

    parse(): ASTNode {
        const result = this.parseFormula();
        if (this.current().type !== 'EOF' && this.current().type !== 'DOT') {
            throw createParseError(
                `Unexpected token '${this.current().value}'`,
                this.originalInput,
                this.current().position
            );
        }
        return result;
    }

    private current(): Token {
        return this.tokens[this.pos] || { type: 'EOF', value: '', position: -1 };
    }

    private peek(offset: number = 0): Token {
        return this.tokens[this.pos + offset] || { type: 'EOF', value: '', position: -1 };
    }

    private advance(): Token {
        return this.tokens[this.pos++];
    }

    private expect(type: TokenType): Token {
        if (this.current().type !== type) {
            throw createParseError(
                `Expected ${type} but got ${this.current().type}`,
                this.originalInput,
                this.current().position
            );
        }
        return this.advance();
    }

    private parseFormula(): ASTNode {
        return this.parseIff();
    }

    private parseIff(): ASTNode {
        let left = this.parseImplies();

        while (this.current().type === 'IFF') {
            this.advance();
            const right = this.parseImplies();
            left = { type: 'iff', left, right };
        }

        return left;
    }

    private parseImplies(): ASTNode {
        let left = this.parseDisjunction();

        if (this.current().type === 'IMPLIES') {
            this.advance();
            const right = this.parseImplies(); // Right associative
            return { type: 'implies', left, right };
        }

        return left;
    }

    private parseDisjunction(): ASTNode {
        let left = this.parseConjunction();

        while (this.current().type === 'OR') {
            this.advance();
            const right = this.parseConjunction();
            left = { type: 'or', left, right };
        }

        return left;
    }

    private parseConjunction(): ASTNode {
        let left = this.parseUnary();

        while (this.current().type === 'AND') {
            this.advance();
            const right = this.parseUnary();
            left = { type: 'and', left, right };
        }

        return left;
    }

    private parseUnary(): ASTNode {
        if (this.current().type === 'NOT') {
            this.advance();
            const operand = this.parseUnary();
            return { type: 'not', operand };
        }

        return this.parseQuantified();
    }

    private parseQuantified(): ASTNode {
        if (this.current().type === 'QUANTIFIER') {
            const quantifier = this.advance().value;
            const varToken = this.expect('VARIABLE');
            const variable = varToken.value;

            this.boundVariables.add(variable);

            // Parse the body - must be in parentheses after quantifier
            const body = this.parseUnary();

            return {
                type: quantifier === 'all' ? 'forall' : 'exists',
                variable,
                body
            };
        }

        return this.parseAtom();
    }

    private parseAtom(): ASTNode {
        // Parenthesized formula
        if (this.current().type === 'LPAREN') {
            this.advance();
            const formula = this.parseFormula();
            this.expect('RPAREN');
            return formula;
        }

        // Must be a predicate or equality
        if (this.current().type === 'VARIABLE') {
            const name = this.advance().value;

            // Check if it's a predicate call
            if (this.current().type === 'LPAREN') {
                this.advance();
                const args = this.parseTermList();
                this.expect('RPAREN');

                // Check for equality
                if (this.current().type === 'EQUALS') {
                    this.advance();
                    const right = this.parseTerm();
                    return {
                        type: 'equals',
                        left: { type: 'function', name, args },
                        right
                    };
                }

                return { type: 'predicate', name, args };
            }

            // Could be an equality like x = y
            if (this.current().type === 'EQUALS') {
                this.advance();
                const right = this.parseTerm();
                return {
                    type: 'equals',
                    left: this.classifyTerm(name),
                    right
                };
            }

            // Bare predicate without args (propositional)
            return { type: 'predicate', name, args: [] };
        }

        throw createParseError(
            `Unexpected token '${this.current().value}'`,
            this.originalInput,
            this.current().position
        );
    }

    private parseTermList(): ASTNode[] {
        const terms: ASTNode[] = [];

        if (this.current().type !== 'RPAREN') {
            terms.push(this.parseTerm());

            while (this.current().type === 'COMMA') {
                this.advance();
                terms.push(this.parseTerm());
            }
        }

        return terms;
    }

    private parseTerm(): ASTNode {
        if (this.current().type !== 'VARIABLE') {
            throw createParseError(
                `Expected term but got ${this.current().type}`,
                this.originalInput,
                this.current().position
            );
        }

        const name = this.advance().value;

        // Function application
        if (this.current().type === 'LPAREN') {
            this.advance();
            const args = this.parseTermList();
            this.expect('RPAREN');
            return { type: 'function', name, args };
        }

        return this.classifyTerm(name);
    }

    private classifyTerm(name: string): ASTNode {
        // 1. If it's a bound variable, return variable
        if (this.boundVariables.has(name)) {
            return { type: 'variable', name };
        }

        // 2. Convention: Single lowercase letters (x, y, z, a, b...) are treated as free variables
        // This follows Prover9/Mace4 convention where free variables are implicitly universal
        if (name.length === 1 && /[a-z]/.test(name)) {
            return { type: 'variable', name };
        }

        // 3. Otherwise it's a constant (e.g., "socrates", "zero", "sk0")
        return { type: 'constant', name };
    }
}

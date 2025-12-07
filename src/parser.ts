/**
 * First-Order Logic Parser
 * 
 * Tokenizes and parses FOL formulas in Prover9-style syntax.
 * Supports: all, exists, ->, <->, &, |, -, =, predicates, functions, variables
 */

// Token types
export type TokenType =
    | 'QUANTIFIER'    // all, exists
    | 'VARIABLE'      // x, y, z (lowercase starting)
    | 'CONSTANT'      // socrates, a, b (lowercase in predicate args)
    | 'PREDICATE'     // man, mortal (lowercase with parens)
    | 'FUNCTION'      // f, g (lowercase with parens, nested in predicate)
    | 'IMPLIES'       // ->
    | 'IFF'           // <->
    | 'AND'           // &
    | 'OR'            // |
    | 'NOT'           // -
    | 'EQUALS'        // =
    | 'LPAREN'        // (
    | 'RPAREN'        // )
    | 'COMMA'         // ,
    | 'DOT'           // .
    | 'EOF';

export interface Token {
    type: TokenType;
    value: string;
    position: number;
}

import type { ASTNode, ASTNodeType } from './types/index.js';

export type { ASTNode, ASTNodeType };

/**
 * Tokenizer for FOL formulas
 */
export class Tokenizer {
    private input: string;
    private pos: number = 0;
    private tokens: Token[] = [];

    constructor(input: string) {
        this.input = input.trim();
    }

    tokenize(): Token[] {
        while (this.pos < this.input.length) {
            this.skipWhitespace();
            if (this.pos >= this.input.length) break;

            const char = this.input[this.pos];

            // Two-character operators
            if (this.match('<->')) {
                this.addToken('IFF', '<->');
                continue;
            }
            if (this.match('->')) {
                this.addToken('IMPLIES', '->');
                continue;
            }

            // Single character tokens
            switch (char) {
                case '(': this.addToken('LPAREN', '('); this.pos++; continue;
                case ')': this.addToken('RPAREN', ')'); this.pos++; continue;
                case '&': this.addToken('AND', '&'); this.pos++; continue;
                case '|': this.addToken('OR', '|'); this.pos++; continue;
                case '-': this.addToken('NOT', '-'); this.pos++; continue;
                case '=': this.addToken('EQUALS', '='); this.pos++; continue;
                case ',': this.addToken('COMMA', ','); this.pos++; continue;
                case '.': this.addToken('DOT', '.'); this.pos++; continue;
            }

            // Identifiers (predicates, variables, quantifiers, constants)
            if (/[a-zA-Z_]/.test(char)) {
                const start = this.pos;
                while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
                    this.pos++;
                }
                const value = this.input.slice(start, this.pos);

                // Check for quantifiers
                if (value === 'all' || value === 'exists') {
                    this.tokens.push({ type: 'QUANTIFIER', value, position: start });
                } else {
                    // Will be classified as PREDICATE, VARIABLE, or CONSTANT during parsing
                    this.tokens.push({ type: 'VARIABLE', value, position: start });
                }
                continue;
            }

            throw new Error(`Unexpected character '${char}' at position ${this.pos}`);
        }

        this.tokens.push({ type: 'EOF', value: '', position: this.pos });
        return this.tokens;
    }

    private skipWhitespace(): void {
        while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
            this.pos++;
        }
    }

    private match(str: string): boolean {
        if (this.input.slice(this.pos, this.pos + str.length) === str) {
            this.pos += str.length;
            return true;
        }
        return false;
    }

    private addToken(type: TokenType, value: string): void {
        this.tokens.push({ type, value, position: this.pos - (value.length > 1 ? value.length : 0) });
    }
}

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
    private pos: number = 0;
    private boundVariables: Set<string> = new Set();

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    parse(): ASTNode {
        const result = this.parseFormula();
        if (this.current().type !== 'EOF' && this.current().type !== 'DOT') {
            throw new Error(`Unexpected token '${this.current().value}' at position ${this.current().position}`);
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
            throw new Error(`Expected ${type} but got ${this.current().type} at position ${this.current().position}`);
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
                        left: { type: 'predicate', name, args },
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

        throw new Error(`Unexpected token '${this.current().value}' at position ${this.current().position}`);
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
            throw new Error(`Expected term but got ${this.current().type} at position ${this.current().position}`);
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
        // 1. If it's in the scope of a quantifier binding this name, it's a variable
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

/**
 * Parse a FOL formula string into an AST
 */
export function parse(input: string): ASTNode {
    const tokenizer = new Tokenizer(input);
    const tokens = tokenizer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
}

/**
 * Pretty-print an AST back to FOL string
 */
export function astToString(node: ASTNode): string {
    switch (node.type) {
        case 'forall':
            return `all ${node.variable} (${astToString(node.body!)})`;
        case 'exists':
            return `exists ${node.variable} (${astToString(node.body!)})`;
        case 'implies':
            return `(${astToString(node.left!)} -> ${astToString(node.right!)})`;
        case 'iff':
            return `(${astToString(node.left!)} <-> ${astToString(node.right!)})`;
        case 'and':
            return `(${astToString(node.left!)} & ${astToString(node.right!)})`;
        case 'or':
            return `(${astToString(node.left!)} | ${astToString(node.right!)})`;
        case 'not':
            return `-${astToString(node.operand!)}`;
        case 'equals':
            return `${astToString(node.left!)} = ${astToString(node.right!)}`;
        case 'predicate':
            if (!node.args || node.args.length === 0) {
                return node.name!;
            }
            return `${node.name}(${node.args.map(astToString).join(', ')})`;
        case 'function':
            return `${node.name}(${node.args!.map(astToString).join(', ')})`;
        case 'variable':
        case 'constant':
            return node.name!;
        default:
            throw new Error(`Unknown node type: ${node.type}`);
    }
}

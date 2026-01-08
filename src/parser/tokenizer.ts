import type { Token, TokenType } from '../types/parser.js';
import { createParseError } from '../types/errors.js';

/**
 * Tokenizer for FOL formulas
 */
export class Tokenizer {
    private input: string;
    // Keep original input for error reporting
    private originalInput: string;
    private pos: number = 0;
    private tokens: Token[] = [];

    constructor(input: string) {
        this.originalInput = input;
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

            // Identifiers (predicates, variables, quantifiers, constants) and Numbers
            if (/[a-zA-Z0-9_]/.test(char)) {
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
                    // Numbers will be treated as constants by classifyTerm logic (not bound, not length=1&lowercase)
                    this.tokens.push({ type: 'VARIABLE', value, position: start });
                }
                continue;
            }

            throw createParseError(`Unexpected character '${char}'`, this.originalInput, this.pos);
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

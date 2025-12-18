import type { ASTNode } from '../types/index.js';
import { Tokenizer } from './tokenizer.js';
import { Parser } from './parser.js';

export { Tokenizer } from './tokenizer.js';
export { Parser } from './parser.js';

/**
 * Parse a FOL formula string into an AST
 */
export function parse(input: string): ASTNode {
    const tokenizer = new Tokenizer(input);
    const tokens = tokenizer.tokenize();
    const parser = new Parser(tokens, input);
    return parser.parse();
}

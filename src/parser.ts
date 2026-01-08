/**
 * First-Order Logic Parser
 * 
 * Tokenizes and parses FOL formulas in Prover9-style syntax.
 * Supports: all, exists, ->, <->, &, |, -, =, predicates, functions, variables
 */

import type { ASTNode, ASTNodeType } from './types/index.js';
import type { TokenType, Token } from './types/parser.js';
import { astToString } from './utils/ast.js';

export type { ASTNode, ASTNodeType, TokenType, Token };
export { astToString };
export * from './parser/index.js';

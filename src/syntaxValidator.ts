/**
 * Syntax Validator for FOL formulas
 * 
 * Validates formulas using the parser and provides linting/heuristics.
 */

import { parse } from './parser.js';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface FormulaResult extends ValidationResult {
    formula: string;
}

export interface ValidationReport {
    valid: boolean;
    formulaResults: FormulaResult[];
}

const QUANTIFIERS = new Set(['all', 'exists']);
const OPERATORS = new Set(['->', '<->', '&', '|', '-']);
const RESERVED = new Set([...QUANTIFIERS, 'true', 'false', 'end_of_list']);

/**
 * Syntax Validator for FOL formulas
 */
export class SyntaxValidator {
    private errors: string[] = [];
    private warnings: string[] = [];

    /**
     * Validate a single formula
     */
    validate(formula: string): ValidationResult {
        this.errors = [];
        this.warnings = [];

        // Remove trailing period for analysis
        const formulaClean = formula.replace(/\.$/, '').trim();

        // 1. Try actual parsing
        try {
            parse(formulaClean);
        } catch (e) {
            // Parser failed
            this.errors.push((e as Error).message);

            // Run heuristics to provide helpful hints as warnings
            this.runDiagnostics(formulaClean);

            return {
                valid: false,
                errors: [...this.errors],
                warnings: [...this.warnings]
            };
        }

        // 2. If valid, check style/conventions (linting)
        // Some lint checks might produce errors (e.g. reserved words)
        this.checkNaming(formulaClean);
        this.checkCommonMistakes(formulaClean);

        return {
            valid: this.errors.length === 0,
            errors: [...this.errors],
            warnings: [...this.warnings]
        };
    }

    /**
     * Run heuristic checks to explain errors
     */
    private runDiagnostics(formula: string): void {
        this.checkBalancedParens(formula);
        this.checkQuantifiers(formula);
        this.checkOperators(formula);
    }

    /**
     * Check for balanced parentheses
     */
    private checkBalancedParens(formula: string): void {
        const stack: number[] = [];

        for (let i = 0; i < formula.length; i++) {
            const char = formula[i];
            if (char === '(') {
                stack.push(i);
            } else if (char === ')') {
                if (stack.length === 0) {
                    this.warnings.push(`Unmatched closing parenthesis at position ${i}`);
                } else {
                    stack.pop();
                }
            }
        }

        if (stack.length > 0) {
            this.warnings.push(`Unmatched opening parenthesis at position ${stack[0]}`);
        }
    }

    /**
     * Check quantifier syntax
     */
    private checkQuantifiers(formula: string): void {
        for (const quantifier of QUANTIFIERS) {
            const pattern = new RegExp(`\\b${quantifier}\\s+(\\w+)`, 'g');
            let match;

            while ((match = pattern.exec(formula)) !== null) {
                const varName = match[1];
                const endPos = match.index + match[0].length;

                if (!/^[a-z]/.test(varName)) {
                    this.warnings.push(`Quantifier variable '${varName}' should start with lowercase`);
                }

                const remaining = formula.slice(endPos).trim();
                if (!remaining || remaining[0] !== '(') {
                    this.warnings.push(
                        `Quantifier '${quantifier} ${varName}' must be followed by a formula in parentheses`
                    );
                }
            }
        }
    }

    /**
     * Check operator usage
     */
    private checkOperators(formula: string): void {
        for (const op of ['&', '|']) {
            if (formula.includes(op + op)) {
                this.warnings.push(`Double operator '${op}${op}' found - did you mean to use it twice?`);
            }
        }

        const implCount = (formula.match(/->/g) || []).length;
        const parenCount = (formula.match(/\(/g) || []).length;
        if (implCount > 1 && parenCount === 0) {
            this.warnings.push(
                'Multiple implications without parentheses - consider adding parentheses for clarity'
            );
        }
    }

    /**
     * Check predicate/function naming conventions
     */
    private checkNaming(formula: string): void {
        const pattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
        let match;

        while ((match = pattern.exec(formula)) !== null) {
            const name = match[1];

            if (QUANTIFIERS.has(name)) continue;

            if (/^[A-Z]/.test(name)) {
                this.warnings.push(
                    `Predicate/function '${name}' starts with uppercase - consider using lowercase for consistency`
                );
            }

            if (RESERVED.has(name)) {
                this.errors.push(
                    `'${name}' is a reserved keyword and cannot be used as a predicate/function`
                );
            }
        }
    }

    /**
     * Check for common syntax mistakes
     */
    private checkCommonMistakes(formula: string): void {
        for (const op of ['->', '<->']) {
            const pattern = new RegExp(`\\w${op.replace(/[-<>]/g, '\\$&')}\\w`);
            if (pattern.test(formula)) {
                this.warnings.push(`Consider adding spaces around '${op}' for readability`);
            }
        }

        if (formula.includes('"') || formula.includes("'")) {
            this.warnings.push(
                'Strings in quotes are not standard in first-order logic - use predicates or constants instead'
            );
        }

        if (formula.includes('()')) {
            this.errors.push('Empty parentheses found - predicates and functions must have arguments');
        }
    }
}

/**
 * Validate a list of formulas
 */
export function validateFormulas(formulas: string[]): ValidationReport {
    const validator = new SyntaxValidator();
    const results: FormulaResult[] = [];
    let allValid = true;

    for (const formula of formulas) {
        const result = validator.validate(formula);
        results.push({
            formula,
            ...result
        });
        if (!result.valid) {
            allValid = false;
        }
    }

    return {
        valid: allValid,
        formulaResults: results
    };
}

/**
 * Get helpful error messages for common syntax errors
 */
export function getSyntaxHelp(errorType: string): string {
    const helpMessages: Record<string, string> = {
        quantifier: `
Quantifier syntax: all variable (formula) or exists variable (formula)
Examples:
  - all x (man(x) -> mortal(x))
  - exists y (happy(y) & wise(y))
`,
        implication: `
Implication syntax: premise -> conclusion
For multiple premises, use conjunction:
  - (premise1 & premise2) -> conclusion
  - all x ((p(x) & q(x)) -> r(x))
`,
        parentheses: `
Parentheses must be balanced. Common mistakes:
  - Missing closing: all x (p(x) -> q(x)
  - Extra closing: all x (p(x) -> q(x)))
  - Missing around quantifier scope: all x p(x) -> q(x)  [should be: all x (p(x) -> q(x))]
`
    };

    return helpMessages[errorType] || 'No specific help available';
}

/**
 * Syntax Validator for FOL formulas
 * 
 * Port of syntax_validator.py - validates formulas before processing.
 */

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

        this.checkBalancedParens(formulaClean);
        this.checkQuantifiers(formulaClean);
        this.checkOperators(formulaClean);
        this.checkNaming(formulaClean);
        this.checkCommonMistakes(formulaClean);

        return {
            valid: this.errors.length === 0,
            errors: [...this.errors],
            warnings: [...this.warnings]
        };
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
                    this.errors.push(`Unmatched closing parenthesis at position ${i}`);
                } else {
                    stack.pop();
                }
            }
        }

        if (stack.length > 0) {
            this.errors.push(`Unmatched opening parenthesis at position ${stack[0]}`);
        }
    }

    /**
     * Check quantifier syntax
     */
    private checkQuantifiers(formula: string): void {
        for (const quantifier of QUANTIFIERS) {
            // Find all occurrences of this quantifier
            const pattern = new RegExp(`\\b${quantifier}\\s+(\\w+)`, 'g');
            let match;

            while ((match = pattern.exec(formula)) !== null) {
                const varName = match[1];
                const endPos = match.index + match[0].length;

                // Check if variable follows lowercase convention
                if (!/^[a-z]/.test(varName)) {
                    this.warnings.push(`Quantifier variable '${varName}' should start with lowercase`);
                }

                // Check if there's a formula after the quantifier
                const remaining = formula.slice(endPos).trim();
                if (!remaining || remaining[0] !== '(') {
                    this.errors.push(
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
        // Check for double operators (likely mistakes)
        for (const op of ['&', '|']) {
            if (formula.includes(op + op)) {
                this.warnings.push(`Double operator '${op}${op}' found - did you mean to use it twice?`);
            }
        }

        // Check for implication chains without parentheses
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
        // Extract potential predicate/function names (word followed by opening paren)
        const pattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
        let match;

        while ((match = pattern.exec(formula)) !== null) {
            const name = match[1];

            // Skip quantifiers
            if (QUANTIFIERS.has(name)) {
                continue;
            }

            // Predicates should start with lowercase
            if (/^[A-Z]/.test(name)) {
                this.warnings.push(
                    `Predicate/function '${name}' starts with uppercase - consider using lowercase for consistency`
                );
            }

            // Check for reserved words
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
        // Missing spaces around operators
        for (const op of ['->', '<->']) {
            const pattern = new RegExp(`\\w${op.replace(/[-<>]/g, '\\$&')}\\w`);
            if (pattern.test(formula)) {
                this.warnings.push(`Consider adding spaces around '${op}' for readability`);
            }
        }

        // Unquoted strings
        if (formula.includes('"') || formula.includes("'")) {
            this.warnings.push(
                'Strings in quotes are not standard in first-order logic - use predicates or constants instead'
            );
        }

        // Empty parentheses
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

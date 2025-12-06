/**
 * Type declarations for logic-solver package
 * 
 * logic-solver is a MiniSat-based SAT solver compiled to JavaScript.
 * https://www.npmjs.com/package/logic-solver
 */

declare module 'logic-solver' {
    interface Solver {
        /**
         * Require a formula to be true.
         */
        require(formula: Formula): void;

        /**
         * Require a formula to be true if the condition is true.
         */
        require(formula: Formula, condition?: string): void;

        /**
         * Solve the constraints and return a solution, or null if unsatisfiable.
         */
        solve(): Solution | null;

        /**
         * Forbid the current solution and solve again.
         */
        forbid(solution: Solution): void;
    }

    interface Solution {
        /**
         * Get the assignment map from variable names to booleans.
         */
        getMap(): Record<string, boolean>;

        /**
         * Get the list of variables that are true.
         */
        getTrueVars(): string[];

        /**
         * Get the list of variables that are false.
         */
        getFalseVars(): string[];

        /**
         * Evaluate a formula in this solution.
         */
        evaluate(formula: Formula): boolean;
    }

    type Formula = string | FormulaObject;

    interface FormulaObject {
        type: string;
        operands?: Formula[];
    }

    interface Logic {
        /**
         * Create a new solver.
         */
        Solver: new () => Solver;

        /**
         * Create a disjunction (OR) formula.
         */
        or(...operands: Formula[]): Formula;

        /**
         * Create a conjunction (AND) formula.
         */
        and(...operands: Formula[]): Formula;

        /**
         * Create a negation (NOT) formula.
         */
        not(operand: Formula): Formula;

        /**
         * Create an implication formula.
         */
        implies(a: Formula, b: Formula): Formula;

        /**
         * Create an equivalence (IFF) formula.
         */
        equiv(a: Formula, b: Formula): Formula;

        /**
         * Create an XOR formula.
         */
        xor(...operands: Formula[]): Formula;

        /**
         * Create a formula requiring exactly N operands to be true.
         */
        exactlyOne(...operands: Formula[]): Formula;

        /**
         * Create a formula requiring at most N operands to be true.
         */
        atMostOne(...operands: Formula[]): Formula;

        /**
         * TRUE constant.
         */
        TRUE: Formula;

        /**
         * FALSE constant.
         */
        FALSE: Formula;
    }

    const Logic: Logic;
    export = Logic;
}

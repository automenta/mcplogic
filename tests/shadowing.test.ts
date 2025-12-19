import { parse } from '../src/parser/index.js';
import { astToString } from '../src/utils/ast-modules/index.js';
import { standardizeVariables } from '../src/utils/transform/index.js';

describe('Variable Standardization Shadowing', () => {
    test('handles variable shadowing correctly', () => {
        // all x (P(x) & all x Q(x) & R(x))
        // The last R(x) should bind to the OUTER x.
        const formula = 'all x (P(x) & (all x Q(x)) & R(x))';
        const ast = parse(formula);
        const standardized = standardizeVariables(ast);
        const result = astToString(standardized);

        // We expect something like: all _v0 (P(_v0) & (all _v1 Q(_v1)) & R(_v0))
        // The bug would produce:    all _v0 (P(_v0) & (all _v1 Q(_v1)) & R(x))  <-- R(x) not renamed!

        // Extract variables
        const matchOuter = result.match(/all (_v\d+)/);
        const outerVar = matchOuter ? matchOuter[1] : 'fail';

        expect(result).toContain(`P(${outerVar})`);
        expect(result).toContain(`R(${outerVar})`);

        // Inner variable should be different
        const parts = result.split('&');
        const innerPart = parts[1]; // (all _v1 Q(_v1))
        const matchInner = innerPart.match(/all (_v\d+)/);
        const innerVar = matchInner ? matchInner[1] : 'fail';

        expect(innerVar).not.toBe(outerVar);
        expect(innerPart).toContain(`Q(${innerVar})`);
    });
});

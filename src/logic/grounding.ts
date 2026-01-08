import type { ASTNode } from '../types/index.js';
import { cloneAST } from '../utils/ast-modules/index.js';

export interface GroundingOptions {
    domainSize: number;
}

export function groundFormula(ast: ASTNode, opts: GroundingOptions): ASTNode {
    return ground(ast, opts.domainSize, new Map());
}

function ground(node: ASTNode, n: number, bindings: Map<string, number>): ASTNode {
    switch (node.type) {
        case 'forall':
        case 'exists': {
            const varName = node.variable!;
            const op = node.type === 'forall' ? 'and' : 'or';
            let result: ASTNode | null = null;
            for (let i = 0; i < n; i++) {
                const b = new Map(bindings);
                b.set(varName, i);
                const inst = ground(node.body!, n, b);
                result = result ? { type: op, left: result, right: inst } : inst;
            }
            return result ?? { type: 'predicate', name: node.type === 'forall' ? '$true' : '$false' };
        }
        case 'variable': {
            const v = bindings.get(node.name!);
            return v !== undefined ? { type: 'constant', name: String(v) } : node;
        }
        case 'and': case 'or': case 'implies': case 'iff': case 'equals':
            return { type: node.type, left: ground(node.left!, n, bindings), right: ground(node.right!, n, bindings) };
        case 'not':
            return { type: 'not', operand: ground(node.operand!, n, bindings) };
        case 'predicate': case 'function':
            return { type: node.type, name: node.name, args: (node.args || []).map(a => ground(a, n, bindings)) };
        default:
            return cloneAST(node);
    }
}

export function generateArithmeticFacts(n: number): ASTNode[] {
    const facts: ASTNode[] = [];
    for (let x = 0; x < n; x++) {
        for (let y = 0; y < n; y++) {
            if (x < y) facts.push({ type: 'predicate', name: 'less', args: [{ type: 'constant', name: String(x) }, { type: 'constant', name: String(y) }] });
            if (x + y < n) facts.push({ type: 'predicate', name: 'plus', args: [{ type: 'constant', name: String(x) }, { type: 'constant', name: String(y) }, { type: 'constant', name: String(x + y) }] });
            if (x * y < n) facts.push({ type: 'predicate', name: 'times', args: [{ type: 'constant', name: String(x) }, { type: 'constant', name: String(y) }, { type: 'constant', name: String(x * y) }] });
        }
    }
    return facts;
}

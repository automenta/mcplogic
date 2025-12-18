import { ASTNode } from '../../types/index.js';

export function createAnd(left: ASTNode, right: ASTNode): ASTNode {
    return { type: 'and', left, right };
}

export function createOr(left: ASTNode, right: ASTNode): ASTNode {
    return { type: 'or', left, right };
}

export function createNot(operand: ASTNode): ASTNode {
    return { type: 'not', operand };
}

export function createImplies(left: ASTNode, right: ASTNode): ASTNode {
    return { type: 'implies', left, right };
}

export function createIff(left: ASTNode, right: ASTNode): ASTNode {
    return { type: 'iff', left, right };
}

export function createForAll(variable: string, body: ASTNode): ASTNode {
    return { type: 'forall', variable, body };
}

export function createExists(variable: string, body: ASTNode): ASTNode {
    return { type: 'exists', variable, body };
}

export function createPredicate(name: string, args: ASTNode[] = []): ASTNode {
    return { type: 'predicate', name, args };
}

export function createEquals(left: ASTNode, right: ASTNode): ASTNode {
    return { type: 'equals', left, right };
}

export function createVariable(name: string): ASTNode {
    return { type: 'variable', name };
}

export function createConstant(name: string): ASTNode {
    return { type: 'constant', name };
}

export function createFunction(name: string, args: ASTNode[] = []): ASTNode {
    return { type: 'function', name, args };
}

/**
 * Tests for structured error system
 */

import {
    LogicErrorCode,
    LogicError,
    LogicException,
    getSuggestion,
    createParseError,
    createInferenceLimitError,
    createNoModelError,
    createSessionNotFoundError,
    createSessionLimitError,
    createEngineError,
    serializeLogicError,
} from '../src/types/errors.js';

describe('LogicException', () => {
    test('creates exception with error object', () => {
        const error: LogicError = {
            code: 'PARSE_ERROR',
            message: 'Unexpected token',
            span: { start: 5, end: 6, line: 1, col: 6 },
            suggestion: 'Check your syntax',
            context: 'P(x ->'
        };

        const exception = new LogicException(error);

        expect(exception.name).toBe('LogicException');
        expect(exception.message).toBe('Unexpected token');
        expect(exception.error).toEqual(error);
    });

    test('toJSON returns error object', () => {
        const error: LogicError = {
            code: 'ENGINE_ERROR',
            message: 'Prolog error',
        };

        const exception = new LogicException(error);
        expect(exception.toJSON()).toEqual(error);
    });
});

describe('getSuggestion', () => {
    test('suggests for missing closing paren', () => {
        const suggestion = getSuggestion('P(x');
        expect(suggestion).toContain('missing closing');
    });

    test('suggests for uppercase All', () => {
        const suggestion = getSuggestion('All x (P(x))');
        expect(suggestion).toContain('lowercase');
    });

    test('suggests for uppercase Exists', () => {
        const suggestion = getSuggestion('Exists x (P(x))');
        expect(suggestion).toContain('lowercase');
    });

    test('suggests for incomplete implication', () => {
        const suggestion = getSuggestion('P(x) ->');
        expect(suggestion).toContain('missing consequent');
    });

    test('suggests for incomplete conjunction', () => {
        const suggestion = getSuggestion('P(x) &');
        expect(suggestion).toContain('missing');
    });

    test('returns undefined for valid syntax', () => {
        const suggestion = getSuggestion('all x (P(x) -> Q(x))');
        expect(suggestion).toBeUndefined();
    });
});

describe('createParseError', () => {
    test('creates error with span info', () => {
        const exception = createParseError('Unexpected token', 'P(x', 3);

        expect(exception.error.code).toBe('PARSE_ERROR');
        expect(exception.error.span).toBeDefined();
        expect(exception.error.span?.start).toBe(3);
        expect(exception.error.context).toBe('P(x');
    });

    test('includes suggestion when pattern matches', () => {
        const exception = createParseError('Unexpected end', 'P(x', 3);

        expect(exception.error.suggestion).toBeDefined();
        expect(exception.error.suggestion).toContain('missing closing');
    });
});

describe('createInferenceLimitError', () => {
    test('creates error with limit info', () => {
        const exception = createInferenceLimitError(1000, 'mortal(socrates)');

        expect(exception.error.code).toBe('INFERENCE_LIMIT');
        expect(exception.error.message).toContain('1000');
        expect(exception.error.details?.limit).toBe(1000);
        expect(exception.error.context).toBe('mortal(socrates)');
    });

    test('includes suggestion to increase limit', () => {
        const exception = createInferenceLimitError(500);

        expect(exception.error.suggestion).toContain('inference_limit');
    });
});

describe('createNoModelError', () => {
    test('creates error with search info', () => {
        const exception = createNoModelError(10, [2, 3, 4, 5, 6, 7, 8, 9, 10]);

        expect(exception.error.code).toBe('NO_MODEL');
        expect(exception.error.message).toContain('10');
        expect(exception.error.details?.maxDomainSize).toBe(10);
        expect(exception.error.details?.searchedSizes).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
});

describe('createSessionNotFoundError', () => {
    test('creates error with session id', () => {
        const exception = createSessionNotFoundError('abc-123');

        expect(exception.error.code).toBe('SESSION_NOT_FOUND');
        expect(exception.error.message).toContain('abc-123');
        expect(exception.error.suggestion).toContain('create-session');
    });
});

describe('createSessionLimitError', () => {
    test('creates error with max sessions', () => {
        const exception = createSessionLimitError(1000);

        expect(exception.error.code).toBe('SESSION_LIMIT');
        expect(exception.error.message).toContain('1000');
    });
});

describe('createEngineError', () => {
    test('creates error with message', () => {
        const exception = createEngineError('syntax_error', { term: 'foo' });

        expect(exception.error.code).toBe('ENGINE_ERROR');
        expect(exception.error.message).toContain('syntax_error');
        expect(exception.error.details).toEqual({ term: 'foo' });
    });
});

describe('serializeLogicError', () => {
    test('serializes full error', () => {
        const error: LogicError = {
            code: 'PARSE_ERROR',
            message: 'Error',
            span: { start: 0, end: 1 },
            suggestion: 'Fix it',
            context: 'bad',
            details: { foo: 'bar' },
        };

        const serialized = serializeLogicError(error);

        expect(serialized).toEqual({
            code: 'PARSE_ERROR',
            message: 'Error',
            span: { start: 0, end: 1 },
            suggestion: 'Fix it',
            context: 'bad',
            details: { foo: 'bar' },
        });
    });

    test('omits undefined fields', () => {
        const error: LogicError = {
            code: 'TIMEOUT',
            message: 'Timed out',
        };

        const serialized = serializeLogicError(error);

        expect(serialized).toEqual({
            code: 'TIMEOUT',
            message: 'Timed out',
        });
        expect('span' in serialized).toBe(false);
        expect('suggestion' in serialized).toBe(false);
    });
});

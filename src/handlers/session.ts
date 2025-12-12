import {
    Verbosity,
    SessionInfo,
    PremiseAssertResponse,
    PremiseRetractResponse,
    SessionListResponse,
    SessionClearResponse,
    SessionDeleteResponse,
} from '../types/index.js';
import { validateFormulas } from '../syntaxValidator.js';
import { SessionManager } from '../sessionManager.js';
import { EngineManager } from '../engines/manager.js';
import { buildProveResponse } from './core.js';

export function createSessionHandler(
    args: { ttl_minutes?: number },
    sessionManager: SessionManager
): SessionInfo {
    const { ttl_minutes } = args;
    const ttlMs = ttl_minutes
        ? Math.min(ttl_minutes, 1440) * 60 * 1000  // Max 24 hours
        : undefined;

    const session = sessionManager.create({ ttlMs });
    const info = sessionManager.getInfo(session.id);

    return {
        session_id: session.id,
        created_at: new Date(info.createdAt).toISOString(),
        expires_at: new Date(info.expiresAt).toISOString(),
        ttl_minutes: Math.round(info.ttlMs / 60000),
        active_sessions: sessionManager.count,
    };
}

export function assertPremiseHandler(
    args: {
        session_id: string;
        formula: string;
    },
    sessionManager: SessionManager
): PremiseAssertResponse {
    const { session_id, formula } = args;

    // Validate formula syntax first
    const validation = validateFormulas([formula]);
    if (!validation.valid) {
        return {
            success: false,
            session_id,
            premise_count: sessionManager.get(session_id)?.premises.length ?? 0,
            formula_added: '',
            result: 'syntax_error',
            validation,
        };
    }

    const session = sessionManager.assertPremise(session_id, formula);
    return {
        success: true,
        session_id: session.id,
        premise_count: session.premises.length,
        formula_added: formula,
    };
}

export async function querySessionHandler(
    args: {
        session_id: string;
        goal: string;
        inference_limit?: number;
    },
    sessionManager: SessionManager,
    engineManager: EngineManager,
    verbosity: Verbosity
): Promise<object> {
    const { session_id, goal } = args;

    // Validate goal syntax
    const validation = validateFormulas([goal]);
    if (!validation.valid) {
        return {
            success: false,
            result: 'syntax_error',
            validation
        };
    }

    const session = sessionManager.get(session_id);

    // Use engineManager for consistent engine selection
    const proveResult = await engineManager.prove(session.premises, goal, { verbosity });
    return {
        session_id: session.id,
        premise_count: session.premises.length,
        ...buildProveResponse(proveResult, verbosity),
    };
}

export function retractPremiseHandler(
    args: {
        session_id: string;
        formula: string;
    },
    sessionManager: SessionManager
): PremiseRetractResponse {
    const { session_id, formula } = args;

    const removed = sessionManager.retractPremise(session_id, formula);
    const session = sessionManager.get(session_id);

    return {
        success: removed,
        session_id: session.id,
        premise_count: session.premises.length,
        message: removed
            ? `Removed: ${formula}`
            : `Formula not found in session: ${formula}`,
    };
}

export function listPremisesHandler(
    args: { session_id: string },
    sessionManager: SessionManager,
    verbosity: Verbosity
): SessionListResponse {
    const { session_id } = args;

    const premises = sessionManager.listPremises(session_id);
    const info = sessionManager.getInfo(session_id);

    return {
        session_id,
        premise_count: premises.length,
        premises,
        ...(verbosity === 'detailed' && {
            created_at: new Date(info.createdAt).toISOString(),
            expires_at: new Date(info.expiresAt).toISOString(),
        }),
    };
}

export function clearSessionHandler(
    args: { session_id: string },
    sessionManager: SessionManager
): SessionClearResponse {
    const { session_id } = args;

    const session = sessionManager.clear(session_id);

    return {
        success: true,
        session_id: session.id,
        message: 'Session cleared',
        premise_count: 0,
    };
}

export function deleteSessionHandler(
    args: { session_id: string },
    sessionManager: SessionManager
): SessionDeleteResponse {
    const { session_id } = args;

    sessionManager.delete(session_id);

    return {
        success: true,
        message: `Session ${session_id} deleted`,
        active_sessions: sessionManager.count,
    };
}

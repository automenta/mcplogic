/**
 * Session Manager for MCPLogic
 * 
 * Provides session-based reasoning with persistent knowledge bases.
 * Sessions auto-expire after TTL and are garbage collected periodically.
 */

import { randomUUID } from 'crypto';
import { buildPrologProgram } from './translator.js';
import {
    createSessionNotFoundError,
    createSessionLimitError,
    LogicException
} from './types/errors.js';

/**
 * A reasoning session with accumulated premises
 */
export interface Session {
    id: string;
    premises: string[];          // Original FOL formulas
    prologProgram: string;       // Compiled Prolog program
    createdAt: number;
    lastAccessedAt: number;
    ttlMs: number;               // Time-to-live in milliseconds
}

/**
 * Session creation options
 */
export interface CreateSessionOptions {
    ttlMs?: number;              // Custom TTL (default: 30 minutes)
}

/**
 * Session Manager - handles session lifecycle and operations
 */
export class SessionManager {
    private sessions = new Map<string, Session>();
    private gcIntervalId: ReturnType<typeof setInterval> | null = null;

    /** GC runs every minute */
    private readonly gcIntervalMs = 60_000;

    /** Default session TTL: 30 minutes */
    private readonly defaultTtlMs = 30 * 60 * 1000;

    /** Maximum number of concurrent sessions */
    static readonly MAX_SESSIONS = 1000;

    constructor() {
        // Start garbage collection
        this.gcIntervalId = setInterval(() => this.gc(), this.gcIntervalMs);
    }

    /**
     * Create a new reasoning session
     */
    create(options?: CreateSessionOptions): Session {
        // Check session limit
        if (this.sessions.size >= SessionManager.MAX_SESSIONS) {
            throw createSessionLimitError(SessionManager.MAX_SESSIONS);
        }

        const now = Date.now();
        const session: Session = {
            id: randomUUID(),
            premises: [],
            prologProgram: '',
            createdAt: now,
            lastAccessedAt: now,
            ttlMs: options?.ttlMs ?? this.defaultTtlMs,
        };

        this.sessions.set(session.id, session);
        return session;
    }

    /**
     * Get a session by ID (updates lastAccessedAt)
     */
    get(id: string): Session {
        const session = this.sessions.get(id);
        if (!session) {
            throw createSessionNotFoundError(id);
        }
        session.lastAccessedAt = Date.now();
        return session;
    }

    /**
     * Check if a session exists
     */
    exists(id: string): boolean {
        return this.sessions.has(id);
    }

    /**
     * Delete a session
     */
    delete(id: string): boolean {
        if (!this.sessions.has(id)) {
            throw createSessionNotFoundError(id);
        }
        return this.sessions.delete(id);
    }

    /**
     * Assert a premise into a session's knowledge base
     */
    assertPremise(id: string, formula: string): Session {
        const session = this.get(id);
        session.premises.push(formula);
        session.prologProgram = buildPrologProgram(session.premises);
        return session;
    }

    /**
     * Retract a premise from a session's knowledge base
     * Returns true if the premise was found and removed
     */
    retractPremise(id: string, formula: string): boolean {
        const session = this.get(id);
        const index = session.premises.indexOf(formula);
        if (index === -1) {
            return false;
        }
        session.premises.splice(index, 1);
        session.prologProgram = buildPrologProgram(session.premises);
        return true;
    }

    /**
     * List all premises in a session
     */
    listPremises(id: string): string[] {
        const session = this.get(id);
        return [...session.premises];
    }

    /**
     * Clear all premises from a session (keeps session alive)
     */
    clear(id: string): Session {
        const session = this.get(id);
        session.premises = [];
        session.prologProgram = '';
        return session;
    }

    /**
     * Get session info without modifying lastAccessedAt
     */
    getInfo(id: string): {
        id: string;
        premiseCount: number;
        createdAt: number;
        lastAccessedAt: number;
        ttlMs: number;
        expiresAt: number;
    } {
        const session = this.sessions.get(id);
        if (!session) {
            throw createSessionNotFoundError(id);
        }
        return {
            id: session.id,
            premiseCount: session.premises.length,
            createdAt: session.createdAt,
            lastAccessedAt: session.lastAccessedAt,
            ttlMs: session.ttlMs,
            expiresAt: session.lastAccessedAt + session.ttlMs,
        };
    }

    /**
     * Get number of active sessions
     */
    get count(): number {
        return this.sessions.size;
    }

    /**
     * Garbage collect expired sessions
     */
    private gc(): void {
        const now = Date.now();
        for (const [id, session] of this.sessions) {
            if (now - session.lastAccessedAt > session.ttlMs) {
                this.sessions.delete(id);
            }
        }
    }

    /**
     * Stop the garbage collector (for cleanup)
     */
    stop(): void {
        if (this.gcIntervalId) {
            clearInterval(this.gcIntervalId);
            this.gcIntervalId = null;
        }
    }

    /**
     * Clear all sessions (for testing)
     */
    clearAll(): void {
        this.sessions.clear();
    }
}

/**
 * Create a new SessionManager instance
 */
export function createSessionManager(): SessionManager {
    return new SessionManager();
}

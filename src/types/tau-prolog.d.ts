/**
 * Type declarations for tau-prolog
 */
declare module 'tau-prolog' {
    export interface Session {
        consult(
            program: string,
            callbacks: {
                success: () => void;
                error: (err: unknown) => void;
            }
        ): void;

        query(
            goal: string,
            callbacks: {
                success: (goal: unknown) => void;
                error: (err: unknown) => void;
            }
        ): void;

        answer(callbacks: {
            success: (answer: Answer | null) => void;
            fail: () => void;
            error: (err: unknown) => void;
            limit: () => void;
        }): void;

        format_answer(answer: Answer): string;
    }

    export interface Answer {
        id: string;
        links: Record<string, unknown>;
    }

    export function create(limit?: number): Session;

    const pl: {
        create: typeof create;
        Session: Session;
    };

    export default pl;
}

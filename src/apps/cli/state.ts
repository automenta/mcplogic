import fs from 'fs/promises';
import path from 'path';
import { CoreMessage } from 'ai';

export interface AgentState {
    messages: CoreMessage[];
    memory: Record<string, any>;
    model: string;
}

const STATE_FILE = '.mcplogic-agent.json';

export class StateManager {
    private filepath: string;

    constructor() {
        this.filepath = path.resolve(process.cwd(), STATE_FILE);
    }

    async load(): Promise<AgentState> {
        try {
            const data = await fs.readFile(this.filepath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            return {
                messages: [],
                memory: {},
                model: 'gpt-4o'
            };
        }
    }

    async save(state: AgentState): Promise<void> {
        await fs.writeFile(this.filepath, JSON.stringify(state, null, 2), 'utf-8');
    }

    async clear(): Promise<void> {
        await fs.unlink(this.filepath).catch(() => {});
    }
}

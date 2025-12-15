
import { ReasoningAgent } from '../agent/core.js';
import { ReasonOptions } from '../types/agent.js';

export interface ReasonArgs {
    goal: string;
    premises?: string[];
    max_steps?: number;
    timeout?: number;
    verbose?: boolean;
}

export async function reasonHandler(args: ReasonArgs): Promise<object> {
    const options: ReasonOptions = {
        maxSteps: args.max_steps,
        timeout: args.timeout,
        verbose: args.verbose
    };

    const agent = new ReasoningAgent(options);
    const result = await agent.run(args.goal, args.premises ?? []);

    return result;
}

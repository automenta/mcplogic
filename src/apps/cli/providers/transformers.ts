// @ts-nocheck
import { pipeline, env } from '@xenova/transformers';
import path from 'path';

// Configure cache to be in the project folder to avoid permission issues
env.cacheDir = path.resolve(process.cwd(), '.models');
env.allowLocalModels = false; // Allow downloading from HF

export class TransformersLanguageModel {
    readonly specificationVersion = 'v1';
    readonly defaultObjectGenerationMode = 'json';
    readonly name = 'transformers-local';
    readonly provider = 'transformers';

    private modelId: string;
    private pipe: any;

    constructor(modelId: string = 'Xenova/Qwen1.5-0.5B-Chat') {
        this.modelId = modelId;
    }

    private async getPipeline() {
        if (!this.pipe) {
            console.log(`[LocalModel] Loading ${this.modelId}... (this may take a while first time)`);
            this.pipe = await pipeline('text-generation', this.modelId, {
                progress_callback: (data: any) => {
                    // Progress handling
                }
            });
            console.log('[LocalModel] Model loaded.');
        }
        return this.pipe;
    }

    async doGenerate(options: any): Promise<any> {
        const generator = await this.getPipeline();
        const prompt = this.formatPrompt(options);

        // Simple generation
        const output = await generator(prompt, {
            max_new_tokens: 512,
            temperature: options.temperature ?? 0.7,
            do_sample: true,
            return_full_text: false,
        });

        const generatedText = output[0].generated_text;
        const { text, toolCalls } = this.parseOutput(generatedText);

        return {
            text,
            toolCalls,
            finishReason: 'stop',
            usage: { promptTokens: prompt.length, completionTokens: generatedText.length },
            rawCall: { rawPrompt: prompt, rawSettings: {} }
        };
    }

    async doStream(options: any): Promise<any> {
        const generator = await this.getPipeline();
        const prompt = this.formatPrompt(options);

        let controller: any;
        const stream = new ReadableStream({
            start(c) { controller = c; }
        });

        // Start generation in background
        (async () => {
            try {
                // Generate full text then stream chunks (simulated streaming for stability)
                const output = await generator(prompt, {
                    max_new_tokens: 512,
                    temperature: options.temperature ?? 0.7,
                    do_sample: true,
                    return_full_text: false,
                });

                const generatedText = output[0].generated_text;
                const { text, toolCalls } = this.parseOutput(generatedText);

                if (text) {
                    controller.enqueue({ type: 'text-delta', textDelta: text });
                }

                if (toolCalls) {
                    for (const call of toolCalls) {
                        controller.enqueue({
                            type: 'tool-call',
                            toolCallId: call.toolCallId,
                            toolName: call.toolName,
                            args: call.args
                        });
                    }
                }

                controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { promptTokens: 0, completionTokens: 0 } });
                controller.close();

            } catch (err) {
                controller.error(err);
            }
        })();

        return {
            stream,
            rawCall: { rawPrompt: prompt, rawSettings: {} }
        };
    }

    private formatPrompt(options: any): string {
        // Simple ChatML formatting
        let prompt = '';

        // Inject tool instructions if tools are present
        const toolDefs = options.mode.type === 'regular' ? options.mode.tools : undefined;
        let systemPrompt = '';

        for (const msg of options.messages) {
            if (msg.role === 'system') {
                systemPrompt += msg.content + '\n';
            }
        }

        if (options.mode.type === 'object-json') {
             systemPrompt += `\nYou must output a valid JSON object matching this schema:\n${JSON.stringify(options.mode.schema)}\nOutput ONLY the JSON object.`;
        } else if (toolDefs && toolDefs.length > 0) {
            systemPrompt += `\nYou have access to the following tools:\n`;
            toolDefs.forEach((t: any) => {
                systemPrompt += `- ${t.name}: ${t.description}\n`;
            });
            systemPrompt += `\nTo use a tool, output exactly: [[call:tool_name(json_args)]]\nExample: [[call:prove({"premises":["..."],"conclusion":"..."})]]\n`;
        }

        prompt += `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;

        for (const msg of options.messages) {
            if (msg.role === 'user') {
                const content = Array.isArray(msg.content)
                    ? msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
                    : msg.content;
                prompt += `<|im_start|>user\n${content}<|im_end|>\n`;
            } else if (msg.role === 'assistant') {
                 const content = Array.isArray(msg.content)
                    ? msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
                    : msg.content;
                prompt += `<|im_start|>assistant\n${content}<|im_end|>\n`;
            }
        }
        prompt += `<|im_start|>assistant\n`;
        return prompt;
    }

    private parseOutput(output: string): { text: string; toolCalls?: Array<{ toolCallId: string; toolName: string; args: string }> } {
        const toolRegex = /\[\[call:([a-zA-Z0-9_]+)\((.*?)\)\]\]/g;
        const toolCalls: any[] = [];
        let text = output;

        let match;
        while ((match = toolRegex.exec(output)) !== null) {
            try {
                const argsString = match[2];
                toolCalls.push({
                    toolCallId: `call_${Math.random().toString(36).slice(2)}`,
                    toolName: match[1],
                    args: argsString
                });
                text = text.replace(match[0], '');
            } catch (e) {
                console.error('Failed to parse tool call:', match[0]);
            }
        }

        return { text: text.trim(), toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
    }
}

export function createTransformersModel(modelId?: string) {
    return new TransformersLanguageModel(modelId);
}

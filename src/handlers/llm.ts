import { HeuristicTranslator } from '../llm/translator.js';
import { TranslateRequest, TranslateResult } from '../types/llm.js';
import { parse } from '../parser.js';

const translator = new HeuristicTranslator();

export async function translateTextHandler(args: TranslateRequest): Promise<TranslateResult> {
    const result = await translator.translate(args.text);

    // Validation
    const errors: string[] = result.errors || [];
    const shouldValidate = args.validate ?? true;

    if (shouldValidate) {
        for (const p of result.premises) {
            try {
                parse(p);
            } catch (e) {
                errors.push(`Invalid premise generated: "${p}" - ${(e as Error).message}`);
            }
        }
        if (result.conclusion) {
            try {
                parse(result.conclusion);
            } catch (e) {
                errors.push(`Invalid conclusion generated: "${result.conclusion}" - ${(e as Error).message}`);
            }
        }
    }

    return {
        success: errors.length === 0,
        premises: result.premises,
        conclusion: result.conclusion,
        errors: errors.length > 0 ? errors : undefined
    };
}

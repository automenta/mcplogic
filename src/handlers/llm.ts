import { HeuristicTranslator } from '../llm/translator.js';
import { TranslateRequest, TranslateResult } from '../types/llm.js';
import { parse } from '../parser.js';
import { InputRouter } from '../evolution/index.js';

// Global router instance (should be injected)
let inputRouter: InputRouter | null = null;
const fallbackTranslator = new HeuristicTranslator();

export function setInputRouter(router: InputRouter) {
    inputRouter = router;
}

export async function translateTextHandler(args: TranslateRequest): Promise<TranslateResult> {
    const translator = inputRouter
        ? await inputRouter.getTranslator(args.text)
        : fallbackTranslator;

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

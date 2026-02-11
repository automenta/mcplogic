/**
 * Utilities for parsing LLM output into FOL formulas.
 */

export interface ParsedOutput {
    premises: string[];
    conclusion?: string;
}

/**
 * Parse raw LLM output to extract logical formulas.
 * Handles code blocks, conversational filler, and conclusion markers.
 */
export function parseLLMOutput(rawOutput: string): ParsedOutput {
    const codeBlockMatch = rawOutput.match(/```(?:prolog|logic|text)?\s*([\s\S]*?)```/);
    const contentToParse = codeBlockMatch ? codeBlockMatch[1] : rawOutput;

    const lines = contentToParse
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('%') && !l.startsWith('#') && !l.startsWith('//')); // comments

    const premises: string[] = [];
    let conclusion: string | undefined;

    for (const line of lines) {
        // Check for conclusion markers
        if (/^(conclusion:|prove:|goal:)\s*/i.test(line)) {
            conclusion = line.replace(/^(conclusion:|prove:|goal:)\s*/i, '');
            continue;
        }

        // Heuristic filtering for conversational lines if we didn't find a code block
        // If we found a code block, we assume the LLM put valid stuff in it.
        // If we are parsing raw text, we need to be careful.
        if (!codeBlockMatch) {
            // Skip lines that end with ':' (often headers like "Here is the logic:")
            if (line.endsWith(':')) continue;

            // Skip lines that look like sentences but don't have logic symbols or parens
            // (Very rough heuristic: must have '(', ')', '=', '->', '<->', '&', '|', 'all ', 'exists ', or be very short assignment)
            const hasLogicChars = /[()=&|<>]|all\s|exists\s/.test(line);

            // If it doesn't have logic chars, and has spaces (implies sentence), skip it.
            // Allows "P(a)" but skips "Sure thing."
            if (!hasLogicChars && line.includes(' ')) {
                continue;
            }
        }

        premises.push(line);
    }

    return {
        premises,
        conclusion
    };
}

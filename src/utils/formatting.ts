/**
 * Formatting utilities
 */
import type { Model } from '../types/index.js';

/**
 * Format model as human-readable string
 */
export function formatModel(model: Model): string {
    const lines: string[] = [];
    lines.push(`Domain size: ${model.domainSize}`);
    lines.push(`Domain: {${model.domain.join(', ')}}`);

    if (model.constants.size > 0) {
        lines.push('Constants:');
        for (const [name, value] of model.constants) {
            lines.push(`  ${name} = ${value}`);
        }
    }

    lines.push('Predicates:');
    for (const [name, extension] of model.predicates) {
        const tuples = Array.from(extension).map(s => `(${s})`).join(', ');
        lines.push(`  ${name}: {${tuples}}`);
    }

    return lines.join('\n');
}

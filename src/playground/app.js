/**
 * MCP Logic Playground App
 */
import { createLogicEngine, createModelFinder } from '/dist-browser/lib.js';

// DOM Elements
const inputEditor = document.getElementById('input-editor');
const outputLog = document.getElementById('output-log');
const btnProve = document.getElementById('btn-prove');
const btnModel = document.getElementById('btn-model');
const btnExample = document.getElementById('btn-example');
const btnAskAi = document.getElementById('btn-ask-ai');
const modalAi = document.getElementById('ai-modal');
const btnAiCancel = document.getElementById('btn-ai-cancel');
const btnAiConvert = document.getElementById('btn-ai-convert');
const inputAi = document.getElementById('ai-input');
const statusAi = document.getElementById('ai-status');

// State
let engine = createLogicEngine();
let modelFinder = createModelFinder();
let pipeline = null;

// Logging
function log(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `log-entry log-${type}`;
    el.textContent = msg;
    outputLog.appendChild(el);
    outputLog.scrollTop = outputLog.scrollHeight;
}

function clearLog() {
    outputLog.innerHTML = '';
}

// Logic Helpers
function getFormulas() {
    const text = inputEditor.value;
    return text.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('%') && !l.startsWith('#'));
}

// Event Listeners
btnProve.addEventListener('click', async () => {
    clearLog();
    const lines = getFormulas();
    if (lines.length === 0) {
        log('No input formulas.', 'error');
        return;
    }

    const premises = lines.slice(0, -1);
    const conclusion = lines[lines.length - 1];

    log(`Proving: ${conclusion}`);
    log(`From ${premises.length} premises...`);

    const start = performance.now();
    try {
        const result = await engine.prove(premises, conclusion, {
            includeTrace: true
        });
        const elapsed = (performance.now() - start).toFixed(1);

        if (result.success && result.result === 'proved') {
            log(`✓ PROVED (${elapsed}ms)`, 'success');
            if (result.inferenceSteps) {
                // log('Trace:\n' + result.inferenceSteps.join('\n'));
            }
        } else {
            log(`✗ NOT PROVED (${elapsed}ms): ${result.message || result.error}`, 'error');
        }
        console.log(result);
    } catch (e) {
        log(`Error: ${e.message}`, 'error');
        console.error(e);
    }
});

btnModel.addEventListener('click', async () => {
    clearLog();
    const lines = getFormulas();
    if (lines.length === 0) {
        log('No input formulas.', 'error');
        return;
    }

    log(`Finding model for ${lines.length} formulas...`);

    const start = performance.now();
    try {
        const result = await modelFinder.findModel(lines);
        const elapsed = (performance.now() - start).toFixed(1);

        if (result.success) {
            log(`✓ MODEL FOUND (${elapsed}ms)`, 'success');
            log(result.interpretation, 'model');
        } else {
            log(`✗ NO MODEL (${elapsed}ms): ${result.message || result.error}`, 'error');
        }
        console.log(result);
    } catch (e) {
        log(`Error: ${e.message}`, 'error');
        console.error(e);
    }
});

btnExample.addEventListener('click', () => {
    inputEditor.value = `% Dreadbury Mansion Mystery
lives(agatha)
lives(butler)
lives(charles)

% Relationships
all x all y (killed(x, y) -> (hates(x, y) & -richer(x, y)))
all x (lives(x) & -(x = agatha) -> hates(charles, x))
all x (lives(x) & -(x = butler) -> hates(agatha, x))
all x (lives(x) & -richer(x, agatha) -> hates(butler, x))
all x (hates(agatha, x) -> hates(butler, x))
all x -(all y (lives(y) -> hates(x, y)))
-(agatha = butler)

% Conclusion (Someone killed Agatha)
exists x (lives(x) & killed(x, agatha))
`;
});

// AI Features
btnAskAi.addEventListener('click', () => {
    modalAi.classList.remove('hidden');
    inputAi.focus();
});

btnAiCancel.addEventListener('click', () => {
    modalAi.classList.add('hidden');
});

btnAiConvert.addEventListener('click', async () => {
    const text = inputAi.value.trim();
    if (!text) return;

    statusAi.textContent = 'Loading AI model (this may take a while first time)...';
    btnAiConvert.disabled = true;

    try {
        if (!pipeline) {
            // Using a small generic text generation model for demo
            // In a real app, we would fine-tune or use a better prompt
            // FLAN-T5 is good at instruction following
            pipeline = await window.pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M');
        }

        statusAi.textContent = 'Translating...';

        const prompt = `Translate the following natural language to First-Order Logic formulas. Use standard syntax like "all x P(x)" and "P(x) & Q(x)".\n\nInput: ${text}\n\nOutput:\n`;

        const result = await pipeline(prompt, {
            max_new_tokens: 200,
            temperature: 0.1
        });

        let output = result[0].generated_text;
        console.log('AI Output:', output);

        // Basic cleanup of output
        output = output.replace(/Output:\s*/i, '').trim();

        inputEditor.value = `% Generated from: ${text}\n` + output;
        modalAi.classList.add('hidden');
        statusAi.textContent = '';
    } catch (e) {
        console.error(e);
        statusAi.textContent = 'Error: ' + e.message;
    } finally {
        btnAiConvert.disabled = false;
    }
});

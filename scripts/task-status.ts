#!/usr/bin/env tsx
/**
 * Extract task status from TODO.md
 * Usage: npm run tasks
 */
import { readFileSync } from 'fs';

const content = readFileSync('TODO.md', 'utf-8');
const lines = content.split('\n');

const tasks: { phase: string; name: string; done: boolean }[] = [];
let currentPhase = '';

for (const line of lines) {
    // Match phase headers like "## 🎯 Phase 1:"
    const phaseMatch = line.match(/^##\s+.*Phase\s+(\d+(?:\.\d+)?)/i);
    if (phaseMatch) {
        currentPhase = `Phase ${phaseMatch[1]}`;
    }

    // Match task headers like "### 1.1 High-Power Mode"
    const taskMatch = line.match(/^###\s+(\d+\.\d+)\s+(.+?)(?:\s+[⚡🔄🖥️📊📦🌐🎮🗣️🎲🗂️🤖🧬])?$/);
    if (taskMatch && currentPhase) {
        const name = `${taskMatch[1]} ${taskMatch[2].trim()}`;

        // Find if the task is done by looking ahead for the "Done When" section
        // Ideally we should track state, but for this simple script we can check
        // if ALL checkmarks in the section are checked, OR if we add a status tracker.

        // The plan says: "Check if there's a [x] in the following lines (done when section)"
        // But simply checking for any [x] might be misleading if there are multiple.
        // Let's assume a task is done if ALL its checkboxes are checked?
        // Or better, let's look for a manual status if present, or just default to not done.

        // Actually, the original plan logic was:
        // "Check if there's a [x] in the following lines (done when section)"
        // It didn't specify exactly how to associate.

        // Let's implement a simple state machine.
        tasks.push({ phase: currentPhase, name, done: false });
    }

    // If we are tracking a task, check for completion marks
    if (tasks.length > 0) {
        const currentTask = tasks[tasks.length - 1];
        // If we see a checked box "[x]" in what presumably is the "Done When" or acceptance criteria
        // we might mark it done?
        // But usually there are multiple checkboxes.
        // Let's rely on the user to mark the *Task Header* or maintain a status table?
        // The provided example logic was:
        // "if (line.includes('[x]') && tasks.length > 0) { // Mark previous task as having progress }"

        // Let's count checkboxes.
        // But wait, the prompt description says:
        // "Check if there's a [x] in the following lines (done when section)"

        // Let's simplify: If we find `[x]` after a task header, we mark it as "in progress" or "done"?
        // The prompt says "done when section".
        // Let's look for: `#### Done When` followed by checkboxes.
        // If all checkboxes in that section are `[x]`, then it's done.

        // Simplest implementation per instruction:
        // "Check for completed "Done When" checkboxes"
        // Let's just output the status as is.
    }
}

// Refined logic:
// A task is DONE if all check items under "Done When" are checked [x].
// We need to parse "Done When" blocks.

const detailedTasks: { phase: string; name: string; total: number; completed: number }[] = [];
currentPhase = '';
let currentTask: { phase: string; name: string; total: number; completed: number } | null = null;
let inDoneWhen = false;

for (const line of lines) {
    const phaseMatch = line.match(/^##\s+.*Phase\s+(\d+(?:\.\d+)?)/i);
    if (phaseMatch) {
        currentPhase = `Phase ${phaseMatch[1]}`;
        currentTask = null;
    }

    const taskMatch = line.match(/^###\s+(\d+\.\d+)\s+(.+?)(?:\s+[⚡🔄🖥️📊📦🌐🎮🗣️🎲🗂️🤖🧬])?$/);
    if (taskMatch && currentPhase) {
        if (currentTask) detailedTasks.push(currentTask);
        currentTask = {
            phase: currentPhase,
            name: `${taskMatch[1]} ${taskMatch[2].trim()}`,
            total: 0,
            completed: 0
        };
        inDoneWhen = false;
    }

    if (line.trim().startsWith('#### Done When')) {
        inDoneWhen = true;
    } else if (line.trim().startsWith('####')) {
        inDoneWhen = false;
    }

    if (currentTask && inDoneWhen) {
        if (line.includes('- [ ]')) {
            currentTask.total++;
        } else if (line.includes('- [x]')) {
            currentTask.total++;
            currentTask.completed++;
        }
    }
}
if (currentTask) detailedTasks.push(currentTask);

console.log('\n📋 Task Status\n');
console.log('| Phase | Task | Status | Progress |');
console.log('|-------|------|--------|----------|');
for (const t of detailedTasks) {
    const isDone = t.total > 0 && t.total === t.completed;
    const progress = t.total > 0 ? `${Math.round(t.completed / t.total * 100)}%` : '-';
    console.log(`| ${t.phase} | ${t.name} | ${isDone ? '✅' : '⬜'} | ${progress} |`);
}
console.log(`\nTotal: ${detailedTasks.length} tasks`);

#!/usr/bin/env node
/**
 * MCP Logic - Entry Point
 * 
 * CLI entry point for the MCP Logic server.
 */

import { runServer } from './server.js';

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
MCP Logic Server - First-order logic reasoning

Usage: mcp-logic [options]

Options:
  --help, -h     Show this help message
  --version, -v  Show version information

Core Tools:
  - prove              Prove statements using resolution
  - check-well-formed  Validate formula syntax
  - find-model         Find finite models satisfying premises
  - find-counterexample Find counterexamples to conclusions
  - verify-commutativity Generate categorical diagram verification
  - get-category-axioms Get axioms for category theory concepts

Session Tools:
  - create-session     Create a reasoning session
  - assert-premise     Add formula to session KB
  - query-session      Query session knowledge base
  - retract-premise    Remove formula from session
  - list-premises      List session premises
  - clear-session      Clear session premises
  - delete-session     Delete session

MCP Capabilities:
  - Resources: Browsable axiom libraries (category, group, peano, etc.)
  - Prompts: Reasoning templates (prove-by-contradiction, formalize, etc.)

The server communicates via stdio using the Model Context Protocol.
`);
        process.exit(0);
    }

    if (args.includes('--version') || args.includes('-v')) {
        console.log('mcp-logic version 1.1.0');
        process.exit(0);
    }

    try {
        await runServer();
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

main();

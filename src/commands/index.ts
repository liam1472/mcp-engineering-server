/**
 * MCP Command Registration
 * Defines all available /eng commands
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export function registerCommands(): Tool[] {
  return [
    // Lifecycle Commands
    {
      name: 'eng_init',
      description:
        'Initialize engineering workflow for the project. Auto-detects project type and creates .engineering/ directory structure.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Optional project name (defaults to directory name)',
          },
        },
      },
    },
    {
      name: 'eng_scan',
      description: 'Scan codebase and build indexes for functions, errors, constants, and dependencies.',
      inputSchema: {
        type: 'object',
        properties: {
          full: {
            type: 'boolean',
            description: 'Perform full rescan (default: incremental)',
            default: false,
          },
        },
      },
    },
    {
      name: 'eng_security',
      description:
        'Run security scan to detect secrets, credentials, API keys, and sensitive data in code.',
      inputSchema: {
        type: 'object',
        properties: {
          fix: {
            type: 'boolean',
            description: 'Attempt to suggest fixes for findings',
            default: false,
          },
        },
      },
    },
    {
      name: 'eng_start',
      description: 'Start working on a new feature. Creates feature directory and context.',
      inputSchema: {
        type: 'object',
        properties: {
          feature: {
            type: 'string',
            description: 'Name of the feature to start',
          },
        },
        required: ['feature'],
      },
    },
    {
      name: 'eng_validate',
      description: 'Run validation pipeline: build, lint, security scan, tests, duplicate detection.',
      inputSchema: {
        type: 'object',
        properties: {
          skipTests: {
            type: 'boolean',
            description: 'Skip test execution',
            default: false,
          },
        },
      },
    },
    {
      name: 'eng_done',
      description: 'Complete current feature. Runs final validation, extracts knowledge, archives feature.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    // Session Commands
    {
      name: 'eng_session_checkpoint',
      description: 'Save current session state as a checkpoint for later resumption.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Optional checkpoint name',
          },
        },
      },
    },
    {
      name: 'eng_session_resume',
      description: 'Resume from a previously saved checkpoint.',
      inputSchema: {
        type: 'object',
        properties: {
          checkpoint: {
            type: 'string',
            description: 'Checkpoint ID or name to resume from',
          },
        },
      },
    },

    // Index Commands
    {
      name: 'eng_search',
      description: 'Search through indexed functions, patterns, and knowledge base.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          type: {
            type: 'string',
            enum: ['function', 'error', 'pattern', 'all'],
            description: 'Type of search',
            default: 'all',
          },
        },
        required: ['query'],
      },
    },
  ];
}

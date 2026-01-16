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
      description:
        'Scan codebase and build indexes for functions, errors, constants, and dependencies.',
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
      description:
        'Run validation pipeline: build, lint, security scan, tests, duplicate detection.',
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
      description:
        'Complete current feature. Runs final validation, extracts knowledge, archives feature.',
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

    // Multi-Session Commands
    {
      name: 'eng_session_start',
      description: 'Start a named session (A, B, or C) for parallel development.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            enum: ['A', 'B', 'C'],
            description: 'Session identifier',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'eng_session_status',
      description: 'View status of all active sessions and their locked files.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'eng_session_switch',
      description: 'Switch to a different session.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            enum: ['A', 'B', 'C'],
            description: 'Session to switch to',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'eng_session_sync',
      description: 'Sync discoveries and check for conflicts with other sessions.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'eng_lock',
      description: 'Lock a file to prevent conflicts with other sessions.',
      inputSchema: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            description: 'File path to lock',
          },
        },
        required: ['file'],
      },
    },
    {
      name: 'eng_unlock',
      description: 'Unlock a previously locked file.',
      inputSchema: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            description: 'File path to unlock',
          },
        },
        required: ['file'],
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

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
            description: 'Auto-fix issues: create .env, update .gitignore, replace hardcoded secrets with process.env.XXX (creates .bak backups)',
            default: false,
          },
          dryRun: {
            type: 'boolean',
            description: 'Preview changes without applying (use with --fix to see what would be changed)',
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
    {
      name: 'eng_duplicates',
      description:
        'Detect duplicate code blocks across the codebase. Helps identify refactoring opportunities.',
      inputSchema: {
        type: 'object',
        properties: {
          minLines: {
            type: 'number',
            description: 'Minimum lines to consider as duplicate (default: 5)',
            default: 5,
          },
        },
      },
    },
    {
      name: 'eng_routes',
      description:
        'Index API routes for web projects (Express, Flask, FastAPI, ASP.NET, Go). Builds routes.yaml.',
      inputSchema: {
        type: 'object',
        properties: {
          framework: {
            type: 'string',
            enum: ['express', 'flask', 'fastapi', 'go', 'aspnet'],
            description: 'Framework to scan for (auto-detected if not specified)',
          },
        },
      },
    },
    {
      name: 'eng_hardware',
      description:
        'Index hardware configurations for embedded projects (STM32, ESP32, Arduino). Builds hardware.yaml.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'eng_knowledge',
      description:
        'Query the knowledge base for patterns, solutions, and learnings from completed features.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (omit to see stats)',
          },
        },
      },
    },

    // Validation & Analysis
    {
      name: 'eng_pipeline',
      description:
        'Run full validation pipeline: build, typecheck, lint, and test. Auto-detects commands for Node.js, Rust, Go, .NET, Python.',
      inputSchema: {
        type: 'object',
        properties: {
          skipBuild: {
            type: 'boolean',
            description: 'Skip build step',
            default: false,
          },
          skipTest: {
            type: 'boolean',
            description: 'Skip test step',
            default: false,
          },
          skipLint: {
            type: 'boolean',
            description: 'Skip lint step',
            default: false,
          },
          skipTypecheck: {
            type: 'boolean',
            description: 'Skip typecheck step',
            default: false,
          },
        },
      },
    },
    {
      name: 'eng_deps',
      description:
        'Analyze module dependencies and detect circular imports. Builds dependency graph showing imports, importedBy relationships.',
      inputSchema: {
        type: 'object',
        properties: {
          detectCircular: {
            type: 'boolean',
            description: 'Check for circular dependencies',
            default: true,
          },
        },
      },
    },
    {
      name: 'eng_refactor',
      description:
        'Analyze code for refactoring opportunities. Detects duplicate code, magic numbers, and long functions with actionable suggestions.',
      inputSchema: {
        type: 'object',
        properties: {
          fix: {
            type: 'boolean',
            description: 'Auto-fix issues: extract duplicates to functions, replace magic numbers with constants (creates .bak backups)',
            default: false,
          },
          dryRun: {
            type: 'boolean',
            description: 'Preview changes without applying (use with --fix to see what would be changed)',
            default: false,
          },
        },
      },
    },
    {
      name: 'eng_review',
      description:
        'Run pre-completion checklist. Validates security, build, tests, and duplicates before completing a feature.',
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
      name: 'eng_index_function',
      description:
        'Search indexed functions with optional filters. Shows function stats if no query provided.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Function name or pattern to search',
          },
          file: {
            type: 'string',
            description: 'Filter results by file path pattern',
          },
        },
      },
    },
    {
      name: 'eng_index_similar',
      description:
        'Find similar code snippets in the codebase. Input a code snippet to find matching patterns.',
      inputSchema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Code snippet to find similar matches for',
          },
        },
        required: ['code'],
      },
    },
  ];
}

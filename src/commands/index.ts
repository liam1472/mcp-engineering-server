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
            description:
              'Auto-fix issues: create .env, update .gitignore, replace hardcoded secrets with process.env.XXX (creates .bak backups)',
            default: false,
          },
          dryRun: {
            type: 'boolean',
            description:
              'Preview changes without applying (use with --fix to see what would be changed)',
            default: false,
          },
          force: {
            type: 'boolean',
            description:
              'Force apply changes even when >5 files would be modified (safety override)',
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
        properties: {
          promote: {
            type: 'boolean',
            description: 'Promote extracted knowledge to global knowledge base (~/.mcp-engineering/)',
            default: false,
          },
        },
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
            description:
              'Auto-fix issues: extract duplicates to functions, replace magic numbers with constants (creates .bak backups)',
            default: false,
          },
          dryRun: {
            type: 'boolean',
            description:
              'Preview changes without applying (use with --fix to see what would be changed)',
            default: false,
          },
          force: {
            type: 'boolean',
            description:
              'Force apply changes even when >5 files would be modified (safety override)',
            default: false,
          },
          learn: {
            type: 'boolean',
            description:
              'Learn from refactoring: extract anti-patterns and append as rules to manifesto.md',
            default: false,
          },
          clean: {
            type: 'boolean',
            description:
              'Detect and optionally delete garbage files (AI debug scripts, temp files, logs)',
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

    // Testing Commands
    {
      name: 'eng_test',
      description:
        'Run fast unit tests for TDD loop. Auto-detects test framework (vitest, jest, pytest, cargo, go). Use this frequently during development.',
      inputSchema: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            description: 'Target specific file for testing',
          },
          watch: {
            type: 'boolean',
            description: 'Enable watch mode for continuous testing',
            default: false,
          },
        },
      },
    },
    {
      name: 'eng_mutation',
      description:
        'Run mutation testing (SLOW) to verify test quality. Use only before completing a feature, not during TDD.',
      inputSchema: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            description: 'Target specific file for mutation testing',
          },
          threshold: {
            type: 'number',
            description: 'Minimum acceptable mutation score (default: 30)',
            default: 30,
          },
          mode: {
            type: 'string',
            enum: ['run', 'check', 'analyze'],
            description:
              'run: Full mutation test, check: Verify threshold, analyze: Testability analysis only',
            default: 'run',
          },
        },
      },
    },

    // Debugging Commands
    {
      name: 'eng_debug',
      description:
        'Analyze log files using streaming. Supports pattern filtering, tail, and handles large files efficiently.',
      inputSchema: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            description: 'Path to log file to analyze',
          },
          pattern: {
            type: 'string',
            description: 'Filter lines matching this pattern (supports regex)',
          },
          tail: {
            type: 'number',
            description: 'Number of lines to show from end (default: 100)',
            default: 100,
          },
          ignoreCase: {
            type: 'boolean',
            description: 'Case-insensitive pattern matching',
            default: false,
          },
        },
        required: ['file'],
      },
    },

    // Planning Commands
    {
      name: 'eng_plan',
      description:
        'Create a planning document for a feature. Injects related knowledge and manifesto rules.',
      inputSchema: {
        type: 'object',
        properties: {
          feature: {
            type: 'string',
            description: 'Name of the feature to plan (must exist via eng_start)',
          },
          injectKnowledge: {
            type: 'boolean',
            description: 'Search and inject related knowledge entries',
            default: true,
          },
          injectManifesto: {
            type: 'boolean',
            description: 'Inject manifesto rules into plan',
            default: true,
          },
          description: {
            type: 'string',
            description: 'Optional description of the feature objective',
          },
        },
        required: ['feature'],
      },
    },

    // Embedded Linux Commands
    {
      name: 'eng_dts',
      description:
        'Device Tree Specialist. Scan, validate, and analyze device tree (.dts/.dtsi) files for embedded Linux projects.',
      inputSchema: {
        type: 'object',
        properties: {
          scan: {
            type: 'boolean',
            description: 'Scan and index all .dts/.dtsi files',
            default: false,
          },
          check: {
            type: 'string',
            description: 'Validate node reference exists (e.g., "&i2c3")',
          },
          conflicts: {
            type: 'boolean',
            description: 'Detect pin muxing conflicts between enabled nodes',
            default: false,
          },
          available: {
            type: 'string',
            description: 'List available nodes of a type (e.g., "i2c", "spi", "uart")',
          },
        },
      },
    },

    // Architecture Commands
    {
      name: 'eng_arch',
      description:
        'Architecture Enforcer. Define and enforce architectural layer dependencies.',
      inputSchema: {
        type: 'object',
        properties: {
          init: {
            type: 'boolean',
            description: 'Create architecture.yaml template',
            default: false,
          },
          check: {
            type: 'boolean',
            description: 'Check for architecture violations',
            default: false,
          },
          enforce: {
            type: 'boolean',
            description: 'Enforce architecture rules (fail on violations)',
            default: false,
          },
        },
      },
    },
  ];
}

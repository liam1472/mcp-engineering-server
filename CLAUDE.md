# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Engineering Server is a Model Context Protocol (MCP) server that provides AI-assisted development workflow tools. It auto-detects project types (embedded, .NET, web, native, Python) and provides security scanning, function indexing, and session context preservation across Claude sessions.

**Core Goals:**
- Context preservation across Claude sessions via checkpoints
- Security-first: detect secrets before commit
- Universal project detection (20+ project types)
- Multi-session coordination (parallel Claude instances)

## Build & Development Commands

```bash
npm install         # Install dependencies (required first)
npm run build       # Compile TypeScript to dist/
npm run dev         # Watch mode compilation
npm run lint        # Run ESLint
npm run lint:fix    # Fix ESLint issues
npm test            # Run tests with Vitest
npm run clean       # Remove dist/
npm start           # Run the server (after build)
```

## Architecture

The server uses stdio transport and exposes MCP tools (`eng_*` commands):

```
src/
├── index.ts                    # MCP server entry point, tool dispatch
├── types/index.ts              # Zod schemas for all data types
├── core/
│   ├── project-detector.ts     # Auto-detect project type by file signatures
│   └── config.ts               # .engineering/config.yaml management
├── security/
│   └── scanner.ts              # Secret/credential detection with regex patterns
├── indexes/
│   └── function-indexer.ts     # Multi-language function extraction
├── sessions/
│   ├── context-manager.ts      # Session state & checkpoint management
│   └── coordinator.ts          # Multi-session locking & sync
├── features/
│   └── manager.ts              # Feature lifecycle (start/done/archive)
└── commands/
    └── index.ts                # MCP tool definitions
```

## Key Patterns

**Type System**: All data structures use Zod schemas (`*Schema` exports) with inferred TypeScript types. Schemas are in `src/types/index.ts`.

**Project Detection**: `ProjectDetector` uses priority-based rules matching file patterns (e.g., `*.ioc` for STM32, `Cargo.toml` for Rust). Higher priority wins when multiple rules match.

**Security Patterns**: `SecurityScanner` uses regex patterns to detect API keys, tokens, private keys, and hardcoded credentials. Patterns target AWS, GCP, Azure, OpenAI, Anthropic, database URIs, and common secret formats.

**Function Indexing**: `FunctionIndexer` parses source files with language-specific regex patterns for TypeScript, Python, C#, Go, Rust, and C/C++.

**Configuration Storage**: All workflow data lives in `.engineering/` directory with YAML files for config, indexes, sessions, and security findings.

## TypeScript Configuration

Strict mode enabled with additional flags:
- `noUncheckedIndexedAccess` - array/object access returns `T | undefined`
- `exactOptionalPropertyTypes` - distinguishes `undefined` from missing
- `noPropertyAccessFromIndexSignature` - requires bracket notation for index signatures

ESM modules with `NodeNext` resolution - all imports require `.js` extension.

## MCP Tools & Workflow

**Lifecycle flow:** `init` → `scan` → `start <feature>` → `validate` → `done`

### Core Commands
- `eng_init` - Initialize project, auto-detect type, create `.engineering/`
- `eng_scan` - Build function index
- `eng_security` - Scan for secrets (critical issues block `eng_done`)
- `eng_start` - Start feature, create context directory
- `eng_validate` - Run security + index + feature status check
- `eng_done` - Archive feature (requires passing security scan)
- `eng_search` - Search indexed functions

### Session Commands
- `eng_session_checkpoint` - Save session state
- `eng_session_resume` - Restore from checkpoint (or list available)

### Multi-Session Commands (parallel Claude instances)
- `eng_session_start` - Start session A, B, or C
- `eng_session_status` - View all sessions and file locks
- `eng_session_switch` - Switch active session
- `eng_session_sync` - See discoveries from other sessions
- `eng_lock` / `eng_unlock` - File-level locking

## Generated Directory Structure

When `eng_init` runs, it creates `.engineering/` with:
```
.engineering/
├── config.yaml           # Project config (type, settings)
├── index/                # Code indexes (functions.yaml, errors.yaml, etc.)
├── sessions/             # Session state & checkpoints
├── security/             # Patterns, whitelist, scan results
├── knowledge/            # Accumulated patterns, solutions, bugs
├── features/             # Active feature contexts
└── archive/              # Completed features
```

**Important:** Add `.engineering/sessions/` to `.gitignore` - session data is local only.

## Git Commit Rules

- Use conventional commits format: `feat:`, `fix:`, `docs:`, `refactor:`, etc.
- **NEVER** add `Co-Authored-By: Claude` or any AI attribution to commit messages
- Keep commit messages concise and descriptive

## Implementation Status

All core commands implemented and functional:
- [x] Phase 1: `eng_init`, `eng_scan`, `eng_security`
- [x] Phase 2: `eng_start`, `eng_validate`, `eng_done`, checkpoints
- [x] Phase 3: Multi-session coordination (locks, sync)

**Not yet implemented:**
- Duplicate code detection
- Project-specific indexes (hardware.yaml, routes.yaml, etc.)
- Knowledge extraction on `eng_done`

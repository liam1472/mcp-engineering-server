# MCP Engineering Server

An MCP (Model Context Protocol) server and Claude Code plugin for AI-assisted engineering workflows.

## Features

- **Auto-detect project type**: Supports 20+ project types (Node.js, .NET, Python, Rust, Go, Embedded, etc.)
- **Security scanning**: Detect secrets, API keys, and credentials before commit
- **Function indexing**: Index and search functions across TypeScript, Python, C#, Go, Rust, C/C++
- **Duplicate detection**: Find duplicate code blocks for refactoring
- **Route indexing**: Index API routes (Express, Flask, FastAPI, ASP.NET, Go)
- **Hardware indexing**: Index embedded hardware configs (STM32, ESP32, Arduino)
- **Knowledge base**: Extract and query learnings from completed features
- **Session management**: Checkpoints for context preservation across Claude sessions
- **Multi-session coordination**: Parallel Claude instances with file locking

## Installation

### Option 1: Claude Code Plugin (Recommended)

```bash
claude plugin install mcp-engineering-server
```

That's it! All slash commands and MCP tools are automatically available.

### Option 2: Manual MCP Setup

```bash
# Install globally
npm install -g mcp-engineering-server

# Add to Claude Code
claude mcp add engineering -- mcp-engineering-server
```

### Option 3: From Source

```bash
git clone https://github.com/liam1472/mcp-engineering-server.git
cd mcp-engineering-server
npm install && npm run build

# Add to Claude Code
claude mcp add engineering -- node "/path/to/mcp-engineering-server/dist/index.js"
```

## Slash Commands

### Core Workflow

| Command | Description |
|---------|-------------|
| `/eng-init` | Initialize project, auto-detect type |
| `/eng-scan` | Build function index |
| `/eng-security` | Scan for secrets and credentials |
| `/eng-security --fix` | Auto-fix: create .env, replace secrets, backup files |
| `/eng-security --fix --dry-run` | Preview what --fix would change |
| `/eng-start <feature>` | Start working on a feature |
| `/eng-validate` | Run validation pipeline |
| `/eng-done` | Complete and archive feature |
| `/eng-search <query>` | Search indexed functions |

### Analysis & Refactoring

| Command | Description |
|---------|-------------|
| `/eng-refactor` | Analyze code for refactoring opportunities |
| `/eng-refactor --fix` | Auto-fix: add constants, backup files |
| `/eng-refactor --fix --dry-run` | Preview what --fix would change |
| `/eng-review` | Pre-completion checklist (security, build, tests) |
| `/eng-deps` | Analyze dependencies, detect circular imports |
| `/eng-pipeline` | Run full validation pipeline (build, lint, test) |
| `/eng-duplicates` | Detect duplicate code blocks |

### Indexing

| Command | Description |
|---------|-------------|
| `/eng-index-function [query]` | Search indexed functions |
| `/eng-index-similar <code>` | Find similar code snippets |
| `/eng-routes` | Index API routes (web projects) |
| `/eng-hardware` | Index hardware configs (embedded) |
| `/eng-knowledge [query]` | Query knowledge base |

### Session Management

| Command | Description |
|---------|-------------|
| `/eng-checkpoint` | Save session checkpoint |
| `/eng-resume` | Resume from checkpoint |
| `/eng-session-start <A\|B\|C>` | Start parallel session |
| `/eng-session-status` | View active sessions |
| `/eng-session-switch <A\|B\|C>` | Switch between sessions |
| `/eng-session-sync` | Sync discoveries between sessions |
| `/eng-lock <file>` | Lock file for editing |
| `/eng-unlock <file>` | Unlock file |

## Workflow

```
/eng-init              # Initialize project
    ↓
/eng-scan              # Index codebase
    ↓
/eng-start feature     # Start feature
    ↓
  ... work ...
    ↓
/eng-validate          # Check security & index
    ↓
/eng-done              # Archive feature + extract knowledge
```

## Generated Structure

After running `/eng-init`, a `.engineering/` directory is created:

```
.engineering/
├── config.yaml           # Project config
├── index/
│   ├── functions.yaml    # Function index
│   ├── routes.yaml       # API routes (web)
│   ├── hardware.yaml     # Hardware configs (embedded)
│   └── duplicates.yaml   # Duplicate code report
├── sessions/             # Session data (gitignore this)
├── security/
│   ├── patterns.yaml     # Detection patterns
│   └── whitelist.yaml    # False positive whitelist
├── knowledge/
│   └── base.yaml         # Extracted learnings
├── features/             # Active features
└── archive/              # Completed features
```

## Supported Project Types

| Type | Detection |
|------|-----------|
| `web-node` | package.json |
| `web-react` | package.json + react |
| `web-vue` | package.json + vue |
| `web-angular` | angular.json |
| `dotnet-aspnet` | *.csproj + ASP.NET |
| `dotnet-maui` | *.csproj + MAUI |
| `python-django` | manage.py |
| `python-fastapi` | main.py + fastapi |
| `rust` | Cargo.toml |
| `go` | go.mod |
| `embedded-stm32` | *.ioc |
| `embedded-esp` | sdkconfig |
| `mobile-flutter` | pubspec.yaml |
| `mobile-react-native` | react-native in package.json |

## Security Patterns

The security scanner detects:

- AWS Access Keys & Secret Keys
- GCP API Keys
- Azure Storage Keys
- OpenAI / Anthropic API Keys
- JWT Tokens
- Database connection strings (MongoDB, PostgreSQL, MySQL)
- RSA/SSH Private Keys
- Hardcoded passwords

## Requirements

- Node.js >= 18.0.0
- Claude Code (VS Code extension or CLI)

## License

MIT

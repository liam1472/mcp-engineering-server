# MCP Engineering Server

An MCP (Model Context Protocol) server and Claude Code plugin for AI-assisted engineering workflows.

> **New to this tool?** See [USAGE.md](USAGE.md) for complete user manual with examples.

## Quick Start (TL;DR)

```bash
# Install
npm install -g mcp-engineering-server
mcp-engineering-server install

# In your project
/eng-init                        # Setup (once)
/eng-start my-feature            # Start work
/eng-plan my-feature             # Create plan
# ... code ...
/eng-security                    # Check secrets
/eng-test                        # Check tests
/eng-done                        # Complete
```

## Features

- **Auto-detect project type**: Supports 20+ project types (Node.js, .NET, Python, Rust, Go, Embedded, etc.)
- **Security scanning**: Detect secrets, API keys, and credentials with profile-based safety patterns
- **Mutation testing**: Verify test quality with multi-language mutation testing support
- **Function indexing**: Index and search functions across TypeScript, Python, C#, Go, Rust, C/C++
- **Duplicate detection**: Find duplicate code blocks for refactoring
- **Route indexing**: Index API routes (Express, Flask, FastAPI, ASP.NET, Go)
- **Hardware indexing**: Index embedded hardware configs (STM32, ESP32, Arduino, Linux SBC)
- **Linux SBC support**: Auto-detect Radxa, Jetson, Raspberry Pi, Orange Pi, BeagleBone
- **Device Tree analysis**: Scan, validate, and analyze .dts/.dtsi files
- **Architecture enforcement**: Define and enforce layer dependencies
- **Knowledge base**: Extract and query learnings from completed features
- **Session management**: Checkpoints for context preservation across Claude sessions

## Installation

### Quick Install (Recommended)

```bash
npm install -g mcp-engineering-server
mcp-engineering-server install
```

That's it! The install command will:
1. Copy slash commands to `~/.claude/commands/` (global)
2. Register the MCP server with Claude Code

### From Source

```bash
git clone https://github.com/liam1472/mcp-engineering-server.git
cd mcp-engineering-server
npm install && npm run build

# Install globally
npm link
mcp-engineering-server install
```

### Uninstall

```bash
mcp-engineering-server uninstall
npm uninstall -g mcp-engineering-server
```

## Slash Commands

### Core Workflow

| Command | Description |
|---------|-------------|
| `/eng-init` | Initialize project, auto-detect type, create `.engineering/` |
| `/eng-scan` | Build function index (incremental by default) |
| `/eng-scan --full` | Force full rescan of codebase |
| `/eng-start <feature>` | Start working on a feature, create feature directory |
| `/eng-plan <feature>` | Create planning document with knowledge/manifesto injection |
| `/eng-validate` | Run validation pipeline (security, build, tests) |
| `/eng-done` | Complete feature, extract knowledge, archive |
| `/eng-done --promote` | Also promote knowledge to global KB (`~/.mcp-engineering/`) |

### Security

| Command | Description |
|---------|-------------|
| `/eng-security` | Scan for secrets, credentials, API keys |
| `/eng-security --fix` | Auto-fix: create .env, replace secrets, backup files |
| `/eng-security --fix --dry-run` | Preview what --fix would change |
| `/eng-security --fix --force` | Override safety limit (>5 files) |

### Testing

| Command | Description |
|---------|-------------|
| `/eng-test` | Run fast unit tests (auto-detect framework) |
| `/eng-test --file <path>` | Test specific file |
| `/eng-test --watch` | Enable watch mode for TDD |
| `/eng-mutation` | Run mutation testing (SLOW - use before completing) |
| `/eng-mutation --file <path>` | Mutation test specific file |
| `/eng-mutation --mode check` | Verify mutation score meets threshold |
| `/eng-mutation --mode analyze` | Testability analysis only (no mutation) |
| `/eng-mutation --threshold 40` | Set custom threshold (default: 30%) |

### Analysis & Refactoring

| Command | Description |
|---------|-------------|
| `/eng-refactor` | Detect duplicates, magic numbers, long functions |
| `/eng-refactor --fix` | Auto-fix: extract constants (creates .bak backups) |
| `/eng-refactor --fix --dry-run` | Preview what --fix would change |
| `/eng-refactor --learn` | Extract anti-patterns to manifesto.md |
| `/eng-refactor --clean` | Detect garbage files (AI debug scripts, temp, logs) |
| `/eng-deps` | Analyze dependencies, detect circular imports |
| `/eng-duplicates` | Find duplicate code blocks |
| `/eng-duplicates --minLines 10` | Set minimum lines (default: 5) |
| `/eng-review` | Pre-completion checklist (security, build, tests, mutation) |
| `/eng-pipeline` | Full pipeline: build, typecheck, lint, test |

### Architecture

| Command | Description |
|---------|-------------|
| `/eng-arch --init` | Create architecture.yaml template |
| `/eng-arch --check` | Check for architecture violations |
| `/eng-arch --enforce` | Enforce rules (fail on violations) |

### Indexing & Search

| Command | Description |
|---------|-------------|
| `/eng-search <query>` | Search functions, errors, patterns |
| `/eng-search <query> --type function` | Search only functions |
| `/eng-index-function` | Show function index stats |
| `/eng-index-function <query>` | Search indexed functions |
| `/eng-index-function --file <pattern>` | Filter by file path |
| `/eng-index-similar <code>` | Find similar code snippets |
| `/eng-routes` | Index API routes (auto-detect framework) |
| `/eng-routes --framework express` | Specify framework |
| `/eng-hardware` | Index hardware configs (MCU + Linux SBC) |
| `/eng-knowledge` | Show knowledge base stats |
| `/eng-knowledge <query>` | Query knowledge base |

### Debugging

| Command | Description |
|---------|-------------|
| `/eng-debug <file>` | Analyze log file (stream, tail 100 lines) |
| `/eng-debug <file> --pattern "ERROR"` | Filter lines by pattern (regex) |
| `/eng-debug <file> --tail 500` | Show last N lines |
| `/eng-debug <file> --ignoreCase` | Case-insensitive matching |

### Embedded Linux

| Command | Description |
|---------|-------------|
| `/eng-dts --scan` | Index all .dts/.dtsi files |
| `/eng-dts --check "&i2c3"` | Validate node reference exists |
| `/eng-dts --conflicts` | Detect pin muxing conflicts |
| `/eng-dts --available i2c` | List available nodes of type |

### Session Management

| Command | Description |
|---------|-------------|
| `/eng-checkpoint` | Save session checkpoint |
| `/eng-checkpoint --name "before-refactor"` | Named checkpoint |
| `/eng-resume` | Resume from latest checkpoint |
| `/eng-resume --checkpoint <id>` | Resume specific checkpoint |

## Workflows

### Standard Feature Workflow

```bash
/eng-init                    # First time only
/eng-start user-authentication
/eng-plan user-authentication  # Create plan with knowledge injection
# ... implement feature ...
/eng-test                    # Fast unit tests (use frequently)
/eng-mutation                # Verify mutation score >= 30%
/eng-refactor                # Check code quality
/eng-review                  # Pre-completion checklist
/eng-done                    # Archive and extract knowledge
```

### Security Audit

```bash
/eng-security                # Scan for secrets
/eng-security --fix --dry-run  # Preview fixes
/eng-security --fix          # Apply fixes
```

### Code Quality

```bash
/eng-refactor                # Find issues
/eng-refactor --clean        # Find garbage files
/eng-duplicates              # Find duplicate code
/eng-deps                    # Check circular imports
/eng-arch --check            # Check architecture violations
```

### Embedded Linux Development

```bash
/eng-hardware                # Index hardware configs
/eng-dts --scan              # Index device tree files
/eng-dts --conflicts         # Check pin conflicts
/eng-security                # Uses 'embedded' profile
```

### Session Preservation

```bash
/eng-checkpoint              # Before ending session
# ... close Claude ...
/eng-resume                  # Restore context
```

## Generated Structure

```
.engineering/
├── config.yaml           # Project config (type, profile)
├── manifesto.md          # Coding standards (auto-copied)
├── architecture.yaml     # Layer rules (via /eng-arch --init)
├── index/
│   ├── functions.yaml    # Function index
│   ├── routes.yaml       # API routes (web)
│   ├── hardware.yaml     # Hardware configs (embedded)
│   ├── dts-index.yaml    # Device tree index
│   └── duplicates.yaml   # Duplicate code report
├── sessions/             # Checkpoints (gitignore this)
├── security/
│   ├── patterns.yaml     # Detection patterns
│   └── whitelist.yaml    # False positive whitelist
├── knowledge/
│   ├── index.yaml        # Knowledge index
│   ├── base.yaml         # Full entries
│   └── details/          # Individual markdown files
├── features/             # Active features
│   └── <feature>/
│       ├── PLAN.md       # Planning document
│       └── progress.yaml # Progress tracking
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
| `embedded-radxa` | /proc/device-tree/compatible (radxa) |
| `embedded-jetson` | /etc/nv_tegra_release |
| `embedded-rpi` | /proc/device-tree/model |
| `embedded-orangepi` | /proc/device-tree/compatible (xunlong) |
| `embedded-beaglebone` | /proc/device-tree/compatible (beagle) |
| `mobile-flutter` | pubspec.yaml |
| `mobile-react-native` | react-native in package.json |

## Security Profiles

### Profile: `embedded`

Detects unsafe patterns for MCU and Linux SBC:

| Pattern | Severity | Description |
|---------|----------|-------------|
| `malloc/free` | Critical | Dynamic memory allocation |
| `new/delete` | Critical | C++ dynamic allocation |
| `delay(>100ms)` | Warning | Blocking delay |
| `printf in ISR` | Warning | Blocking in interrupt |
| `/sys/class/gpio` | Warning | Deprecated sysfs GPIO |
| `i2c_transfer` without check | Warning | Missing error handling |
| `status="okay"` in DTS | Info | Verify pinctrl configured |
| `spi_sync` | Info | Check CS management |
| `pwm_enable` | Info | Ensure config before enable |

### Profile: `web`

Detects unsafe patterns for web projects:

| Pattern | Severity | Description |
|---------|----------|-------------|
| `eval()` | Critical | Code injection risk |
| `readFileSync` | Warning | Blocking I/O |
| Hardcoded secrets | Critical | API keys, passwords |

### Profile: `dotnet`

Detects unsafe patterns for .NET projects:

| Pattern | Severity | Description |
|---------|----------|-------------|
| `async void` | Warning | Unhandled exceptions |
| `Thread.Sleep` | Warning | Blocking in async context |

## Mutation Testing

Supported languages and tools:

| Language | Tool | Install |
|----------|------|---------|
| TypeScript/JavaScript | Stryker | `npm i -D @stryker-mutator/core` |
| Python | mutmut | `pip install mutmut` |
| Rust | cargo-mutants | `cargo install cargo-mutants` |
| Go | go-mutesting | `go install github.com/zimmski/go-mutesting/...@latest` |
| C# | dotnet-stryker | `dotnet tool install -g dotnet-stryker` |
| C/C++ | mull | See https://mull.readthedocs.io |

Score thresholds:

| Score | Verdict |
|-------|---------|
| >= 60% | Excellent |
| >= 50% | Good |
| >= 40% | Acceptable |
| >= 30% | Needs Improvement |
| < 30% | Poor (blocks /eng-done) |

## Requirements

- Node.js >= 18.0.0
- Claude Code (VS Code extension or CLI)

## Recent Changes

### Memory Safety
- `/eng-debug` now uses ring buffer - safe for files of any size (1GB+)
- No more OOM crashes when analyzing large log files

### Unix Permission Preservation
- `--fix` operations preserve file permissions (chmod +x for scripts)
- Important for build scripts and executables on Linux

### Improved Workflow
- `/eng-start` now shows recommended next steps including `/eng-plan`
- Better guidance for new users

## License

MIT

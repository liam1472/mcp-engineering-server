# MCP Engineering Server

An MCP (Model Context Protocol) server and Claude Code plugin for AI-assisted engineering workflows.

## Features

- **Auto-detect project type**: Supports 20+ project types (Node.js, .NET, Python, Rust, Go, Embedded, etc.)
- **Security scanning**: Detect secrets, API keys, and credentials before commit
- **Mutation testing**: Verify test quality with multi-language mutation testing support
- **Function indexing**: Index and search functions across TypeScript, Python, C#, Go, Rust, C/C++
- **Duplicate detection**: Find duplicate code blocks for refactoring
- **Route indexing**: Index API routes (Express, Flask, FastAPI, ASP.NET, Go)
- **Hardware indexing**: Index embedded hardware configs (STM32, ESP32, Arduino)
- **Knowledge base**: Extract and query learnings from completed features
- **Session management**: Checkpoints for context preservation across Claude sessions
- **Multi-session coordination**: Parallel Claude instances with file locking

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
| `/eng-init` | Initialize project, auto-detect type |
| `/eng-scan` | Build function index |
| `/eng-security` | Scan for secrets and credentials |
| `/eng-security --fix` | Auto-fix: create .env, replace secrets, backup files |
| `/eng-security --fix --dry-run` | Preview what --fix would change |
| `/eng-start <feature>` | Start working on a feature |
| `/eng-validate` | Run validation pipeline |
| `/eng-done` | Complete and archive feature |
| `/eng-search <query>` | Search indexed functions |

### Testing & Quality

| Command | Description |
|---------|-------------|
| `/eng-test` | Run mutation testing (auto-detect language) |
| `/eng-test --file <path>` | Test specific file |
| `/eng-test --mode check` | Verify mutation score meets threshold |
| `/eng-test --mode analyze` | Testability analysis only (no mutation) |
| `/eng-test --threshold 40` | Set custom threshold (default: 30%) |

### Analysis & Refactoring

| Command | Description |
|---------|-------------|
| `/eng-refactor` | Analyze code for refactoring opportunities |
| `/eng-refactor --fix` | Auto-fix: add constants, backup files |
| `/eng-refactor --fix --dry-run` | Preview what --fix would change |
| `/eng-review` | Pre-completion checklist (security, build, tests, mutation) |
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

## Workflows & Scenarios

### Scenario 1: New Project Setup

First time using the plugin on a project:

```bash
/eng-init                    # Auto-detect project type, create .engineering/
/eng-scan                    # Index all functions in codebase
/eng-security                # Check for any existing secrets/credentials
```

**What happens:**
- `.engineering/` directory created with config
- Project type detected (e.g., `web-node`, `embedded-stm32`, `python-fastapi`)
- Function index built at `.engineering/index/functions.yaml`
- Security report generated

---

### Scenario 2: Feature Development (Standard Flow)

Working on a new feature from start to finish:

```bash
# 1. Start feature - creates context directory
/eng-start user-authentication

# 2. Work on your code + write tests
#    Claude assists with implementation

# 3. Verify test quality - REQUIRED before completion
/eng-test                    # Must pass threshold (default: 30%)

# 4. Check code quality
/eng-refactor                # Find code smells, duplicates

# 5. Full validation
/eng-validate                # Runs: security scan + index update + status check

# 6. If issues found
/eng-security --fix          # Auto-fix secrets
/eng-refactor --fix          # Auto-fix code smells

# 7. Complete feature - validates, archives, extracts knowledge
/eng-done
```

**What happens:**
- Feature directory created at `.engineering/features/user-authentication/`
- Progress tracked in `progress.yaml`
- `/eng-test` verifies test coverage catches mutations (quality gate)
- `/eng-refactor` identifies maintainability issues early
- On `/eng-done`: final validation, archived to `.engineering/archive/`, learnings extracted to knowledge base

**Quality Gates (enforced):**
- Mutation score >= 30% (configurable with `--threshold`)
- No critical security issues
- Build passes

---

### Scenario 3: Security Audit

Find and fix secrets before pushing to git:

```bash
# Scan for secrets
/eng-security

# Preview what auto-fix would do (safe, no changes)
/eng-security --fix --dry-run

# Apply fixes: create .env, replace secrets in code, backup originals
/eng-security --fix
```

**Example output:**
```
Security Scan Results:
  CRITICAL: 2 findings
    - src/config.ts:15 - Hardcoded API key (OPENAI_API_KEY)
    - src/db.ts:8 - Database password in connection string

  Run `/eng-security --fix` to auto-remediate
```

---

### Scenario 4: Code Analysis & Refactoring

Find code quality issues:

```bash
# Find magic numbers, duplicate code, refactoring opportunities
/eng-refactor

# Preview auto-fix
/eng-refactor --fix --dry-run

# Apply fixes: extract constants, add config files
/eng-refactor --fix

# Find duplicate code blocks
/eng-duplicates

# Analyze dependencies, find circular imports
/eng-deps
```

---

### Scenario 5: Search & Discovery

Find code in large codebases:

```bash
# Search functions by name or description
/eng-search "authentication"
/eng-search "parse JSON"

# Find similar code blocks (for refactoring)
/eng-index-similar "function validateUser(email, password)"

# Query knowledge base from past features
/eng-knowledge "how did we handle rate limiting"

# Index and search API routes (web projects)
/eng-routes

# Index hardware peripherals (embedded projects)
/eng-hardware
```

---

### Scenario 6: Session Management

Preserve context across Claude sessions:

```bash
# Save checkpoint before ending session
/eng-checkpoint

# ... close Claude, come back later ...

# Resume from checkpoint (restores context)
/eng-resume
```

---

### Scenario 7: Parallel Development (Multi-Session)

Multiple Claude instances working on same codebase:

```bash
# Terminal 1: Start session A
/eng-session-start A
/eng-lock src/auth/login.ts      # Lock file to prevent conflicts

# Terminal 2: Start session B
/eng-session-start B
/eng-lock src/auth/register.ts   # Lock different file

# Check all sessions and locks
/eng-session-status

# Sync discoveries between sessions
/eng-session-sync

# When done, unlock files
/eng-unlock src/auth/login.ts
```

**Session status output:**
```
Active Sessions:
  A: Working on src/auth/login.ts (locked)
  B: Working on src/auth/register.ts (locked)
  C: Inactive

Locked Files:
  - src/auth/login.ts (Session A)
  - src/auth/register.ts (Session B)
```

---

### Scenario 8: Pre-Commit Review

Final checks before creating PR:

```bash
# Run full validation pipeline
/eng-pipeline                # build + lint + test + security

# Or run review checklist
/eng-review                  # Shows: security, build, tests, mutation status
```

**Review output:**
```
Pre-Completion Review:
  [x] Security scan passed
  [x] Build successful
  [x] Tests passing (48/48)
  [x] Mutation score: 35.0% (threshold: 30%)
  [ ] Lint warnings: 3

  Recommendation: Fix lint warnings, then ready for /eng-done
```

---

### Scenario 9: Mutation Testing

Verify test quality with mutation testing:

```bash
# Run full mutation test (auto-detects language and tool)
/eng-test

# Test specific file
/eng-test --file src/auth/validator.ts

# Check if mutation score meets threshold (for CI)
/eng-test --mode check --threshold 40

# Analyze testability without running mutations
/eng-test --mode analyze --file src/services/payment.ts
```

**Example output:**
```
# Mutation Test Report

## Summary
Score: **45.50%** (acceptable)
Killed: 182
Survived: 158
No Coverage: 60
Total: 400

## Verdict: ACCEPTABLE

## Surviving Mutants (showing first 10)
**src/validator.ts:142** [ConditionalExpression]
  Status: Survived
  💡 Add test for both true and false branches

**src/validator.ts:89** [EqualityOperator]
  Status: Survived
  💡 Add boundary condition tests

## Testability Issues (2)
[HIGH] **validatePayment** (complex-private)
  src/services/payment.ts:50
  Private method 'validatePayment' is 25 lines - hard to test directly
  💡 Extract to a separate testable class or make protected/public for testing

## Recommendations
🔧 2 complex private method(s) detected - consider extracting to testable classes
```

**Supported Languages & Tools:**

| Language | Tool | Install Command |
|----------|------|-----------------|
| TypeScript/JavaScript | Stryker | `npm install --save-dev @stryker-mutator/core` |
| Python | mutmut | `pip install mutmut` |
| Rust | cargo-mutants | `cargo install cargo-mutants` |
| Go | go-mutesting | `go install github.com/zimmski/go-mutesting/cmd/go-mutesting@latest` |
| C# | dotnet-stryker | `dotnet tool install -g dotnet-stryker` |
| C/C++ | mull | See https://mull.readthedocs.io |

**Score Thresholds:**

| Score | Verdict |
|-------|---------|
| >= 60% | Excellent |
| >= 50% | Good |
| >= 40% | Acceptable |
| >= 30% | Needs Improvement |
| < 30% | Poor |

---

### Quick Reference

**Standard Feature Workflow:**
```
/eng-start → code + tests → /eng-test → /eng-refactor → /eng-validate → /eng-done
```

| Goal | Command |
|------|---------|
| Setup new project | `/eng-init` → `/eng-scan` |
| Start feature | `/eng-start <name>` |
| **Verify test quality** | `/eng-test` (required before `/eng-done`) |
| Check code quality | `/eng-refactor` |
| Find secrets | `/eng-security` |
| Fix secrets | `/eng-security --fix` |
| Search code | `/eng-search <query>` |
| Find duplicates | `/eng-duplicates` |
| Check dependencies | `/eng-deps` |
| Save progress | `/eng-checkpoint` |
| Resume work | `/eng-resume` |
| Final validation | `/eng-validate` or `/eng-pipeline` |
| Complete feature | `/eng-done` |

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
│   ├── index.yaml        # Knowledge index (metadata)
│   ├── base.yaml         # Extracted learnings
│   └── details/          # Individual knowledge entries
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

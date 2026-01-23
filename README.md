# MCP Engineering Server

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/liam1472/mcp-engineering-server)
[![Tests](https://img.shields.io/badge/tests-539%20passed-blue)](https://github.com/liam1472/mcp-engineering-server)
[![Platform](https://img.shields.io/badge/platform-Embedded%20%7C%20Web%20%7C%20.NET-orange)](https://github.com/liam1472/mcp-engineering-server)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> **The "Engineering OS" for AI Agents.**
> Turn your LLM into a Senior Engineer capable of handling **1GB+ logs**, **atomic refactoring**, and **embedded systems** safely.

---

## Why This Exists

Most AI coding tools fail at scale:

| Problem | What Happens |
|---------|--------------|
| **OOM Crashes** | Ask Claude to analyze a 500MB build log. It dies. |
| **Broken Builds** | AI edits 5 files, fails on the 6th, leaving your repo corrupted. |
| **Blind Security** | AI writes `eval()` or commits API keys without knowing. |
| **No Hardware Awareness** | AI suggests `malloc()` in your ISR. Your MCU crashes. |

**MCP Engineering Server fixes this.** It provides the "Hands and Eyes" for Claude to work safely on massive, complex repositories.

---

## Superpowers

### Atomic Filesystem Operations

Never break your build again. All `--fix` operations are **transactional**.

```
/eng-security --fix
  ├── Replace secret in config.ts    ✓
  ├── Replace secret in utils.ts     ✓
  └── Replace secret in broken.ts    ✗ Error!
      ↓
  ROLLBACK: All changes reverted. Your repo is clean.
```

- **Rollback**: If one edit fails, all changes are reverted
- **Permission Safe**: Preserves `chmod +x` for scripts (Linux/Embedded)
- **Backup Files**: Creates `.bak` before modifications

### Streaming Log Analyzer

Debug **1GB+ log files** instantly without eating RAM.

```bash
/eng-debug build.log --pattern "ERROR"
# Uses Ring Buffer architecture
# Finds exact error line in seconds
# Memory usage: ~50MB regardless of file size
```

### Profile-Based Security

Context-aware scanning that understands your stack:

| Profile | Detects |
|---------|---------|
| **embedded** | `malloc` in ISR, blocking `delay()`, deprecated sysfs GPIO |
| **web** | `eval()`, `readFileSync`, hardcoded secrets |
| **dotnet** | `async void`, `Thread.Sleep` in async |

### Embedded & Hardware Aware

First-class support for **Linux SBCs** and **MCUs**.

```bash
/eng-hardware              # Auto-detect Radxa, Jetson, RPi, BeagleBone
/eng-dts --conflicts       # Find pin muxing conflicts BEFORE compile
/eng-dts --check "&i2c3"   # Validate node reference exists
```

### Mutation Testing

Verify your tests actually catch bugs. No fake coverage.

```bash
/eng-mutation              # Run mutation tests
/eng-mutation --mode check # Verify score >= 30% threshold
```

| Score | Verdict |
|-------|---------|
| >= 60% | Excellent |
| >= 40% | Acceptable |
| < 30% | Poor (blocks `/eng-done`) |

### Knowledge Base

Your AI learns from past work. Never solve the same problem twice.

```bash
/eng-knowledge "authentication"  # Query past solutions
/eng-done --promote              # Share knowledge globally
```

---

## Quick Start

```bash
# Install
npm install -g mcp-engineering-server
mcp-engineering-server install

# In your project
/eng-init                  # Setup (one time)
/eng-start my-feature      # Start work
# ... code ...
/eng-security              # Check secrets
/eng-test                  # Fast tests
/eng-done                  # Complete & archive
```

---

## Commands

### Core Workflow

| Command | Description |
|---------|-------------|
| `/eng-init` | Initialize project, auto-detect type |
| `/eng-start <feature>` | Start feature, create context |
| `/eng-plan <feature>` | Create plan with knowledge injection |
| `/eng-validate` | Run full validation pipeline |
| `/eng-review` | Pre-completion checklist |
| `/eng-done` | Archive feature, extract knowledge |

### Security & Quality

| Command | Description |
|---------|-------------|
| `/eng-security` | Scan secrets, API keys, credentials |
| `/eng-security --fix` | Auto-fix with atomic rollback |
| `/eng-refactor` | Find duplicates, magic numbers, long functions |
| `/eng-refactor --fix` | Auto-fix with `.bak` backups |
| `/eng-deps` | Detect circular imports |

### Testing

| Command | Description |
|---------|-------------|
| `/eng-test` | Fast unit tests (2-5s) |
| `/eng-test --watch` | TDD watch mode |
| `/eng-mutation` | Mutation testing (thorough) |
| `/eng-pipeline` | Full: build + lint + test |

### Debugging

| Command | Description |
|---------|-------------|
| `/eng-debug <file>` | Stream large logs safely |
| `/eng-debug <file> --pattern "ERROR"` | Filter by regex |
| `/eng-debug <file> --tail 500` | Last N lines |

### Indexing & Search

| Command | Description |
|---------|-------------|
| `/eng-scan` | Index functions (6 languages) |
| `/eng-search <query>` | Search functions, errors, patterns |
| `/eng-routes` | Index API routes |
| `/eng-index-similar <code>` | Find similar code |

### Embedded Linux

| Command | Description |
|---------|-------------|
| `/eng-hardware` | Index MCU + SBC configs |
| `/eng-dts --scan` | Index device tree files |
| `/eng-dts --conflicts` | Detect pin conflicts |
| `/eng-dts --check "&node"` | Validate reference |

### Session

| Command | Description |
|---------|-------------|
| `/eng-checkpoint` | Save session state |
| `/eng-resume` | Restore context |

---

## Workflows

### The "Fix It" Loop

```bash
/eng-test                 # Fast feedback (2s)
/eng-debug build.log      # Find error in 1GB log
/eng-security --fix       # Auto-fix secrets atomically
```

### The "Ship It" Workflow

```bash
/eng-init                 # One time setup
/eng-start user-auth      # Start feature
/eng-plan user-auth       # Plan with knowledge injection
# ... implement ...
/eng-test --watch         # TDD mode
/eng-mutation             # Verify test quality
/eng-review               # Pre-flight checklist
/eng-done --promote       # Archive + share knowledge
```

### The "Embedded" Workflow

```bash
/eng-hardware             # Detect Jetson/Radxa/RPi
/eng-dts --scan           # Index device tree
/eng-dts --conflicts      # Check pin muxing
/eng-security             # Uses 'embedded' profile
```

---

## Supported Platforms

### Project Types (20+)

| Category | Types |
|----------|-------|
| **Web** | Node.js, React, Vue, Angular |
| **Backend** | .NET, Python, Rust, Go |
| **Embedded** | STM32, ESP32, Arduino |
| **Linux SBC** | Radxa, Jetson, RPi, OrangePi, BeagleBone |
| **Mobile** | Flutter, React Native |

### Languages (Function Indexing)

TypeScript, Python, C#, Go, Rust, C/C++

### Mutation Testing Tools

| Language | Tool |
|----------|------|
| TypeScript | Stryker |
| Python | mutmut |
| Rust | cargo-mutants |
| Go | go-mutesting |
| C# | dotnet-stryker |

---

## Technical Philosophy

> **No score rationalization.** We report raw mutation scores.
> **No fake coverage.** If your tests don't catch bugs, we tell you.
> **No silent failures.** Atomic operations or nothing.

---

## Installation

### Quick Install

```bash
npm install -g mcp-engineering-server
mcp-engineering-server install
```

### From Source

```bash
git clone https://github.com/liam1472/mcp-engineering-server.git
cd mcp-engineering-server
npm install && npm run build
npm link
mcp-engineering-server install
```

### Uninstall

```bash
mcp-engineering-server uninstall
npm uninstall -g mcp-engineering-server
```

---

## Generated Structure

```
.engineering/
├── config.yaml           # Project config
├── manifesto.md          # Coding standards
├── architecture.yaml     # Layer rules
├── index/
│   ├── functions.yaml    # Function index
│   ├── routes.yaml       # API routes
│   ├── hardware.yaml     # Hardware configs
│   └── dts-index.yaml    # Device tree index
├── security/
│   ├── patterns.yaml     # Detection rules
│   └── whitelist.yaml    # False positives
├── knowledge/
│   ├── index.yaml        # Knowledge index
│   └── details/          # Detailed entries
└── features/             # Active features
```

---

## Requirements

- Node.js >= 18.0.0
- Claude Code (VS Code extension or CLI)

---

## License

MIT

---

<p align="center">
  <b>Built for engineers who ship.</b>
</p>

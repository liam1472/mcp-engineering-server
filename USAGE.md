# MCP Engineering Server - User Manual

## TL;DR (30 seconds)

```bash
# First time setup (once per project)
/eng-init

# Start working on a feature
/eng-start my-feature
/eng-plan my-feature

# Before committing
/eng-security          # Check for secrets
/eng-test              # Run unit tests
/eng-mutation          # Check test quality
/eng-review            # Final checklist

# Complete feature
/eng-done
```

---

## Quick Start

### 1. Initialize Project

```bash
/eng-init
```

**Output:**
```
✓ Initialized "my-project"
  Type: web-node
  Profile: web
  Config: .engineering/config.yaml

📋 Templates copied:
  • manifesto.md - Coding standards for web
  • blueprint.md - Deployment/ops standards for web

Next: Run eng_scan to build code indexes, eng_security to scan for secrets.
```

### 2. Start a Feature

```bash
/eng-start user-authentication
```

**Output:**
```
✓ Started feature "user-authentication"
  Directory: .engineering/features/user-authentication/

💡 Next steps:
  1. /eng-plan user-authentication - Create a planning document (recommended)
  2. /eng-test - Run unit tests (use frequently during TDD)
  3. /eng-mutation - Verify test quality before completing
  4. /eng-validate - Run full validation pipeline
  5. /eng-done - Complete and archive feature
```

### 3. Create a Plan (Recommended)

```bash
/eng-plan user-authentication
```

Creates `PLAN.md` with:
- Objective section
- Task checklist
- Related knowledge from previous features
- Manifesto rules that apply

### 4. Complete Feature

```bash
/eng-done
```

Checks:
- No critical security issues
- Mutation score >= 30%
- Archives feature
- Extracts knowledge for future reference

---

## Command Reference

### Core Commands

| Command | When to Use | Example |
|---------|-------------|---------|
| `/eng-init` | First time on a project | `/eng-init` |
| `/eng-start <name>` | Starting new work | `/eng-start payment-integration` |
| `/eng-plan <name>` | Before coding | `/eng-plan payment-integration` |
| `/eng-done` | Work complete | `/eng-done` |

### Quality Commands

| Command | When to Use | Example |
|---------|-------------|---------|
| `/eng-security` | Before commit | `/eng-security` |
| `/eng-security --fix` | Fix found secrets | `/eng-security --fix` |
| `/eng-test` | Fast TDD loop | `/eng-test --watch` |
| `/eng-mutation` | Verify tests catch bugs (SLOW) | `/eng-mutation` |
| `/eng-refactor` | Find code smells | `/eng-refactor` |
| `/eng-review` | Pre-commit checklist | `/eng-review` |

### Search Commands

| Command | When to Use | Example |
|---------|-------------|---------|
| `/eng-search <query>` | Find code | `/eng-search "handleError"` |
| `/eng-knowledge <query>` | Find past solutions | `/eng-knowledge "rate limiting"` |
| `/eng-index-similar <code>` | Find similar code | `/eng-index-similar "async function validate"` |

### Debug Commands

| Command | When to Use | Example |
|---------|-------------|---------|
| `/eng-debug <file>` | Analyze logs | `/eng-debug app.log` |
| `/eng-debug <file> --pattern "ERROR"` | Filter logs | `/eng-debug app.log --pattern "ERROR"` |
| `/eng-debug <file> --tail 500` | More lines | `/eng-debug app.log --tail 500` |

### Embedded Linux Commands

| Command | When to Use | Example |
|---------|-------------|---------|
| `/eng-hardware` | List peripherals | `/eng-hardware` |
| `/eng-dts --scan` | Index device tree | `/eng-dts --scan` |
| `/eng-dts --conflicts` | Check pin conflicts | `/eng-dts --conflicts` |

---

## Common Workflows

### Workflow 1: Fix a Bug

```bash
# 1. Start
/eng-start fix-login-timeout

# 2. Find related code
/eng-search "login timeout"
/eng-knowledge "authentication"

# 3. After fixing, verify
/eng-test                        # Run unit tests
/eng-security                    # Check no secrets exposed

# 4. Complete
/eng-done
```

### Workflow 2: Add a Feature

```bash
# 1. Start and plan
/eng-start oauth-integration
/eng-plan oauth-integration

# 2. Check architecture
/eng-arch --check                # Verify layer rules

# 3. During development
/eng-test --watch                # TDD loop

# 4. Before PR
/eng-mutation                    # Mutation testing (SLOW)
/eng-review                      # Full checklist
/eng-done
```

### Workflow 3: Code Review Prep

```bash
# Run all checks
/eng-security                    # No secrets
/eng-refactor                    # No code smells
/eng-mutation --mode check       # Mutation score OK
/eng-review                      # Summary
```

### Workflow 4: Explore Codebase

```bash
# Find functions
/eng-search "validate"
/eng-index-function --file "src/auth/*"

# Find similar patterns
/eng-index-similar "if (!user) throw new Error"

# Check dependencies
/eng-deps
```

### Workflow 5: Session Management

```bash
# End of day - save context
/eng-checkpoint --name "day1-auth-work"

# Next day - restore
/eng-resume --checkpoint day1-auth-work
```

---

## Error Messages & Solutions

### "Project not initialized"

```
Error: Project not initialized. Run eng_init first.
```

**Solution:** Run `/eng-init` first.

### "Feature already active"

```
Feature "old-feature" is already active.
Run eng_done to complete it first.
```

**Solution:** Run `/eng-done` or continue working on existing feature.

### "Critical security issues found"

```
Cannot complete: 2 critical security issue(s) found.
Run eng_security to see details.
```

**Solution:**
```bash
/eng-security                    # See what's wrong
/eng-security --fix --dry-run    # Preview fixes
/eng-security --fix              # Apply fixes
```

### "Mutation score too low"

```
Warning: Mutation score 15% is below threshold 30%
```

**Solution:** Add more tests that actually verify behavior:
```bash
/eng-mutation --mode analyze     # See which code lacks tests
```

---

## Tips for Claude

### When user says "test my code"

```bash
/eng-test                        # Fast unit tests (use this!)
/eng-mutation                    # Only if user asks for test quality verification
```

### When user says "check for issues"

```bash
/eng-security                    # Security issues
/eng-refactor                    # Code quality issues
/eng-deps                        # Dependency issues
```

### When user says "I'm done"

```bash
/eng-review                      # Run checklist
/eng-done                        # If all pass
```

### When user asks about past work

```bash
/eng-knowledge "topic"           # Search knowledge base
```

### When debugging

```bash
/eng-debug <logfile> --pattern "ERROR" --tail 200
```

---

## File Locations

| What | Where |
|------|-------|
| Project config | `.engineering/config.yaml` |
| Coding standards | `.engineering/manifesto.md` |
| Function index | `.engineering/index/functions.yaml` |
| Knowledge base | `.engineering/knowledge/` |
| Active features | `.engineering/features/` |
| Completed features | `.engineering/archive/` |
| Session checkpoints | `.engineering/sessions/` |

---

## Profile-Specific Commands

### For Embedded Projects (STM32, ESP32, Radxa, RPi)

```bash
/eng-hardware                    # List GPIO, I2C, SPI
/eng-dts --scan                  # Device tree analysis
/eng-security                    # Checks malloc, blocking delays
```

### For Web Projects (Node, React, Vue)

```bash
/eng-routes                      # API route index
/eng-security                    # Checks eval(), secrets
```

### For .NET Projects

```bash
/eng-security                    # Checks async void, Thread.Sleep
```

---

## Keyboard Shortcuts (in IDE)

Most commands work with Claude Code slash commands:

- Type `/eng-` to see autocomplete
- Tab to complete command name
- Space then type arguments

---

## Troubleshooting

### Commands not found

```bash
# Reinstall
mcp-engineering-server install
```

### Slow scans on large codebase

```bash
# Use incremental scan (default)
/eng-scan

# Only full scan when needed
/eng-scan --full
```

### Log analysis memory issues

The `/eng-debug` command uses ring buffer - safe for files of any size.

```bash
# This is safe even for 1GB+ logs
/eng-debug huge.log --pattern "ERROR" --tail 100
```

---

## Version Info

- **Memory-safe log analysis**: Ring buffer prevents OOM on large files
- **Permission preservation**: File chmod preserved on Unix (important for scripts)
- **Guided workflow**: `/eng-start` suggests next steps including `/eng-plan`

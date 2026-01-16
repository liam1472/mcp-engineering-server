---
description: Analyze code for refactoring opportunities
allowed-tools: MCP
---

Run the MCP tool `eng_refactor` to analyze the codebase for refactoring opportunities.

Usage:
  /eng-refactor               # Analyze only (suggestions)
  /eng-refactor --fix         # Auto-fix: add constants, backup files
  /eng-refactor --fix --dry-run   # Preview what --fix would change

When `--fix` is used, parse $ARGUMENTS to set `{ "fix": true }`.
When `--dry-run` is also used, set `{ "fix": true, "dryRun": true }`.

Detects:
- Duplicate code blocks (5+ lines repeated 2+ times)
- Magic numbers (hardcoded values that should be constants)
- Long functions (50+ lines that should be split)

Output includes:
- Priority-ranked suggestions (high/medium/low)
- Affected files and line counts
- Estimated impact of each refactor
- Actionable recommendations

With `--fix` flag:
- Extracts magic numbers to named constants (auto-applied)
- Creates `.bak` backup of each modified file
- Generates manual instructions for duplicate extraction (cross-file refactoring is manual)

With `--dry-run` flag (used with `--fix`):
- Shows preview of all changes without modifying files
- Use this to review before applying

Use this before /eng-done to improve code quality.

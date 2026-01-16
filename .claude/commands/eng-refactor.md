---
description: Analyze code for refactoring opportunities
allowed-tools: MCP
---

Run the MCP tool `eng_refactor` to analyze the codebase for refactoring opportunities.

Usage:
  /eng-refactor               # Analyze only (suggestions)
  /eng-refactor --fix         # Auto-fix: add constants, backup files
  /eng-refactor --fix --dry-run   # Preview what --fix would change
  /eng-refactor --fix --force     # Force apply when >5 files (safety override)

When `--fix` is used, parse $ARGUMENTS to set `{ "fix": true }`.
When `--dry-run` is also used, set `{ "fix": true, "dryRun": true }`.
When `--force` is also used, set `{ "fix": true, "force": true }`.

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

Safety features:
- Protected paths (node_modules, .git, own src/) are never modified
- Requires `--force` flag when modifying more than 5 files
- Atomic rollback: if any file fails, all changes are reverted
- All modifications create `.bak` backup files
- Duplicate constant names are automatically disambiguated

Use this before /eng-done to improve code quality.

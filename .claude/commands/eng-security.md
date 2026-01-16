---
description: Scan for secrets and security issues
allowed-tools: MCP
---

Run the MCP tool `eng_security` to scan for security issues.

Usage:
  /eng-security              # Scan only (report issues)
  /eng-security --fix        # Auto-fix: create .env, modify code, backup files
  /eng-security --fix --dry-run  # Preview what --fix would change
  /eng-security --fix --force    # Force apply when >5 files (safety override)

When `--fix` is used, parse $ARGUMENTS to set `{ "fix": true }`.
When `--dry-run` is also used, set `{ "fix": true, "dryRun": true }`.
When `--force` is also used, set `{ "fix": true, "force": true }`.

Detects:
- AWS keys, GCP API keys, Azure storage keys
- OpenAI/Anthropic API keys
- JWT tokens, Bearer tokens
- Database connection strings
- Private keys (RSA, OpenSSH)
- Hardcoded passwords and secrets

With `--fix` flag:
- Creates `.env` file with extracted secrets as environment variables
- Creates `.env.example` template for team
- Replaces hardcoded secrets with `process.env.XXX` (or language equivalent)
- Adds `.env` to `.gitignore`
- Creates `.bak` backup of each modified file

With `--dry-run` flag (used with `--fix`):
- Shows preview of all changes without modifying files
- Use this to review before applying

Safety features:
- Protected paths (node_modules, .git, own src/) are never modified
- Requires `--force` flag when modifying more than 5 files
- Atomic rollback: if any file fails, all changes are reverted
- All modifications create `.bak` backup files

Critical issues will block `eng_done`.

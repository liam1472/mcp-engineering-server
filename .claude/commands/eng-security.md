---
description: Scan for secrets and security issues
allowed-tools: MCP
---

Run the MCP tool `eng_security` to scan for security issues.

Detects:
- AWS keys, GCP API keys, Azure storage keys
- OpenAI/Anthropic API keys
- JWT tokens, Bearer tokens
- Database connection strings
- Private keys (RSA, OpenSSH)
- Hardcoded passwords and secrets

Critical issues will block `eng_done`.

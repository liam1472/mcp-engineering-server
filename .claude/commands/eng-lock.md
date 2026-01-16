---
description: Lock a file to prevent conflicts
allowed-tools: MCP
---

Run the MCP tool `eng_lock` with file path from arguments: $ARGUMENTS

Usage: /eng-lock <file-path>

Locks a file for the current session. Other sessions cannot lock the same file.

Example: /eng-lock src/index.ts

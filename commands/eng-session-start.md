---
description: Start a parallel session (A, B, or C)
allowed-tools: MCP
---

Run the MCP tool `eng_session_start` with session ID from arguments: $ARGUMENTS

Usage: /eng-session-start <A|B|C>

For parallel development with multiple Claude instances.
Each session can lock files to prevent conflicts.

Example: /eng-session-start A

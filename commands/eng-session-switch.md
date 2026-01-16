---
description: Switch to a different parallel session
allowed-tools: MCP
---

Run the MCP tool `eng_session_switch` to switch between parallel Claude sessions.

Usage:
  /eng-session-switch A    # Switch to session A
  /eng-session-switch B    # Switch to session B
  /eng-session-switch C    # Switch to session C

Switching to a session:
- Loads that session's context and state
- Shows locked files for that session
- Shows last activity time

Use /eng-session-status to see all active sessions first.
Use /eng-session-sync after switching to see discoveries from other sessions.

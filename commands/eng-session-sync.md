---
description: Sync discoveries between parallel sessions
allowed-tools: MCP
---

Run the MCP tool `eng_session_sync` to synchronize with other parallel sessions.

Usage: /eng-session-sync

Shows:
- Files locked by other sessions (avoid editing these)
- Discoveries made by other sessions
- Potential conflicts to be aware of

Use this regularly when working in parallel with other Claude instances
to stay informed about what others are doing.

Related commands:
- /eng-session-start - Start a new session
- /eng-session-status - View all active sessions
- /eng-lock - Lock a file for exclusive editing

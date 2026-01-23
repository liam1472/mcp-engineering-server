Analyze log files safely using streaming (supports 1GB+ files).

Usage: /eng-debug <file> [options]

Options:
  --pattern <regex>  Filter lines by pattern (regex)
  --tail <n>         Show last N lines (default: 100)
  --ignoreCase       Case-insensitive pattern matching

Examples:
  /eng-debug build.log                     # Tail last 100 lines
  /eng-debug build.log --pattern "ERROR"   # Find errors
  /eng-debug server.log --tail 500         # Last 500 lines
  /eng-debug app.log --pattern "auth|login" --ignoreCase

Features:
- Ring Buffer architecture - constant ~50MB memory usage
- Handles files of any size without OOM crashes
- Regex pattern filtering for precise error location
- Safe for production log analysis

Use this for debugging build failures, server logs, or any large log files.

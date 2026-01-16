---
description: Search indexed functions with filters
allowed-tools: MCP
---

Run the MCP tool `eng_index_function` to search through indexed functions.

Usage:
  /eng-index-function              # Show function index stats
  /eng-index-function query        # Search for functions matching "query"
  /eng-index-function --file src/  # Filter by file path

Shows:
- Function name and location
- Signature (if available)
- File and line number

Run /eng-scan first to build the function index.

---
description: Detect duplicate code blocks across the codebase
allowed-tools: MCP
---

Run the MCP tool `eng_duplicates` to scan for duplicate code blocks.

This helps identify refactoring opportunities by finding similar code that could be extracted into shared functions or modules.

Usage: /eng-duplicates

Example output:
- Found 5 duplicate blocks with 12 total occurrences
- Average block size: 8 lines
- Top duplicates listed with file locations

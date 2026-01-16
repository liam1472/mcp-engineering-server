---
description: Find similar code in the codebase
allowed-tools: MCP
---

Run the MCP tool `eng_index_similar` to find code similar to a given snippet.

Usage:
  /eng-index-similar "function foo() { return bar; }"

Input a code snippet and find matching patterns in your codebase.

Output:
- File location and line numbers
- Similarity percentage (60%+ matches shown)
- Preview of matching code

Use this to:
- Find duplicate implementations
- Discover similar patterns
- Identify consolidation opportunities

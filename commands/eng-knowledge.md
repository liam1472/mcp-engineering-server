---
description: Query knowledge base from completed features
allowed-tools: MCP
---

Run the MCP tool `eng_knowledge` to query the knowledge base.

Usage:
  /eng-knowledge              # Show knowledge base stats
  /eng-knowledge auth         # Search for entries about "auth"
  /eng-knowledge database     # Search for entries about "database"

The knowledge base is built automatically when completing features with `/eng-done`.
It extracts:
- Decisions made during development
- Patterns discovered
- Bugs found and solutions
- Tips and notes

Stored in `.engineering/knowledge/base.yaml`

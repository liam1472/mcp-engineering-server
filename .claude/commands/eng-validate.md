---
description: Run validation pipeline
allowed-tools: MCP
---

Run the MCP tool `eng_validate` to run the validation pipeline.

Checks:
1. Security scan (critical issues = error)
2. Function index update
3. Active feature status

Use before `eng_done` to ensure everything passes.

---
description: Scan codebase and build function index
allowed-tools: MCP
---

Run the MCP tool `eng_scan` to scan the codebase and build indexes.

This will:
1. Scan all source files for functions/methods
2. Build function index in `.engineering/index/functions.yaml`
3. Support TypeScript, Python, C#, Go, Rust, C/C++

Use `--full` argument for complete rescan (default: incremental).

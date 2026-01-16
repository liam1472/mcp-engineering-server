---
description: Analyze module dependencies and detect circular imports
allowed-tools: MCP
---

Run the MCP tool `eng_deps` to analyze the dependency graph.

Usage:
  /eng-deps                        # Full analysis with circular detection
  /eng-deps --detectCircular=false # Skip circular detection

Supports:
- TypeScript/JavaScript: import/require statements
- Python: import/from statements
- Go: import blocks
- Rust: use/mod statements
- C#: using statements

Output includes:
- Total modules and edges
- Entry points (files with no imports)
- Orphan modules (files not imported by anyone)
- Circular dependency chains
- Most imported files (top 10)

Saved to `.engineering/index/dependencies.yaml`

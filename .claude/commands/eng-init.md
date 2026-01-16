---
description: Initialize engineering workflow for project
allowed-tools: MCP
---

Run the MCP tool `eng_init` to initialize the engineering workflow.

This will:
1. Auto-detect project type (web-node, dotnet-aspnet, embedded-stm32, etc.)
2. Create `.engineering/` directory structure
3. Generate `config.yaml` with project settings

Optional argument: project name (defaults to directory name)

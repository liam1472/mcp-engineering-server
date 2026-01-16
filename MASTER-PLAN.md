# MCP Engineering Server - MASTER PLAN & TRACKER

> **IMPORTANT**: Đây là plan tổng quát đầy đủ. Đọc kỹ trước khi tiếp tục implement.

---

## 📊 CURRENT PROGRESS: 100% Complete

| Phase | Description | Progress |
|-------|-------------|----------|
| 1 | Core (init, scan, security, search) | ✅ 100% |
| 2 | Sessions (checkpoint, resume, lock, switch, sync) | ✅ 100% |
| 3 | Workflow (start, validate, done) | ✅ 100% |
| 4 | Index (function, duplicates, routes, hardware) | ✅ 100% |
| 5 | Knowledge (extract, store, search) | ✅ 100% |
| 6 | Plugin Format | ✅ 100% |
| 7 | Validation Pipeline (full build/test/lint) | ✅ 100% |
| 8 | Dependency Graph | ✅ 100% |

---

## 📋 FULL COMMAND LIST (24 commands = 20 core + 4 bonus)

### Lifecycle Commands (8)

| Command | Slash Command | Status |
|---------|---------------|--------|
| `/eng init` | `/eng-init` | ✅ Done |
| `/eng scan` | `/eng-scan` | ✅ Done |
| `/eng security` | `/eng-security` | ✅ Done |
| `/eng start <feature>` | `/eng-start` | ✅ Done |
| `/eng validate` | `/eng-validate` | ✅ Done |
| `/eng refactor` | `/eng-refactor` | ✅ Done |
| `/eng review` | `/eng-review` | ✅ Done |
| `/eng done` | `/eng-done` | ✅ Done |

### Session Commands (6)

| Command | Slash Command | Status |
|---------|---------------|--------|
| `/eng session start <A\|B\|C>` | `/eng-session-start` | ✅ Done |
| `/eng session status` | `/eng-session-status` | ✅ Done |
| `/eng session switch <id>` | `/eng-session-switch` | ✅ Done |
| `/eng checkpoint` | `/eng-checkpoint` | ✅ Done |
| `/eng resume` | `/eng-resume` | ✅ Done |
| `/eng session sync` | `/eng-session-sync` | ✅ Done |

### Index Commands (4)

| Command | Slash Command | Status |
|---------|---------------|--------|
| `/eng search <query>` | `/eng-search` | ✅ Done |
| `/eng index function <name>` | `/eng-index-function` | ✅ Done |
| `/eng index similar <code>` | `/eng-index-similar` | ✅ Done |
| `/eng index deps <module>` | `/eng-deps` | ✅ Done |

### Lock Commands (2)

| Command | Slash Command | Status |
|---------|---------------|--------|
| `/eng lock <file>` | `/eng-lock` | ✅ Done |
| `/eng unlock <file>` | `/eng-unlock` | ✅ Done |

### Bonus Commands (4) - Added for completeness

| Command | Slash Command | Purpose |
|---------|---------------|---------|
| `/eng duplicates` | `/eng-duplicates` | Detect duplicate code blocks |
| `/eng routes` | `/eng-routes` | Index API routes (Express, Flask, ASP.NET) |
| `/eng hardware` | `/eng-hardware` | Index embedded hardware (STM32, ESP32) |
| `/eng knowledge` | `/eng-knowledge` | Query knowledge base |

---

## ✅ ALL PRIORITIES COMPLETED

All planned features have been implemented:
- Session management (switch, sync, lock, unlock)
- Workflow commands (start, validate, refactor, review, done)
- Index commands (function search, similarity detection, dependency graph)
- Knowledge extraction and search
- Validation pipeline (build, test, lint, typecheck)
- Plugin format for easy installation

---

## 📁 ACTUAL FILE STRUCTURE (All Complete)

```
mcp-engineering-server/
├── package.json
├── tsconfig.json
├── README.md
├── .claude-plugin/plugin.json     # Plugin manifest
├── .mcp.json                      # MCP server config
│
├── src/
│   ├── index.ts                   # MCP server entry + all handlers
│   ├── commands/index.ts          # Tool definitions
│   │
│   ├── core/
│   │   ├── project-detector.ts    # Auto-detect 20+ project types
│   │   └── config.ts              # Config management
│   │
│   ├── security/
│   │   └── scanner.ts             # Secret detection
│   │
│   ├── indexes/
│   │   ├── function-indexer.ts    # Multi-language function indexing
│   │   ├── duplicate-detector.ts  # Code duplication detection
│   │   ├── route-indexer.ts       # API route indexing
│   │   ├── hardware-indexer.ts    # Embedded hardware indexing
│   │   ├── dependency-graph.ts    # Module dependency analysis
│   │   ├── similarity.ts          # Code similarity search
│   │   └── refactor-analyzer.ts   # Refactoring suggestions
│   │
│   ├── sessions/
│   │   ├── context-manager.ts     # Session state management
│   │   └── coordinator.ts         # Multi-session coordination
│   │
│   ├── features/
│   │   └── manager.ts             # Feature lifecycle
│   │
│   ├── knowledge/
│   │   └── extractor.ts           # Knowledge extraction
│   │
│   ├── validation/
│   │   ├── pipeline.ts            # Build/test/lint/typecheck
│   │   └── review-checker.ts      # Pre-completion checks
│   │
│   └── types/
│       └── index.ts               # Zod schemas
│
└── commands/                      # Slash commands (24 total)
    ├── eng-init.md
    ├── eng-scan.md
    ├── eng-security.md
    ├── eng-start.md
    ├── eng-validate.md
    ├── eng-refactor.md
    ├── eng-review.md
    ├── eng-done.md
    ├── eng-search.md
    ├── eng-duplicates.md           # Bonus
    ├── eng-routes.md               # Bonus
    ├── eng-hardware.md             # Bonus
    ├── eng-deps.md
    ├── eng-knowledge.md            # Bonus
    ├── eng-checkpoint.md
    ├── eng-resume.md
    ├── eng-session-start.md
    ├── eng-session-status.md
    ├── eng-session-switch.md
    ├── eng-session-sync.md
    ├── eng-lock.md
    ├── eng-unlock.md
    ├── eng-index-function.md
    └── eng-index-similar.md
```

---

## 🔧 ARCHITECTURE REMINDER

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code                              │
│                                                              │
│  User types: /eng-validate                                   │
│       ↓                                                      │
│  Reads: .claude/commands/eng-validate.md                     │
│       ↓                                                      │
│  Slash command instructs Claude to call MCP tool             │
│       ↓                                                      │
│  Claude calls: mcp__engineering__validate                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   MCP Engineering Server                     │
│                                                              │
│  Tool: validate                                              │
│    → Run build check                                         │
│    → Run test check                                          │
│    → Run lint check                                          │
│    → Run security scan                                       │
│    → Run duplicate check                                     │
│    → Return results                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 EXAMPLE: Implementing /eng-validate

### Step 1: Create validation pipeline
```typescript
// src/validation/pipeline.ts
export interface ValidationResult {
  passed: boolean;
  checks: {
    build: CheckResult;
    test: CheckResult;
    lint: CheckResult;
    security: CheckResult;
    duplicates: CheckResult;
  };
}

export async function runValidation(projectPath: string): Promise<ValidationResult> {
  // Run all checks in parallel where possible
}
```

### Step 2: Create MCP tool handler
```typescript
// src/tools/validate.ts
export const validateTool = {
  name: 'validate',
  description: 'Run validation pipeline',
  handler: async (params: { path: string }) => {
    return await runValidation(params.path);
  }
};
```

### Step 3: Register in index.ts
```typescript
// src/index.ts
server.tool('validate', validateTool.handler);
```

### Step 4: Create slash command
```markdown
<!-- templates/commands/eng-validate.md -->
---
description: Run validation pipeline (build, test, lint, security)
---

Run the validation pipeline by calling `mcp__engineering__validate`.

Display results in a formatted table showing:
- Build status
- Test results
- Lint warnings/errors
- Security issues
- Duplicate code detected
```

---

## 🚀 ACTION REQUIRED

1. **Report current status**: Run `Get-ChildItem -Recurse -Filter "*.ts"` and show output
2. **Confirm what's done**: Which files exist from the target structure above?
3. **Continue implementation**: Start with Priority 1 (session-switch, session-sync)

---

**Questions?** Ask before proceeding to ensure we're aligned.
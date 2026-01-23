# MCP Engineering Server - Roadmap V2 (Verified)

> **Version**: 2.2
> **Last Updated**: 2026-01-23
> **Status**: Phase 1-3 COMPLETED, Phase 4 remaining
> **Base Commit**: d88adcb

---

## Current State (Verified)

### Commands hiện có (28 tools):

| Command | Status | Implementation |
|---------|--------|----------------|
| `eng_init` | ✅ OK | `src/core/config.ts` |
| `eng_scan` | ✅ OK | `src/indexes/function-indexer.ts` |
| `eng_security` | ✅ OK | `src/security/scanner.ts` |
| `eng_start` | ✅ OK | `src/features/manager.ts` |
| `eng_validate` | ✅ OK | Pipeline runner |
| `eng_done` | ✅ OK + promote | `src/features/manager.ts` |
| `eng_test` | ✅ OK | `src/testing/mutation-runner.ts` |
| `eng_unittest` | ✅ NEW | `src/testing/test-runner.ts` |
| `eng_refactor` | ✅ OK + clean | `src/indexes/refactor-analyzer.ts` |
| `eng_deps` | ✅ OK | `src/indexes/dependency-analyzer.ts` |
| `eng_hardware` | ⚠️ MCU ONLY | `src/indexes/hardware-indexer.ts` |
| `eng_pipeline` | ✅ OK | Build/lint/test pipeline |
| `eng_review` | ✅ OK | Pre-completion checklist |
| `eng_knowledge` | ✅ OK | `src/knowledge/extractor.ts` |
| `eng_search` | ✅ OK | Search indexes |
| `eng_duplicates` | ✅ OK | Duplicate detection |
| `eng_routes` | ✅ OK | API route indexer |
| `eng_index_function` | ✅ OK | Function search |
| `eng_index_similar` | ✅ OK | Similar code finder |
| `eng_session_checkpoint` | ✅ OK | Save checkpoint |
| `eng_session_resume` | ✅ OK | Resume checkpoint |
| `eng_plan` | ✅ NEW | `src/features/planner.ts` |
| `eng_debug` | ✅ NEW | `src/debugging/log-analyzer.ts` |
| `eng_dts` | ✅ NEW | `src/embedded/device-tree-indexer.ts` |
| `eng_arch` | ✅ NEW | `src/indexes/architecture-enforcer.ts` |

### Profiles hiện có:
- `embedded.yaml` - MCU + Linux SoC (basic patterns)
- `web.yaml` - Node.js, React, Vue
- `dotnet.yaml` - ASP.NET, MAUI

---

## Implementation Plan

### Phase 1: Fast Test Runner (P0) ✅ COMPLETED

#### 1.1 Create `/eng-unittest` - Fast Unit Test ✅

**Files created:**
- [x] `src/testing/test-runner.ts` - TestRunner class
- [x] `tests/specs/fast-test.spec.ts` - Golden spec (16 tests)

**Files modified:**
- [x] `src/commands/index.ts` - Add `eng_unittest` schema
- [x] `src/index.ts` - Add handler

**Implementation status:** ✅ COMPLETED (2026-01-22)

---

#### 1.2 Create `/eng-plan` - Planning Phase ✅

**Files created:**
- [x] `src/features/planner.ts` - PlanningManager class
- [x] `tests/specs/planning.spec.ts` - Golden spec (11 tests)

**Files modified:**
- [x] `src/commands/index.ts` - Add `eng_plan` schema
- [x] `src/index.ts` - Add handler

**Implementation status:** ✅ COMPLETED (2026-01-23)

---

#### 1.3 Create `/eng-debug` - Log Analyzer ✅

**Files created:**
- [x] `src/debugging/log-analyzer.ts` - Streaming log analyzer
- [x] `tests/specs/log-analyzer.spec.ts` - Golden spec (11 tests)

**Files modified:**
- [x] `src/commands/index.ts` - Add `eng_debug` schema
- [x] `src/index.ts` - Add handler

**Implementation status:** ✅ COMPLETED (2026-01-22)

---

#### 1.4 Create `/eng-dts` - Device Tree Specialist ✅

**Files created:**
- [x] `src/embedded/device-tree-indexer.ts` - DTS parser
- [x] `tests/specs/device-tree.spec.ts` - Golden spec (13 tests)

**Files modified:**
- [x] `src/commands/index.ts` - Add `eng_dts` schema
- [x] `src/index.ts` - Add handler

**Implementation status:** ✅ COMPLETED (2026-01-23)

---

### Phase 2: Architecture & Clean (P1) ✅ COMPLETED

#### 2.1 Create `/eng-arch` - Architecture Enforcer ✅

**Files created:**
- [x] `src/indexes/architecture-enforcer.ts` - ArchitectureEnforcer class
- [x] `tests/specs/architecture.spec.ts` - Golden spec (13 tests)

**Files modified:**
- [x] `src/commands/index.ts` - Add `eng_arch` schema
- [x] `src/index.ts` - Add handler

**Implementation status:** ✅ COMPLETED (2026-01-23)

---

#### 2.2 Add `--clean` flag to `/eng-refactor` ✅

**Files modified:**
- [x] `src/commands/index.ts` - Add `clean` param to schema
- [x] `src/indexes/refactor-analyzer.ts` - Add garbage detection
- [x] `tests/specs/refactor-clean.spec.ts` - Golden spec (13 tests)

**Implementation status:** ✅ COMPLETED (2026-01-22)

---

### Phase 3: Enhanced Context (P2) ✅ COMPLETED

#### 3.1 Enhance `/eng-start` context injection ✅

**Files modified:**
- [x] `src/features/manager.ts` - Added getPlan() and getFeatureContext()

**Implementation status:** ✅ COMPLETED (2026-01-23)

---

#### 3.2 Global Knowledge System ✅

**Files created:**
- [x] `src/knowledge/global-manager.ts` - Global KB manager

**Location:** `~/.mcp-engineering/global-knowledge/`

**Features:**
- `eng_done({ promote: true })` - Copy to global KB
- Search global knowledge
- Stats by type/project

**Implementation status:** ✅ COMPLETED (2026-01-23)

---

### Phase 4: Embedded Linux (P3) - REMAINING

#### 4.1 Enhance `eng_hardware` for Linux SBC

**Files to modify:**
- [ ] `src/indexes/hardware-indexer.ts` - Add SBC detection

**Detection patterns:**
| Platform | Detection |
|----------|-----------|
| Radxa | `/proc/device-tree/compatible` |
| Jetson | `/etc/nv_tegra_release` |
| RPi | `/proc/device-tree/model` |

**Implementation status:** NOT STARTED

---

#### 4.2 Add Linux SBC patterns to embedded.yaml

**Files to modify:**
- [ ] `src/config/patterns/embedded.yaml`

**New patterns:**
- Deprecated GPIO sysfs (`/sys/class/gpio`)
- I2C without error handling
- DTS status without pin check

**Note:** Some Linux SoC patterns already exist (lines 113-130)

**Implementation status:** PARTIAL (basic patterns exist)

---

## Progress Tracking

| Phase | Feature | Spec | Impl | Tests | Status |
|-------|---------|------|------|-------|--------|
| 1.1 | eng_unittest | [x] | [x] | 16 | ✅ COMPLETED |
| 1.2 | eng_plan | [x] | [x] | 11 | ✅ COMPLETED |
| 1.3 | eng_debug | [x] | [x] | 11 | ✅ COMPLETED |
| 1.4 | eng_dts | [x] | [x] | 13 | ✅ COMPLETED |
| 2.1 | eng_arch | [x] | [x] | 13 | ✅ COMPLETED |
| 2.2 | --clean flag | [x] | [x] | 13 | ✅ COMPLETED |
| 3.1 | Context inject | N/A | [x] | N/A | ✅ COMPLETED |
| 3.2 | Global KB | N/A | [x] | N/A | ✅ COMPLETED |
| 4.1 | SBC hardware | [ ] | [ ] | [ ] | NOT STARTED |
| 4.2 | SBC patterns | [ ] | [ ] | [ ] | PARTIAL |

**Total Spec Tests:** 167 (all passing)
**Total Tests:** 836 (all passing)

---

## Execution Order

1. ~~**Phase 1.1**: `eng_unittest` - Foundation for TDD loop~~ ✅
2. ~~**Phase 1.3**: `eng_debug` - Log analyzer (high value)~~ ✅
3. ~~**Phase 2.2**: `--clean` flag - Quick win~~ ✅
4. ~~**Phase 1.2**: `eng_plan` - Planning phase~~ ✅
5. ~~**Phase 1.4**: `eng_dts` - Device tree (user critical)~~ ✅
6. ~~**Phase 2.1**: `eng_arch` - Architecture enforcer~~ ✅
7. ~~**Phase 3.1**: Context injection~~ ✅
8. ~~**Phase 3.2**: Global knowledge~~ ✅
9. **Phase 4.x**: Embedded Linux enhancements ⬅️ NEXT

---

## Notes

- Multi-session (A/B/C) was removed in commit d88adcb (over-engineering)
- All specs must be written FIRST, then implementation
- If test fails, fix code NOT test (per CLAUDE.md)
- Handoff document: `HANDOFF.md`

---

## New Files Created (Session 2026-01-23)

```
src/
├── features/planner.ts           # PlanningManager
├── embedded/device-tree-indexer.ts  # DeviceTreeIndexer
├── indexes/architecture-enforcer.ts # ArchitectureEnforcer
├── knowledge/global-manager.ts   # GlobalKnowledgeManager

tests/specs/
├── planning.spec.ts      # 11 tests
├── device-tree.spec.ts   # 13 tests
├── architecture.spec.ts  # 13 tests
```

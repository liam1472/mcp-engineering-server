# HANDOFF - MCP Engineering Server

## Current Status

**Branch:** `refactor/security-scanner-architecture`
**Tests:** 836 passed | 4 skipped
**Spec Tests:** 167 passed

---

## Completed Phases

| Phase | Feature | Files | Tests |
|-------|---------|-------|-------|
| 1.1 | `eng_unittest` | `src/testing/test-runner.ts` | 16 specs |
| 1.2 | `eng_plan` | `src/features/planner.ts` | 11 specs |
| 1.3 | `eng_debug` | `src/debugging/log-analyzer.ts` | 11 specs |
| 1.4 | `eng_dts` | `src/embedded/device-tree-indexer.ts` | 13 specs |
| 2.1 | `eng_arch` | `src/indexes/architecture-enforcer.ts` | 13 specs |
| 2.2 | `--clean` flag | `src/indexes/refactor-analyzer.ts` | 13 specs |
| 3.1 | Context inject | `src/features/manager.ts` | N/A |
| 3.2 | Global KB | `src/knowledge/global-manager.ts` | N/A |

---

## Remaining Tasks (ROADMAP-V2.md Phase 4)

### Phase 4.1: Enhance `eng_hardware` for Linux SBC

**Files to modify:**
- `src/indexes/hardware-indexer.ts` - Add SBC detection

**Detection patterns:**
| Platform | Detection |
|----------|-----------|
| Radxa | `/proc/device-tree/compatible` |
| Jetson | `/etc/nv_tegra_release` |
| RPi | `/proc/device-tree/model` |

**Steps:**
1. Read current `src/indexes/hardware-indexer.ts`
2. Add SBC platform detection methods
3. Integrate with existing hardware scan
4. Write unit tests

---

### Phase 4.2: Add Linux SBC patterns to `embedded.yaml`

**Files to modify:**
- `src/config/patterns/embedded.yaml`

**New patterns to add:**
```yaml
# Deprecated GPIO sysfs pattern
- name: "Deprecated GPIO sysfs"
  regex: "/sys/class/gpio"
  severity: warning
  message: "sysfs GPIO is deprecated, use libgpiod"
  suggestion: "Use gpiod_line_request() instead"

# I2C without error handling
- name: "I2C missing error check"
  regex: "i2c_transfer\\([^)]+\\)\\s*;"
  severity: warning
  message: "I2C transfer without error checking"
  suggestion: "Check return value of i2c_transfer()"

# DTS status without pin check
- name: "DTS enabled without pinctrl"
  regex: 'status\\s*=\\s*"okay"'
  severity: info
  message: "Node enabled - verify pinctrl is configured"
```

**Steps:**
1. Read `src/config/patterns/embedded.yaml`
2. Add new Linux SBC patterns
3. Test with `/eng-security` on embedded project

---

## Process Guidelines

### Golden Spec Rule (from CLAUDE.md)
```
All test code success criteria must be defined BEFORE starting code.
If test fails, FIX CODE not test.
```

### Workflow
1. **Write spec first** in `tests/specs/*.spec.ts`
2. **Implement** in `src/`
3. **Add command schema** in `src/commands/index.ts`
4. **Add handler** in `src/index.ts`
5. **Run tests**: `npm run test:specs`
6. **Update ROADMAP-V2.md** progress table

### Commands
```bash
npm run build          # Compile TypeScript
npm run test:specs     # Run golden specs (167 tests)
npm test               # Full suite (836 tests)
npm run lint:fix       # Auto-fix lint
```

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Command schemas | `src/commands/index.ts` |
| Command handlers | `src/index.ts` |
| Test specs | `tests/specs/*.spec.ts` |
| Progress tracking | `ROADMAP-V2.md` |
| Project instructions | `CLAUDE.md` |

---

## Notes

- Multi-session (A/B/C) was removed in commit d88adcb (over-engineering)
- Response in Vietnamese if prompt contains Vietnamese
- Never add "Co-Authored-By: Claude" to commits

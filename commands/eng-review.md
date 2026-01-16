---
description: Pre-completion checklist before /eng-done
allowed-tools: MCP
---

Run the MCP tool `eng_review` to validate readiness for feature completion.

Usage:
  /eng-review              # Full review including tests
  /eng-review --skipTests  # Skip test execution

Checks:
- Active feature exists
- Security scan passes (no critical/high issues)
- Build succeeds
- Tests pass (unless skipped)
- No significant duplicate code
- Git status (uncommitted changes warning)

Returns:
- Ready/Not Ready status
- Pass/fail for each check
- Recommendation for next steps

Run this before /eng-done to ensure everything is in order.

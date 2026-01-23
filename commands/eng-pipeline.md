Run full validation pipeline: build, typecheck, lint, and test.

Usage: /eng-pipeline [options]

Options:
  --skipBuild      Skip build step
  --skipTypecheck  Skip typecheck step
  --skipLint       Skip lint step
  --skipTest       Skip test step

Examples:
  /eng-pipeline                # Run full pipeline
  /eng-pipeline --skipTest     # Skip tests (faster)
  /eng-pipeline --skipLint     # Skip linting

Auto-detects commands for:
- Node.js (npm run build/lint/test)
- Rust (cargo build/clippy/test)
- Go (go build/vet/test)
- .NET (dotnet build/test)
- Python (pytest, mypy, ruff)

Use for comprehensive validation before commits or PRs.

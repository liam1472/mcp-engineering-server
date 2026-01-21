# /eng-test - Mutation Testing

Run the MCP tool `eng_test` to verify test quality through mutation testing.

**Supports:** TypeScript, JavaScript, Python, Rust, Go, C#, C, C++

## Usage

```bash
/eng-test                           # Full mutation test (auto-detect language)
/eng-test --file src/foo.ts         # Test specific file
/eng-test --file main.py            # Test Python file (uses mutmut)
/eng-test --file lib.rs             # Test Rust file (uses cargo-mutants)
/eng-test --mode check              # Check if threshold is met
/eng-test --mode analyze --file src/foo.ts  # Testability analysis only
/eng-test --threshold 40            # Set custom threshold (default: 30)
```

## Supported Languages & Tools

| Language | Tool | Install Command |
|----------|------|-----------------|
| TypeScript/JavaScript | Stryker | `npm install --save-dev @stryker-mutator/core` |
| Python | mutmut | `pip install mutmut` |
| Rust | cargo-mutants | `cargo install cargo-mutants` |
| Go | go-mutesting | `go install github.com/zimmski/go-mutesting/cmd/go-mutesting@latest` |
| C# | dotnet-stryker | `dotnet tool install -g dotnet-stryker` |
| C/C++ | mull | See https://mull.readthedocs.io |

## Modes

| Mode | Description |
|------|-------------|
| `run` (default) | Full mutation testing (auto-detects tool) |
| `check` | Verify mutation score meets threshold |
| `analyze` | Testability analysis only (no mutation testing) |

## Output

### Full Run (`run` mode)

```
# Mutation Test Report

## Summary
Score: **29.89%** (needs-improvement)
Killed: 322
Survived: 556
No Coverage: 210
Total: 1088

## Verdict: NEEDS-IMPROVEMENT
⚠️ Needs improvement - add more targeted tests.

## Surviving Mutants (showing first 10)
**src/foo.ts:142** [ConditionalExpression]
  Status: Survived
  💡 Add test for both true and false branches

## Testability Issues (3)
[HIGH] **complexMethod** (complex-private)
  src/foo.ts:50
  Private method 'complexMethod' is 25 lines - hard to test directly
  💡 Extract to a separate testable class or make protected/public for testing

## Recommendations
⚠️ Mutation score is below 30% - prioritize adding tests for critical code paths
🔧 3 complex private method(s) detected - consider extracting to testable classes
```

### Check Mode

```
✓ Mutation score 35.00% meets threshold 30%

Score: 35.00%
Threshold: 30%
Status: PASSED ✓
```

## Score Thresholds

| Score | Verdict |
|-------|---------|
| >= 60% | Excellent |
| >= 50% | Good |
| >= 40% | Acceptable |
| >= 30% | Needs Improvement |
| < 30% | Poor |

## Testability Issues Detected

| Issue | Description | Suggestion |
|-------|-------------|------------|
| `complex-private` | Private method > 15 lines | Extract to testable class |
| `no-di` | Direct `new Class()` instantiation | Use dependency injection |
| `too-many-params` | Method with > 4 parameters | Use options object |

## Requirements

- Stryker must be installed: `npm install --save-dev @stryker-mutator/core`
- Stryker config file (`stryker.config.mjs`) must exist

## Philosophy

> **NO "effective score" rationalization**
>
> This tool reports raw mutation score only. If the score is 30%, it reports 30%.
> No calculation tricks to make numbers look better.

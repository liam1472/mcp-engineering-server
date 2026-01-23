# /eng-mutation - Mutation Testing (SLOW)

Run the MCP tool `eng_mutation` to verify test quality through mutation testing.

**⚠️ This is SLOW (minutes, not seconds). Use only before completing a feature, not during TDD.**

**Supports:** TypeScript, JavaScript, Python, Rust, Go, C#, C, C++

## Usage

```bash
/eng-mutation                       # Full mutation test (auto-detect language)
/eng-mutation --file src/foo.ts     # Test specific file
/eng-mutation --mode check          # Check if threshold is met
/eng-mutation --mode analyze        # Testability analysis only (no mutation)
/eng-mutation --threshold 40        # Set custom threshold (default: 30)
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

```
# Mutation Test Report

## Summary
Score: **35.00%** (needs-improvement)
Killed: 350
Survived: 650
No Coverage: 100
Total: 1100
Duration: 245.3s

## Verdict: NEEDS-IMPROVEMENT
⚠️ Needs improvement - add more targeted tests.

## Surviving Mutants (showing first 10)
**src/foo.ts:142** [ConditionalExpression]
  Status: Survived
  💡 Add test for both true and false branches
```

## Score Thresholds

| Score | Verdict |
|-------|---------|
| >= 60% | Excellent |
| >= 50% | Good |
| >= 40% | Acceptable |
| >= 30% | Needs Improvement |
| < 30% | Poor (blocks /eng-done) |

## When to Use

- **Before /eng-done**: Verify test quality before completing feature
- **Before PR**: Ensure tests actually catch bugs
- **NOT during TDD**: Use `/eng-test` instead for fast feedback

## See Also

- `/eng-test` - Fast unit tests for TDD loop (use frequently)
- `/eng-review` - Pre-completion checklist including mutation score

## Philosophy

> **NO "effective score" rationalization**
>
> This tool reports raw mutation score only. If the score is 30%, it reports 30%.
> No calculation tricks to make numbers look better.

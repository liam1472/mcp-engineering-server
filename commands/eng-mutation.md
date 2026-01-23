Run mutation testing to verify test quality. SLOW - use before completing features.

Usage: /eng-mutation [options]

Options:
  --file <path>      Mutation test specific file
  --mode check       Verify score meets threshold (default: 30%)
  --mode analyze     Testability analysis only (no mutation)
  --threshold <n>    Set custom threshold (default: 30)

Examples:
  /eng-mutation                      # Run full mutation testing
  /eng-mutation --file src/auth.ts   # Test specific file
  /eng-mutation --mode check         # Verify >= 30% score
  /eng-mutation --threshold 40       # Custom threshold

Score verdicts:
  >= 60%  Excellent
  >= 50%  Good
  >= 40%  Acceptable
  >= 30%  Needs Improvement
  < 30%   Poor (blocks /eng-done)

Supported tools: Stryker (JS/TS), mutmut (Python), cargo-mutants (Rust), go-mutesting (Go), dotnet-stryker (C#)

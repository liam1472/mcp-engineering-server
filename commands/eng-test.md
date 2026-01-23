Run fast unit tests using auto-detected test framework.

Usage: /eng-test [options]

Options:
  --file <path>   Test specific file only
  --watch         Enable watch mode for TDD

Examples:
  /eng-test                    # Run all unit tests
  /eng-test --file src/auth.ts # Test specific file
  /eng-test --watch            # TDD watch mode

Supported frameworks: Jest, Vitest, pytest, cargo test, go test, dotnet test

Use this command frequently during development for fast feedback (2-5s).
For thorough test quality verification, use /eng-mutation instead.

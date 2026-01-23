# /eng-test - Fast Unit Tests

Run the MCP tool `eng_test` for fast unit testing during TDD. Use this frequently during development.

**Supports:** vitest, jest, pytest, cargo test, go test, dotnet test, ctest

## Usage

```bash
/eng-test                           # Run all tests (auto-detect framework)
/eng-test --file src/foo.test.ts    # Test specific file
/eng-test --watch                   # Enable watch mode
```

## Supported Frameworks

| Framework | Detection |
|-----------|-----------|
| vitest | vitest.config.ts or vitest in package.json |
| jest | jest.config.js or jest in package.json |
| pytest | pytest.ini or pyproject.toml |
| cargo | Cargo.toml |
| go | go.mod |
| dotnet | *.csproj |
| ctest | CMakeLists.txt |

## Output

```
# Unit Test Results (vitest)

Command: npx vitest run

## Summary
  Passed:  42
  Failed:  0
  Skipped: 2
  Total:   44
  Duration: 1234ms

✓ All tests passed!
```

## When to Use

- **During TDD**: Run frequently as you write code
- **Before commits**: Quick sanity check
- **After refactoring**: Verify nothing broke

## See Also

- `/eng-mutation` - Slow mutation testing for test quality verification (use before completing features)

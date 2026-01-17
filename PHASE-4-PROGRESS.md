# Phase 4 Progress: No-Coverage Mutants (TESTINSTRUCT)

> **Branch**: refactor/security-scanner-architecture
> **Target**: 44 no-coverage mutants → +6.07% improvement
> **Current**: 21/44 covered (47.7%) → estimated +2.90%

---

## ✅ Tests Added (4 tests, 21 mutants covered)

### 1. Blocked Files Test (lines 443-446) - 7 mutants
**Commit**: 5c83a09
**Test**: `should report blocked files in errors (line 443)`
**Location**: tests/unit/security/scanner.test.ts:1311-1337

```typescript
// Manually create SecurityFinding[] pointing to protected file
// Tests that blockedFiles.length > 0 triggers error message
const findings: SecurityFinding[] = [
  { file: 'node_modules/test.js', ... }
];
const result = await scanner.applyFixes(findings);
expect(result.filesBlocked.length).toBeGreaterThan(0);
expect(result.errors[0]).toContain('Blocked');
```

**Why manual findings?** `scan()` ignores node_modules via IGNORED_DIRS (line 295)

### 2. Custom Patterns Test (line 252) - 1 mutant
**Commit**: 3f7e1ca
**Test**: `should merge custom patterns with profile patterns`
**Location**: tests/unit/security/scanner.test.ts:1387-1412

```typescript
// Create .engineering/security/custom.yaml
await fs.writeFile(path.join(securityDir, 'custom.yaml'), customYaml);
await scanner.setProfile('embedded');
const info = scanner.getProfileInfo();
// Line 252 executed when custom patterns are merged
```

**Targets**: Line 252 `for (const p of customPatterns)` loop

### 3. Success Calculation Test (line 622) - 7 mutants
**Commit**: 3f7e1ca
**Test**: `should mark as success when some files modified despite blocked files`
**Location**: tests/unit/security/scanner.test.ts:1414-1457

```typescript
// Mix of regular and protected files
findings = [
  { file: 'test.ts' },           // Regular file
  { file: 'node_modules/...' }   // Protected file
];
// Line 622: success = errors.length === filesBlocked.length && filesModified.length > 0
expect(result.success).toBe(true);
```

**Targets**: Line 622 complex success calculation logic

### 4. Placeholder Generation Test (lines 762-767) - 6 mutants
**Commit**: c1c37ce
**Test**: `should generate placeholders for different pattern types`
**Location**: tests/unit/security/scanner.test.ts:1414-1434

```typescript
// File with multiple secret types
await writeTestFile('keys.ts', `
  const API_KEY = 'AKIAIOSFODNN7EXAMPLE';
  const TOKEN = 'ghp_abc123def456';
  const PASS = 'password123';
`);
const result = await scanner.applyFixes(await scanner.scan());
// Lines 762-767: if (lower.includes('key/token/password/uri/secret'))
```

**Targets**: Lines 762-767 type filtering in `generatePlaceholder()`

---

## 📊 Mutation Test Results (Pending)

```
Before Phase 4:  68.43% (374 killed, 129 survived, 44 no-coverage)
After Phase 4:   ~71.33% (395 killed, 108 survived, 23 no-coverage)
Expected:        +2.90% (+21 killed)
```

**Note**: User will run mutation test to verify actual improvement

---

## 🔍 Remaining No-Coverage Mutants (23 mutants)

### Error Path Mutants (Difficult - require fs error simulation)

1. **Lines 523-527**: .env.example creation error (4 mutants)
   - In try-catch block, only executes on fs.writeFile error

2. **Lines 559-563**: .gitignore update error (4 mutants)
   - In try-catch block, only executes on fs.writeFile error

3. **Lines 606-612**: File modification error + rollback (7 mutants)
   - Executes when fs.writeFile fails + rollback succeeds/fails

4. **Lines 659-668**: Unexpected error + rollback (8 mutants)
   - Outer catch block for any unexpected errors

### How to Test Error Paths

**Option 1**: Mock file system (requires refactoring scanner to accept fs mock)
**Option 2**: Create read-only files/directories (platform-specific, unreliable)
**Option 3**: Skip for now - focus on higher-value targets (EqualityOperator, StringLiteral)

**Recommendation**: Skip error path tests. ROI is low (complex setup for 23 mutants = +3.17%)

---

## 📈 Progress Summary

| Phase | Mutants Killed | Score Improvement | Cumulative Score |
|-------|----------------|-------------------|------------------|
| Baseline | 367 | 66.79% | 66.79% |
| Phase 1 (Refactor) | +2 | +0.73% | 67.52% |
| Phase 2 (File flags) | +1 | +0.18% | 67.70% |
| Phase 2 (Conditionals) | +4 | +0.73% | 68.43% |
| **Phase 4 (No-coverage)** | **+21** | **+2.90%** | **71.33%** (projected) |
| **Total Progress** | **+28** | **+4.54%** | **71.33%** |

**Remaining to 81.81% goal**: 10.48% (76 mutants)

---

## 🎯 Next Steps

### Option A: Continue Phase 4 Error Paths (Low ROI)
- Try to mock fs errors for remaining 23 no-coverage mutants
- Complex setup, low probability of success
- **Expected**: +3.17% (if successful)

### Option B: Move to High-Value Targets (Recommended)
1. **EqualityOperator** (19 survived) → +2.62%
2. **StringLiteral** (69 survived, 23 no-coverage) → +9.52%
3. **ConditionalExpression** (31 remaining) → +4.27%

**Total potential**: +16.41%

### Option C: TESTINSTRUCT Phase 3 (As planned)
- Follow original TESTINSTRUCT plan
- Phase 3: EqualityOperator (16 survived) → +2.21%
- Then Phase 5: MethodExpression (9 survived) → +1.24%

---

## 🔧 Commits

1. **7ba4d2a**: docs(phase4): add no-coverage analysis and ticket tracking
2. **5c83a09**: test(phase4): fix blocked files test to cover no-coverage mutants
3. **3f7e1ca**: test(phase4): add custom patterns and success calculation tests
4. **c1c37ce**: test(phase4): add placeholder generation test (lines 762-767)

---

## 📚 References

- [REFACTOR-PLAN.md](REFACTOR-PLAN.md) - Original plan
- [PHASE-2-RESULTS.md](PHASE-2-RESULTS.md) - Phase 2 results
- [TICKETREMAIN.md](TICKETREMAIN.md) - Full backlog analysis
- [analyze-nocoverage.cjs](analyze-nocoverage.cjs) - No-coverage analysis script

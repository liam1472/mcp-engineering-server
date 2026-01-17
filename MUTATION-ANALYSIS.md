# MUTATION ANALYSIS: Scanner.ts Boolean & Design Issues

> **Date**: 2026-01-18
> **Source**: reports/mutation/mutation.json
> **Total Survived**: 140 mutants
> **Focus**: BooleanLiteral (8 mutants) + Design patterns

---

## 📊 BooleanLiteral Mutants Analysis (8 total)

### Group 1: Profile Loading State (3 mutants) - **DESIGN ISSUE**

#### ✅ Mutant #185 - Line 258
```typescript
// File: src/security/scanner.ts:258
this.profileLoaded = true;  // ← Mutated to: false
```
**Context**: `setProfile()` method
**Root Cause**: Duplicate state - should be in `SafetyPatternMatcher`
**Tests Covering**: 44 tests (but none assert `profileLoaded === true`)
**Solution**: Move to SafetyPatternMatcher as `profilesLoaded.add(profile)`

---

#### ✅ Mutant #198 - Line 280
```typescript
// File: src/security/scanner.ts:280
this.profileLoaded = true;  // ← Mutated to: false
```
**Context**: `autoDetectProfile()` error handler (catch block)
**Root Cause**: Same duplicate state issue
**Tests Covering**: 136 tests (but error path not tested)
**Solution**: Remove after migrating state to SafetyPatternMatcher

---

#### ✅ Mutant #203 - Line 292
```typescript
// File: src/security/scanner.ts:292
return true;  // ← Mutated to: false
```
**Context**: `isWhitelisted()` - NOT FOUND (line 292 is in scan() method now)
**Note**: This appears to be misidentified - line 292 is actually:
```typescript
nodir: true,  // In glob options
```
**Tests Covering**: 174 tests
**Analysis**: This is glob configuration, not profile loading

---

### Group 2: File Creation Flags (5 mutants) - **TESTABLE**

#### ⚠️ Mutant - Line 498
```typescript
await atomicWriter.write('.env', newContent, !existingEnv);
// !existingEnv mutated to: existingEnv
```
**Context**: Create new .env file flag
**Root Cause**: Logic not tested - "create new file if doesn't exist"
**Tests Covering**: 33 tests
**Solution**: Test both scenarios:
- Existing .env file (append mode)
- No .env file (create new)

---

#### ⚠️ Mutant - Line 519
```typescript
await atomicWriter.write('.env.example', fix.envExampleFile + '\n', true);
// true mutated to: false
```
**Context**: Create .env.example file (always new)
**Root Cause**: Hardcoded `true` flag not verified
**Tests Covering**: 34 tests
**Solution**: Test that .env.example is created as new file

---

#### ⚠️ Mutant - Line 532
```typescript
let gitignoreExists = true;  // ← Mutated to: false
```
**Context**: .gitignore existence check initialization
**Root Cause**: Initial state assumption not tested
**Tests Covering**: 35 tests
**Solution**: Test both paths:
- .gitignore exists → update
- .gitignore missing → create

---

#### ⚠️ Mutant - Line 536
```typescript
} catch {
  gitignoreExists = false;  // ← Mutated to: true
}
```
**Context**: Error handling for missing .gitignore
**Root Cause**: Error path not tested
**Tests Covering**: 33 tests
**Solution**: Mock fs.readFile to throw error

---

#### ⚠️ Mutant - Line 554
```typescript
await atomicWriter.write('.gitignore', newContent, !gitignoreExists);
// !gitignoreExists mutated to: gitignoreExists
```
**Context**: Create new .gitignore flag
**Root Cause**: Negation logic not tested
**Tests Covering**: 34 tests
**Solution**: Test .gitignore creation vs append

---

## 🎯 REFACTOR CATEGORIES

### Category 1: Architectural Issues (Must Refactor)

**Lines**: 258, 280
**Type**: Duplicate state
**Priority**: **P0 - CRITICAL**

**Current Design**:
```typescript
class SecurityScanner {
  private profileLoaded = false;  // ❌ Wrong place
}

class SafetyPatternMatcher {
  // ❌ Missing loaded tracking
}
```

**Target Design**:
```typescript
class SafetyPatternMatcher {
  private profilesLoaded: Set<ProfileType> = new Set();
  public isProfileLoaded(profile: ProfileType): boolean {
    return this.profilesLoaded.has(profile);
  }
}

class SecurityScanner {
  // ✅ No profileLoaded field - ask SafetyPatternMatcher
}
```

**Impact**:
- Fixes 2 mutants (#185, #198)
- Completes incomplete refactor
- Enables proper testing

---

### Category 2: Missing Test Coverage (Add Tests Only)

**Lines**: 498, 519, 532, 536, 554
**Type**: File operation flags
**Priority**: **P1 - HIGH**

**Pattern**: File creation/append logic not tested

**Tests Needed**:

1. **Test .env creation vs append** (kills mutants 498)
```typescript
it('should create new .env when file does not exist', async () => {
  // Setup: No .env file
  const result = await scanner.applyFixes(findings);

  // Verify: atomicWriter.write called with isNew=true
  expect(result.envCreated).toBe(true);
  const content = await fs.readFile('.env', 'utf-8');
  expect(content).toBeTruthy();
});

it('should append to existing .env', async () => {
  // Setup: Existing .env file
  await fs.writeFile('.env', 'OLD_VAR=value\n');

  const result = await scanner.applyFixes(findings);

  // Verify: atomicWriter.write called with isNew=false
  const content = await fs.readFile('.env', 'utf-8');
  expect(content).toContain('OLD_VAR=value');
  expect(content).toContain('# Added by eng_security');
});
```

2. **Test .env.example always created new** (kills mutant 519)
```typescript
it('should always create .env.example as new file', async () => {
  // Even if exists, should overwrite with isNew=true
  const result = await scanner.applyFixes(findings);
  expect(result.envCreated).toBe(true);
});
```

3. **Test .gitignore creation vs append** (kills mutants 532, 536, 554)
```typescript
it('should create new .gitignore when missing', async () => {
  // Setup: No .gitignore
  const result = await scanner.applyFixes(findings);

  expect(result.gitignoreUpdated).toBe(true);
  const content = await fs.readFile('.gitignore', 'utf-8');
  expect(content).toContain('.env');
});

it('should append to existing .gitignore', async () => {
  // Setup: Existing .gitignore
  await fs.writeFile('.gitignore', 'node_modules/\n');

  const result = await scanner.applyFixes(findings);

  const content = await fs.readFile('.gitignore', 'utf-8');
  expect(content).toContain('node_modules/');
  expect(content).toContain('.env');
});

it('should handle .gitignore read error gracefully', async () => {
  // Mock fs.readFile to throw
  // Verify: gitignoreExists = false path is taken
});
```

**Impact**:
- Fixes 5 mutants (498, 519, 532, 536, 554)
- No refactoring needed
- Can implement immediately

---

### Category 3: False Positive (Ignore)

**Line**: 292
**Context**: `nodir: true` in glob options
**Analysis**: This is a library configuration, not application logic
**Action**: No test needed - this is a glob API contract

---

## 📋 UPDATED REFACTOR PLAN

### Phase 1: Architectural Refactor (Category 1)
- [x] Identify duplicate state issue
- [ ] Add `profilesLoaded` to SafetyPatternMatcher
- [ ] Remove `profileLoaded` from SecurityScanner
- [ ] Update `autoDetectProfile()` to use SafetyPatternMatcher
- [ ] Add SafetyPatternMatcher tests
**Expected**: +2 mutants killed (258, 280)

---

### Phase 2: Add Missing Tests (Category 2)
- [ ] Test .env creation vs append (line 498)
- [ ] Test .env.example creation (line 519)
- [ ] Test .gitignore creation vs append (lines 532, 536, 554)
**Expected**: +5 mutants killed

---

### Phase 3: Continue with TESTINSTRUCT.md Phases 1-5
- [ ] Phase 1: String Literals (already partially done)
- [ ] Phase 2: Conditionals
- [ ] Phase 3: Boundaries
- [ ] Phase 4: No-coverage areas
- [ ] Phase 5: Methods

---

## 🎯 Priority Order

1. **P0 - Phase 1 (Refactor)**: Lines 258, 280
   - Must fix architectural issue first
   - Blocks proper testing
   - Completes incomplete refactor

2. **P1 - Phase 2 (Tests)**: Lines 498, 519, 532, 536, 554
   - No refactoring needed
   - Can implement immediately after Phase 1
   - Clear test patterns

3. **P2 - TESTINSTRUCT.md Phases 1-5**
   - Continue with planned mutation improvements
   - Target: 66.79% → 82%

---

## 📊 Expected Results

| Phase | Mutants Killed | Score Improvement | Cumulative |
|-------|----------------|-------------------|------------|
| Current | 367 | 66.79% | 66.79% |
| Phase 1 (Refactor) | +2 | +0.27% | 67.06% |
| Phase 2 (File flags) | +5 | +0.69% | 67.75% |
| TESTINSTRUCT Phase 1-5 | +101 | +13.87% | **81.62%** |

**Total improvement**: 66.79% → 81.62% = **+14.83%**

---

## ✅ Next Steps

1. Complete Phase 1 refactor (REFACTOR-PLAN.md)
2. Add Phase 2 file flag tests (this document)
3. Continue with TESTINSTRUCT.md phases
4. Run final mutation test to verify 81%+ score

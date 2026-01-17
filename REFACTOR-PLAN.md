# REFACTOR PLAN: Scanner.ts Testability Improvements

> **Branch**: `refactor/security-scanner-architecture`
> **Date**: 2026-01-18
> **Purpose**: Complete refactoring to enable mutation testing improvements
> **Status**: ⚠️ REFACTOR INCOMPLETE - Root cause identified

---

## 🚨 ROOT CAUSE ANALYSIS

### Refactor History

**Dev Branch (Before Refactor)**:
```typescript
class PatternLoader {
  private loaded = false;  // ← State in PatternLoader
}

class SecurityScanner {
  private profileLoaded = false;  // ← Duplicate state!
}
```

**Refactor Branch (Current)**:
```typescript
// src/security/core/SafetyPatternMatcher.ts
class SafetyPatternMatcher {
  // ❌ NO `loaded` field!
  // PatternLoader.loaded was NOT migrated
}

// src/security/scanner.ts
class SecurityScanner {
  private profileLoaded = false;  // ← Still here, still private
}
```

### What Went Wrong

The refactor (commits f381e4a → 87e8dc7):
1. ✅ Extracted PatternLoader → SafetyPatternMatcher
2. ✅ Moved pattern loading logic
3. ❌ **FORGOT to migrate `loaded` state**
4. ❌ Left `profileLoaded` in SecurityScanner (duplicate state)

**Result**: State management is split and untestable

---

## 🎯 CORRECT SOLUTION

### Design Principle
> "Single Source of Truth" - Pattern loading state should live where patterns are managed

**SafetyPatternMatcher** owns pattern loading → should own `loaded` state

---

## 📊 Current Mutation Testing Status

**Overall Score**: 66.79% (367 killed / 140 survived / 43 no-coverage)
**Total Mutants**: 728

### Mutant Distribution
| Type | Count | Notes |
|------|-------|-------|
| StringLiteral | 51 survived | Error messages, formatting |
| ConditionalExpression | 32 survived | Branch coverage gaps |
| EqualityOperator | 16 survived | Boundary conditions |
| MethodExpression | 9 survived | Array/string methods |
| **BooleanLiteral** | **8 survived** | **⚠️ BLOCKED BY PRIVATE ACCESS** |
| ArrayDeclaration | 7 survived | Array initialization |
| BlockStatement | 6 survived | Empty blocks |
| Regex | 5 survived | Pattern matching |

---

## ❌ Problem: BooleanLiteral Mutants Cannot Be Tested

### Identified Mutants Blocked by Private Access

#### Mutant #185 - Line 258
```typescript
// Location: src/security/scanner.ts:258
this.profileLoaded = true;  // ← Mutated to: false

// Context: setProfile() method
async setProfile(profile: ProfileType): Promise<void> {
  this.currentProfile = profile;
  // ... load patterns ...
  this.profileLoaded = true;  // ← SURVIVED MUTANT
}
```
- **Status**: Survived
- **Reason**: `profileLoaded` is `private` → tests cannot verify it's set to `true`
- **Tests Covered By**: 44 tests touch this code, but none assert `profileLoaded === true`

#### Mutant #198 - Line 280
```typescript
// Location: src/security/scanner.ts:280
this.profileLoaded = true;  // ← Mutated to: false

// Context: autoDetectProfile() error handler
private async autoDetectProfile(): Promise<void> {
  if (this.profileLoaded) return;
  try {
    // ... detect profile ...
  } catch {
    this.profileLoaded = true;  // ← SURVIVED MUTANT (fallback)
  }
}
```
- **Status**: Survived
- **Reason**: Error path + `profileLoaded` is `private` → double barrier to testing
- **Tests Covered By**: 136 tests execute this code, but none verify error fallback behavior

#### Mutant #203 - Line 292
```typescript
// Location: src/security/scanner.ts:292
return true;  // ← Mutated to: false

// Context: isWhitelisted() return value
private isWhitelisted(filePath: string): boolean {
  // ... whitelist logic ...
  return true;  // ← SURVIVED MUTANT
}
```
- **Status**: Survived
- **Reason**: Method is `private` → cannot be tested directly
- **Tests Covered By**: 174 tests execute this, but only test side effects, not return value

---

## ✅ Solution: Refactor for Testability

### Change Summary

Make critical internal state accessible for testing:

1. **profileLoaded** (lines 258, 280): `private` → `public`
2. **isWhitelisted()** (line 292): `private` → `public` OR extract to SafetyPatternMatcher

### Rationale

Per the original refactor plan (commit f381e4a):
> "SecurityScanner will become coordinator/orchestrator - Thin layer, easy to test"

**Making state public for testing is acceptable when**:
- It enables mutation testing coverage
- The class is a "thin coordinator" (not a God class)
- Alternative (getters) adds unnecessary boilerplate

---

## 📋 REVISED Implementation Plan

### ❌ REJECTED: Quick Fix (Make profileLoaded Public)

**Why rejected**:
- Doesn't fix root cause (duplicate state)
- Violates encapsulation
- Leaves incomplete refactor in place
- Technical debt accumulation

### ✅ CORRECT APPROACH: Complete the Refactor

---

## Phase 1: Move `loaded` State to SafetyPatternMatcher

**Goal**: Complete the incomplete refactor from commits f381e4a → 87e8dc7

### Step 1.1: Add `loaded` tracking to SafetyPatternMatcher

**File**: `src/security/core/SafetyPatternMatcher.ts`

**Add field**:
```typescript
export class SafetyPatternMatcher {
  private profilePatterns: Map<string, SafetyPattern[]> = new Map();
  private customPatterns: SafetyPattern[] = [];
  private whitelist: Set<string> = new Set();
  private profilesLoaded: Set<ProfileType> = new Set();  // ← ADD THIS
```

**Add public getter**:
```typescript
  /**
   * Check if a profile has been loaded
   * Public for testing and status checks
   */
  public isProfileLoaded(profile: ProfileType): boolean {
    return this.profilesLoaded.has(profile);
  }
```

**Update loadPatterns() to track**:
```typescript
  async loadPatterns(profile: ProfileType): Promise<SafetyPattern[]> {
    if (profile === 'unknown') return [];

    // Check cache
    if (this.profilePatterns.has(profile)) {
      return this.profilePatterns.get(profile) ?? [];
    }

    const patterns: SafetyPattern[] = [];
    // ... existing loading logic ...

    this.profilePatterns.set(profile, patterns);
    this.profilesLoaded.add(profile);  // ← MARK AS LOADED
    return patterns;
  }
```

### Step 1.2: Remove `profileLoaded` from SecurityScanner

**File**: `src/security/scanner.ts`

**Remove**:
```typescript
// BEFORE:
private currentProfile: ProfileType = 'unknown';
private safetyPatterns: SafetyPattern[] = [];
private profileLoaded = false;  // ← DELETE THIS

// AFTER:
private currentProfile: ProfileType = 'unknown';
private safetyPatterns: SafetyPattern[] = [];
```

**Update setProfile()**:
```typescript
async setProfile(profile: ProfileType): Promise<void> {
  this.currentProfile = profile;

  const profilePatterns = await safetyPatternMatcher.loadPatterns(profile);
  const customPatterns = await safetyPatternMatcher.loadCustomPatterns(this.workingDir);

  // Merge safety patterns
  const safetyMap = new Map<string, SafetyPattern>();
  for (const p of profilePatterns) {
    safetyMap.set(p.name, p);
  }
  for (const p of customPatterns) {
    safetyMap.set(p.name, p);
  }

  this.safetyPatterns = Array.from(safetyMap.values());
  // ❌ DELETE: this.profileLoaded = true;
  // ✅ State is now in SafetyPatternMatcher
}
```

**Update autoDetectProfile()**:
```typescript
private async autoDetectProfile(): Promise<void> {
  // Check if profile already loaded via SafetyPatternMatcher
  if (safetyPatternMatcher.isProfileLoaded(this.currentProfile)) {
    return;
  }

  try {
    const configPath = path.join(this.workingDir, '.engineering', 'config.yaml');
    const content = await fs.readFile(configPath, 'utf-8');
    const config = parse(content) as { projectType?: string };

    if (config.projectType) {
      const { getProfileType } = await import('../types/index.js');
      const profile = getProfileType(config.projectType as any);
      await this.setProfile(profile);
    }
  } catch {
    // ❌ DELETE: this.profileLoaded = true;
    // No-op: if config missing, scanner works with empty patterns
  }
}
```

---

## Phase 2: Update Tests to Use SafetyPatternMatcher

### Step 2.1: Add SafetyPatternMatcher tests

**File**: `tests/unit/security/core/SafetyPatternMatcher.test.ts`

**Add test**:
```typescript
describe('isProfileLoaded()', () => {
  it('should return false before profile is loaded', () => {
    const matcher = new SafetyPatternMatcher();
    expect(matcher.isProfileLoaded('embedded')).toBe(false);
  });

  it('should return true after profile is loaded', async () => {
    const matcher = new SafetyPatternMatcher();
    await matcher.loadPatterns('embedded');
    expect(matcher.isProfileLoaded('embedded')).toBe(true);  // ← Kills mutant
  });

  it('should track multiple profiles independently', async () => {
    const matcher = new SafetyPatternMatcher();
    await matcher.loadPatterns('embedded');

    expect(matcher.isProfileLoaded('embedded')).toBe(true);
    expect(matcher.isProfileLoaded('web')).toBe(false);  // Not loaded yet
  });
});
```

### Step 2.2: Update SecurityScanner tests

**File**: `tests/unit/security/scanner.test.ts`

**Remove** tests that directly access `scanner.profileLoaded` (won't exist anymore)

**Add** behavior tests:
```typescript
describe('Phase 1.3: Profile Loading Behavior Tests', () => {
  it('should load profile via setProfile', async () => {
    await scanner.setProfile('embedded');

    // Verify profile is set
    const info = scanner.getProfileInfo();
    expect(info.profile).toBe('embedded');
    expect(info.safetyPatternCount).toBeGreaterThan(0);

    // Verify idempotent (calling again doesn't re-load)
    const initialPatterns = info.safetyPatternCount;
    await scanner.setProfile('embedded');
    const info2 = scanner.getProfileInfo();
    expect(info2.safetyPatternCount).toBe(initialPatterns);
  });

  it('should handle missing config gracefully', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scanner-no-config-'));
    const testScanner = new SecurityScanner(tempDir);

    try {
      // Should not throw
      const findings = await testScanner.scan();
      expect(findings).toBeDefined();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
```

---

## Phase 3: Add Missing Boolean Tests (File Creation Flags)

**Goal**: Kill 5 additional BooleanLiteral mutants (lines 498, 519, 532, 536, 554)

**Context**: File operation flags (`!existingEnv`, `!gitignoreExists`, etc.) are not tested

### Test Cases to Add

**File**: `tests/unit/security/scanner.test.ts`

```typescript
describe('Phase 3: File Creation Flag Tests', () => {
  it('should create new .env when file does not exist', async () => {
    // Target: Line 498 - !existingEnv flag
    await writeTestFile(
      path.join(tempDir, 'test.ts'),
      `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
    );

    const findings = await scanner.scan();
    const result = await scanner.applyFixes(findings);

    expect(result.success).toBe(true);
    expect(result.envCreated).toBe(true);

    const envContent = await fs.readFile(path.join(tempDir, '.env'), 'utf-8');
    expect(envContent).toContain('AWS_ACCESS_KEY=');
  });

  it('should append to existing .env file', async () => {
    // Target: Line 498 - !existingEnv flag (append mode)
    await writeTestFile(path.join(tempDir, '.env'), 'OLD_VAR=value\n');
    await writeTestFile(
      path.join(tempDir, 'test.ts'),
      `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
    );

    const findings = await scanner.scan();
    const result = await scanner.applyFixes(findings);

    const envContent = await fs.readFile(path.join(tempDir, '.env'), 'utf-8');
    expect(envContent).toContain('OLD_VAR=value');
    expect(envContent).toContain('# Added by eng_security --fix');
  });

  it('should create .env.example as new file', async () => {
    // Target: Line 519 - true flag (always create new)
    await writeTestFile(
      path.join(tempDir, 'test.ts'),
      `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
    );

    const findings = await scanner.scan();
    const result = await scanner.applyFixes(findings);

    const exampleExists = await fs.access(path.join(tempDir, '.env.example'))
      .then(() => true)
      .catch(() => false);
    expect(exampleExists).toBe(true);
  });

  it('should create new .gitignore when missing', async () => {
    // Target: Lines 532, 536, 554 - gitignoreExists logic
    await writeTestFile(
      path.join(tempDir, 'test.ts'),
      `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
    );

    const findings = await scanner.scan();
    const result = await scanner.applyFixes(findings);

    expect(result.gitignoreUpdated).toBe(true);
    const gitignoreContent = await fs.readFile(
      path.join(tempDir, '.gitignore'),
      'utf-8'
    );
    expect(gitignoreContent).toContain('.env');
  });

  it('should append to existing .gitignore', async () => {
    // Target: Lines 532, 536, 554 - gitignoreExists append mode
    await writeTestFile(path.join(tempDir, '.gitignore'), 'node_modules/\n');
    await writeTestFile(
      path.join(tempDir, 'test.ts'),
      `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
    );

    const findings = await scanner.scan();
    const result = await scanner.applyFixes(findings);

    const gitignoreContent = await fs.readFile(
      path.join(tempDir, '.gitignore'),
      'utf-8'
    );
    expect(gitignoreContent).toContain('node_modules/');
    expect(gitignoreContent).toContain('.env');
  });
});
```

**Impact**:
- Kills 5 BooleanLiteral mutants (498, 519, 532, 536, 554)
- No refactoring needed
- Improvement: +0.69% (5/728)

---

## 📊 Complete Implementation Summary

| Phase | Changes | Mutants Killed | Score Improvement |
|-------|---------|----------------|-------------------|
| **Phase 1** | Refactor profileLoaded → SafetyPatternMatcher | 2 (#185, #198) | +0.27% |
| **Phase 2** | Add SafetyPatternMatcher tests | 0 (enables Phase 1) | 0% |
| **Phase 3** | Add file flag tests | 5 (498, 519, 532, 536, 554) | +0.69% |
| **TESTINSTRUCT Phases 1-5** | String/Conditional/Boundary tests | ~101 | +13.87% |
| **TOTAL** | | **~108** | **+14.83%** |

**Final Expected Score**: 66.79% + 14.83% = **~81.62%** 🎯

---

## ✅ Implementation Checklist

### Phase 1: Architectural Refactor
- [ ] Step 1.1: Add `profilesLoaded` to SafetyPatternMatcher
- [ ] Step 1.2: Remove `profileLoaded` from SecurityScanner
- [ ] Step 1.3: Update `autoDetectProfile()` logic
- [ ] Verify all existing tests pass

### Phase 2: SafetyPatternMatcher Tests
- [ ] Add `isProfileLoaded()` tests
- [ ] Update SecurityScanner behavior tests
- [ ] Run mutation test on SafetyPatternMatcher.ts

### Phase 3: File Flag Tests
- [ ] Add .env creation/append tests
- [ ] Add .env.example creation test
- [ ] Add .gitignore creation/append tests
- [ ] Run mutation test on scanner.ts

### TESTINSTRUCT.md Phases
- [ ] Phase 1: String Literals & Booleans (partially done)
- [ ] Phase 2: Conditionals
- [ ] Phase 3: Boundaries
- [ ] Phase 4: No-coverage areas
- [ ] Phase 5: Method operations

### Final Verification
- [ ] All 539+ tests passing
- [ ] Mutation score ≥ 81%
- [ ] No TypeScript errors
- [ ] Commit with detailed message

---

## Phase 1 (WRONG - Make profileLoaded Public) ❌ REJECTED

**File**: `src/security/scanner.ts:232`

**Before**:
```typescript
private currentProfile: ProfileType = 'unknown';
private safetyPatterns: SafetyPattern[] = [];
private profileLoaded = false;  // ← PRIVATE
```

**After**:
```typescript
private currentProfile: ProfileType = 'unknown';
private safetyPatterns: SafetyPattern[] = [];
public profileLoaded = false;   // ← PUBLIC
```

**Impact**:
- Kills mutants #185, #198 (lines 258, 280)
- Enables Phase 1.3 tests in TESTINSTRUCT.md
- Expected mutation score improvement: +1.1% (2/728 * 66.79%)

**Tests to Add** (Phase 1.3):
```typescript
it('should set profileLoaded to true after setProfile', async () => {
  // Target: Line 258 - this.profileLoaded = true
  expect(scanner.profileLoaded).toBe(false);
  await scanner.setProfile('embedded');
  expect(scanner.profileLoaded).toBe(true);  // ← Kills mutant #185
});

it('should mark profileLoaded on autoDetect error fallback', async () => {
  // Target: Line 280 - this.profileLoaded = true in catch
  const invalidScanner = new SecurityScanner('/nonexistent/path');
  expect(invalidScanner.profileLoaded).toBe(false);
  await invalidScanner.scan();  // Triggers autoDetect → catch block
  expect(invalidScanner.profileLoaded).toBe(true);  // ← Kills mutant #198
});
```

---

### Phase 2: Refactor isWhitelisted() (Optional - Lower Priority)

**Option A**: Make public (quick fix)
```typescript
public isWhitelisted(filePath: string): boolean {
  // ... existing logic ...
}
```

**Option B**: Extract to SafetyPatternMatcher (better design)
```typescript
// In SafetyPatternMatcher.ts
isWhitelisted(filePath: string, whitelist: Set<string>): boolean {
  // ... move logic here ...
}

// In scanner.ts
const isWhitelisted = safetyPatternMatcher.isWhitelisted(
  filePath,
  this.whitelist
);
```

**Recommendation**: Option B - aligns with refactor plan, better separation of concerns

**Impact**:
- Kills mutant #203 (line 292)
- Additional improvement: +0.14%

---

## 📊 Expected Results After Refactor

| Metric | Before | After Phase 1 | After Phase 2 |
|--------|--------|---------------|---------------|
| **Mutation Score** | 66.79% | 67.9% | 68.04% |
| **BooleanLiteral Survived** | 8 | 6 | 5 |
| **Total Survived** | 140 | 138 | 137 |

**Combined with TESTINSTRUCT.md Phase 1-5**:
- Current: 66.79%
- After refactor + Phase 1: 67.9%
- After full Phase 1-5 implementation: **~82%** (target)

---

## 🔄 Rollback Plan

If refactor causes issues:

1. Revert `public profileLoaded` → `private profileLoaded`
2. Remove Phase 1.3 tests
3. Fall back to behavior-based testing (indirect testing via side effects)

**Trade-off**: Lower mutation coverage, but code remains encapsulated

---

## ✅ Acceptance Criteria

- [ ] Phase 1: `profileLoaded` is public
- [ ] Phase 1.3 tests added and passing
- [ ] All 539 existing tests still pass
- [ ] Mutation score improves by +1.1% minimum
- [ ] TypeScript compilation succeeds
- [ ] No breaking changes to public API

---

## 📝 Notes

### Why Not Use Getters?

**Considered**:
```typescript
isProfileLoaded(): boolean {
  return this.profileLoaded;
}
```

**Rejected because**:
- Adds 3 lines of boilerplate
- No real encapsulation benefit (thin coordinator class)
- Still exposes same information, just via method call
- Tests would be identical: `expect(scanner.isProfileLoaded()).toBe(true)`

### Alternative: Modify getProfileInfo()

**Considered**:
```typescript
getProfileInfo(): {
  profile: ProfileType;
  safetyPatternCount: number;
  loaded: boolean;  // ← ADD THIS
}
```

**Rejected because**:
- Changes existing return type (breaking change)
- May break existing code that destructures return value
- More invasive than making field public

---

## 🎯 Next Steps

1. Execute Phase 1 refactor (make `profileLoaded` public)
2. Update Phase 1.3 tests in scanner.test.ts
3. Run `npm test` to verify all tests pass
4. Run mutation test: `npx stryker run --mutate "src/security/scanner.ts"`
5. Verify mutation score improvement
6. Commit with message: `refactor: make profileLoaded public for mutation testing`
7. Proceed with Phase 2-5 of TESTINSTRUCT.md

---

**Questions?** Review this plan before proceeding with implementation.

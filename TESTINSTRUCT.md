📋 COMPREHENSIVE MUTATION TESTING IMPROVEMENT PLAN
Summary of Current State
Current mutation score: 66.79% (367 killed / 140 survived / 43 no-coverage)
Total mutants: 550 mutants
Top 3 problem functions:
applyFixes() - 71 survived (50.7%)
generateCodeReplacement() - 37 survived (26.4%)
generateFixes() - 19 survived (13.6%)
Top Mutant Types to Kill
StringLiteral: 51 survived - Empty strings, error messages, formatting
ConditionalExpression: 32 survived - Branch coverage gaps
EqualityOperator: 16 survived - Boundary conditions
🎯 PHASE 1: Quick Wins - Target String Literals & Booleans (Est: +5-8%)
1.1 applyFixes() String Literals (22 mutants)
Target Lines: 418, 452, 454, 455, 493, 495, 496, 497

Test Cases to Add:


// Test error message formatting
it('should format blocked files error message correctly', async () => {
  // Setup: Create file in node_modules to trigger blocking
  // Assert: Check exact error message format with newlines and formatting
});

// Test force flag message formatting  
it('should format requiresForce summary with file list', async () => {
  // Setup: 6 files to trigger force requirement
  // Assert: Check exact summary message format, file list formatting
});

// Test env file string operations
it('should handle existingEnv with trailing whitespace', async () => {
  // Setup: .env with trailing spaces/newlines
  // Assert: trimEnd() is used, not trimStart()
});

it('should format env file comment header correctly', async () => {
  // Assert: Check "# Added by eng_security --fix\n" exact format
});
1.2 generateCodeReplacement() String Literals (22 mutants)
Target Lines: 819-900

Test Cases to Add:


// Test language-specific formatting
it('should generate Python replacement with correct spacing', async () => {
  // Test os.getenv() format vs os.getenv () with space
});

it('should generate Go replacement with correct capitalization', async () => {
  // Test os.Getenv vs os.GetEnv
});

it('should generate Rust replacement with expect message', async () => {
  // Test env::var().expect("msg") format
});

// Test edge cases
it('should handle file extension case sensitivity', async () => {
  // Test .JS vs .js, .PY vs .py
});
1.3 Boolean Literals (8 mutants)
Target Lines: 258, 280, 292, 498

Test Cases to Add:


it('should set profileLoaded to true after setProfile', async () => {
  await scanner.setProfile('embedded');
  const info = scanner.getProfileInfo();
  // Verify profileLoaded is actually used in logic
});

it('should mark profileLoaded on autoDetect error', async () => {
  // Verify line 280: this.profileLoaded = true in catch block
});
Estimated kills: 52 mutants (StringLiteral: 44, BooleanLiteral: 8)
Estimated improvement: +6.5% (52/550 * 66.79%)

🎯 PHASE 2: Conditional Coverage - Branch Completeness (Est: +4-6%)
2.1 applyFixes() Conditionals (16 mutants)
Target Lines: 441, 449, 467, 476, 485, 486, 491

Test Cases to Add:


// Line 441: if (blockedFiles.length > 0)
it('should add error when blockedFiles is exactly 1', async () => {
  // Test boundary: length === 1 vs length > 1
});

it('should not add error when blockedFiles is empty', async () => {
  // Test: length === 0
});

// Line 449: if (requiresForceFlag() && !options.force)
it('should proceed when force=true even with many files', async () => {
  // Test: requiresForceFlag=true, options.force=true
});

it('should proceed when files=5 without force', async () => {
  // Test boundary: exactly at limit
});

// Line 467-471: Try-catch for existing .env
it('should handle .env read permission error', async () => {
  // Test: fs.readFile throws permission error
  // Verify empty string fallback
});

// Line 476, 485: Regex matching env vars
it('should handle malformed env var names', async () => {
  // Test: Invalid names like "123VAR=", "var-name="
  // Verify regex correctly filters these
});

it('should match env vars with numbers correctly', async () => {
  // Test: "API_KEY_123=" should match
});

// Line 486: if (match?.[1] && !existingVars.has())
it('should skip duplicate env vars correctly', async () => {
  // Test: .env already has "API_KEY="
  // Verify it's not added again
});

// Line 491: if (newEnvLines.length > 0)
it('should skip env creation when all vars exist', async () => {
  // Test: All env vars already in .env
  // Verify no write occurs
});
2.2 generateFixes() Conditionals (7 mutants)
Target Lines: 697, 706, 725

Test Cases to Add:


// Line 697: Check for multi-language imports
it('should include import section when Python+Go files exist', async () => {
  // Test: Mix of .py and .go files
});

// Line 706: Check for specific language presence  
it('should not include C# import when only JS files', async () => {
  // Test: Only .js/.ts files
});

// Line 725: Array operations
it('should handle empty codeReplacements array', async () => {
  // Test: No replacements needed
});
Estimated kills: 23 mutants (ConditionalExpression: 23)
Estimated improvement: +3.1%

🎯 PHASE 3: Equality & Boundary Conditions (Est: +2-3%)
3.1 Boundary Conditions (16 mutants)
Target Lines: 321, 378, 449

Test Cases to Add:


// Line 321: lineNum < lines.length (loop boundary)
it('should scan last line of file correctly', async () => {
  // Test: File with content on last line (no trailing newline)
  // Verify lineNum === lines.length - 1 is processed
});

// Line 378: secret.length <= 8
it('should mask secret with exactly 8 characters', async () => {
  // Test boundary: length === 8
});

it('should mask secret with exactly 9 characters', async () => {
  // Test boundary: length === 9
});

// Line 449: safeFiles.length > MAX_FILES_WITHOUT_FORCE
it('should not require force with exactly 5 files', async () => {
  // Test: length === MAX_FILES_WITHOUT_FORCE
});

it('should require force with exactly 6 files', async () => {
  // Test: length === MAX_FILES_WITHOUT_FORCE + 1
});
3.2 Array & Method Operations (16 mutants)
Target Lines: 413, 455, 461, 493, 725

Test Cases to Add:


// Line 413: filesBlocked: []
it('should initialize empty filesBlocked array', async () => {
  // Verify array starts empty, not undefined
});

// Line 461: filter() method
it('should filter replacements correctly with Set', async () => {
  // Test: Some files safe, some blocked
  // Verify only safe files in result
});

// Line 493: trimEnd() vs trimStart()
it('should preserve leading whitespace in env file', async () => {
  // Test: existingEnv = "\n\nKEY=val"
  // Verify trimEnd() not trimStart()
});
Estimated kills: 16 mutants
Estimated improvement: +2.1%

🎯 PHASE 4: No-Coverage Areas (Est: +4-5%)
4.1 Identify No-Coverage Lines
Focus areas (43 no-coverage mutants):

Error handling catch blocks
Edge cases in regex patterns
Rare file extension branches
Test Cases to Add:


// Error paths
it('should handle fs.writeFile error in applyFixes', async () => {
  // Mock fs.writeFile to throw
  // Verify rollback is called
});

it('should handle invalid YAML in custom patterns', async () => {
  // Test: Malformed YAML in custom.yaml
  // Verify graceful skip
});

// Rare file extensions
it('should handle .mjs files correctly', async () => {
  // Test: ES module .mjs extension
});

it('should handle .cjs files correctly', async () => {
  // Test: CommonJS .cjs extension
});

it('should handle unknown file extensions', async () => {
  // Test: .xyz file
  // Verify default fallback
});

// Regex edge cases
it('should handle regex with special characters in patterns', async () => {
  // Test: Patterns with \, *, +, ? in actual code
});
Estimated kills: 20-25 mutants
Estimated improvement: +3.6-4.5%

🎯 PHASE 5: Method & Logic Operations (Est: +1-2%)
5.1 Method Expression Mutants (9 mutants)
Target: Array methods, string methods

Test Cases to Add:


// Method chaining
it('should handle map().join() correctly in error formatting', async () => {
  // Verify exact chaining order matters
});

// String methods
it('should use correct string casing methods', async () => {
  // toLowerCase() vs toUpperCase()
});
Estimated kills: 5-7 mutants
Estimated improvement: +0.9-1.3%

📊 PROJECTED RESULTS
Phase	Target Mutants	Est. Kill Rate	Score Improvement
Phase 1: Strings & Booleans	52	90% (47)	+6.5%
Phase 2: Conditionals	23	85% (20)	+3.1%
Phase 3: Boundaries	16	80% (13)	+2.1%
Phase 4: No-Coverage	25	60% (15)	+2.7%
Phase 5: Methods	9	70% (6)	+1.0%
TOTAL	125	81% (101)	+15.4%
Projected final score: 66.79% + 15.4% = ~82% 🎯

📝 IMPLEMENTATION CHECKLIST
Pre-Implementation
 Analyze mutation report JSON
 Identify top 3 problem functions
 Group mutants by type and line range
 Create test file structure plan
Phase-by-Phase Implementation
 Phase 1: Add 12 tests for string literals & booleans
 Run mutation test → Verify +6-7% improvement
 Phase 2: Add 10 tests for conditionals
 Run mutation test → Verify +3% improvement
 Phase 3: Add 8 tests for boundaries
 Run mutation test → Verify +2% improvement
 Phase 4: Add 10 tests for no-coverage areas
 Run mutation test → Verify +3-4% improvement
 Phase 5: Add 5 tests for method operations
 Run mutation test → Verify +1% improvement
Post-Implementation
 Final mutation test run on full scanner.ts
 Generate final report
 Commit with message: "test: improve scanner.ts mutation score to 82%"
 Update refactor branch with improvements
🔧 TEST WRITING GUIDELINES
Target Specificity: Each test should kill 1-3 specific mutants
Assertions: Test exact strings, not just "contains" - kills StringLiteral mutants
Boundary Testing: Test n-1, n, n+1 for all numeric comparisons
Branch Coverage: Ensure both if/else paths are tested
Error Paths: Use mocks/stubs to force error conditions
Regex Testing: Test valid + invalid patterns, edge cases
💾 FILES TO MODIFY
tests/unit/security/scanner.test.ts - Add ~45 new test cases
analyze-mutations.cjs - Keep for future analysis
show-mutants.cjs - Keep for debugging specific ranges
Bây giờ chúng ta đã có complete plan. Khi context mới, tôi sẽ bắt đầu implement Phase 1 với 12 targeted tests để kill 47 string/boolean mutants và improve score lên ~73%. Sau đó tiếp tục Phase 2-5.
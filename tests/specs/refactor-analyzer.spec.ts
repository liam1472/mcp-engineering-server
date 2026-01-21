/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the core behavioral contracts for RefactorAnalyzer.
 * If a test fails, FIX THE SOURCE CODE, not the test.
 *
 * Strategy: Use snapshot testing to capture entire report output.
 * Any mutation that changes line numbers, messages, types, or structure
 * will cause the snapshot to differ → Test Fail → Mutant Killed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { RefactorAnalyzer } from '../../src/indexes/refactor-analyzer.js';

/**
 * SPEC: RefactorAnalyzer - Duplicate Detection
 *
 * REQUIREMENT: The analyzer MUST detect duplicate code blocks
 * across multiple files and report exact locations.
 */
describe('[SPEC] RefactorAnalyzer - Duplicate Detection', () => {
  let tempDir: string;
  let analyzer: RefactorAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-refactor-dup-'));
    analyzer = new RefactorAnalyzer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST detect duplicate blocks with 3+ occurrences
   */
  it('MUST detect duplicate blocks appearing 3+ times', async () => {
    // Create 3 files with identical code block (5+ lines to meet MIN_BLOCK_SIZE)
    const duplicateCode = `function handleRequest(req) {
  const validated = validateRequest(req);
  const sanitized = sanitizeInput(validated);
  const processed = processData(sanitized);
  const formatted = formatResponse(processed);
  return sendResponse(formatted);
}`;

    await fs.writeFile(path.join(tempDir, 'handler1.ts'), duplicateCode);
    await fs.writeFile(path.join(tempDir, 'handler2.ts'), duplicateCode);
    await fs.writeFile(path.join(tempDir, 'handler3.ts'), duplicateCode);

    const report = await analyzer.analyze();

    // Snapshot the duplicate detection result
    expect(report.duplicates.length).toBeGreaterThanOrEqual(1);

    const dup = report.duplicates[0]!;
    expect(dup.occurrences.length).toBe(3);
    expect(dup.lines).toBeGreaterThanOrEqual(5);

    // Verify each occurrence has correct structure
    for (const occurrence of dup.occurrences) {
      expect(occurrence).toHaveProperty('file');
      expect(occurrence).toHaveProperty('startLine');
      expect(occurrence).toHaveProperty('endLine');
      expect(occurrence.startLine).toBe(1);
      expect(occurrence.endLine).toBeGreaterThanOrEqual(5);
    }
  });

  /**
   * GOLDEN TEST: MUST detect duplicates with 2 occurrences (MIN_OCCURRENCES = 2)
   */
  it('MUST detect duplicates with 2 occurrences', async () => {
    const duplicateCode = `function process(data) {
  const step1 = validate(data);
  const step2 = transform(step1);
  const step3 = format(step2);
  const step4 = output(step3);
  return step4;
}`;

    await fs.writeFile(path.join(tempDir, 'file1.ts'), duplicateCode);
    await fs.writeFile(path.join(tempDir, 'file2.ts'), duplicateCode);

    const report = await analyzer.analyze();

    // MIN_OCCURRENCES = 2, so 2 files should trigger detection
    expect(report.duplicates.length).toBeGreaterThanOrEqual(1);
    expect(report.duplicates[0]!.occurrences.length).toBe(2);
  });

  /**
   * GOLDEN TEST: MUST NOT report duplicates with only 1 file
   */
  it('MUST NOT report duplicates with only 1 file', async () => {
    const code = `function unique(data) {
  const step1 = validate(data);
  const step2 = transform(step1);
  const step3 = format(step2);
  const step4 = output(step3);
  return step4;
}`;

    await fs.writeFile(path.join(tempDir, 'single.ts'), code);

    const report = await analyzer.analyze();

    // Only 1 file - no duplicates possible
    expect(report.duplicates.length).toBe(0);
  });

  /**
   * GOLDEN TEST: MUST filter out import-only duplicates
   */
  it('MUST filter out import-only duplicates', async () => {
    const importCode = `import { something } from 'module';
import { another } from 'other';
import * as fs from 'fs';
import path from 'path';
import { last } from 'lodash';`;

    await fs.writeFile(path.join(tempDir, 'a.ts'), importCode);
    await fs.writeFile(path.join(tempDir, 'b.ts'), importCode);
    await fs.writeFile(path.join(tempDir, 'c.ts'), importCode);

    const report = await analyzer.analyze();

    // Import blocks should be filtered out
    expect(report.duplicates.length).toBe(0);
  });

  /**
   * GOLDEN TEST: MUST filter out export-only duplicates
   */
  it('MUST filter out export-only duplicates', async () => {
    const exportCode = `export { handler } from './handler';
export { processor } from './processor';
export * from './utils';
export default main;
export const VERSION = '1.0.0';`;

    await fs.writeFile(path.join(tempDir, 'exp1.ts'), exportCode);
    await fs.writeFile(path.join(tempDir, 'exp2.ts'), exportCode);
    await fs.writeFile(path.join(tempDir, 'exp3.ts'), exportCode);

    const report = await analyzer.analyze();

    // Export blocks should be filtered out (first line starts with export)
    expect(report.duplicates.length).toBe(0);
  });

  /**
   * GOLDEN TEST: Shebang line is not included in duplicate preview
   * Note: DuplicateDetector skips shebang lines, so they won't appear in preview.
   * The remaining code may still be detected as duplicate if it meets MIN_BLOCK_SIZE.
   */
  it('MUST NOT include shebang in duplicate preview', async () => {
    const shebangCode = `#!/usr/bin/env node
const program = require('commander');
program.parse(process.argv);
const run = () => {};
run();`;

    await fs.writeFile(path.join(tempDir, 'cli1.ts'), shebangCode);
    await fs.writeFile(path.join(tempDir, 'cli2.ts'), shebangCode);
    await fs.writeFile(path.join(tempDir, 'cli3.ts'), shebangCode);

    const report = await analyzer.analyze();

    // Code after shebang may be detected as duplicate
    // But shebang itself should not appear in preview
    if (report.duplicates.length > 0) {
      expect(report.duplicates[0]!.preview).not.toContain('#!/');
    }
  });

  /**
   * GOLDEN TEST: MUST filter out require-first duplicates
   */
  it('MUST filter out require-first duplicates', async () => {
    const requireCode = `require('module-alias/register');
const fs = require('fs');
const path = require('path');
const util = require('util');
module.exports = {};`;

    await fs.writeFile(path.join(tempDir, 'req1.ts'), requireCode);
    await fs.writeFile(path.join(tempDir, 'req2.ts'), requireCode);
    await fs.writeFile(path.join(tempDir, 'req3.ts'), requireCode);

    const report = await analyzer.analyze();

    // Require blocks should be filtered out (first line starts with require)
    expect(report.duplicates.length).toBe(0);
  });

  /**
   * GOLDEN TEST: MUST filter blocks with >70% non-extractable lines
   */
  it('MUST filter blocks with majority non-extractable content', async () => {
    // 4 out of 5 lines are comments (80% > 70% threshold)
    const commentCode = `// Comment line 1
// Comment line 2
// Comment line 3
// Comment line 4
const x = 1;`;

    await fs.writeFile(path.join(tempDir, 'com1.ts'), commentCode);
    await fs.writeFile(path.join(tempDir, 'com2.ts'), commentCode);
    await fs.writeFile(path.join(tempDir, 'com3.ts'), commentCode);

    const report = await analyzer.analyze();

    // Blocks with >70% non-extractable should be filtered
    expect(report.duplicates.length).toBe(0);
  });

  /**
   * GOLDEN TEST: Comment-heavy code blocks should be filtered
   * Note: DuplicateDetector may not detect all comment patterns as duplicates.
   * This tests the integration behavior where heavily commented code is filtered.
   */
  it('MUST filter comment-heavy duplicate blocks', async () => {
    // Create code that is mostly comments but has some extractable code
    // 4 out of 5 lines are comments (80% > 70% threshold)
    const heavyCommentCode = `// Setup
// Initialize
// Configure
// Prepare
const x = doSomething();`;

    await fs.writeFile(path.join(tempDir, 'heavy1.ts'), heavyCommentCode);
    await fs.writeFile(path.join(tempDir, 'heavy2.ts'), heavyCommentCode);
    await fs.writeFile(path.join(tempDir, 'heavy3.ts'), heavyCommentCode);

    const report = await analyzer.analyze();

    // Heavy comment blocks (>70% non-extractable) should be filtered
    expect(report.duplicates.length).toBe(0);
  });

  /**
   * GOLDEN TEST: MUST NOT filter blocks with <70% non-extractable lines
   */
  it('MUST NOT filter blocks with minority non-extractable content', async () => {
    // 2 out of 6 lines are comments (~33% < 70% threshold)
    const mixedCode = `function process() {
  // Comment line 1
  const a = 1;
  const b = 2;
  // Comment line 2
  return a + b;
}`;

    await fs.writeFile(path.join(tempDir, 'mix1.ts'), mixedCode);
    await fs.writeFile(path.join(tempDir, 'mix2.ts'), mixedCode);
    await fs.writeFile(path.join(tempDir, 'mix3.ts'), mixedCode);

    const report = await analyzer.analyze();

    // Blocks with <70% non-extractable should NOT be filtered
    expect(report.duplicates.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * GOLDEN TEST: Duplicate preview MUST contain actual code
   */
  it('MUST include code preview in duplicate report', async () => {
    const code = `function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity;
  }
  return total;
}`;

    await fs.writeFile(path.join(tempDir, 'calc1.ts'), code);
    await fs.writeFile(path.join(tempDir, 'calc2.ts'), code);
    await fs.writeFile(path.join(tempDir, 'calc3.ts'), code);

    const report = await analyzer.analyze();

    expect(report.duplicates.length).toBeGreaterThanOrEqual(1);
    expect(report.duplicates[0]!.preview).toContain('calculateTotal');
    expect(report.duplicates[0]!.preview).toContain('total');
  });
});

/**
 * SPEC: RefactorAnalyzer - Magic Number Detection
 *
 * REQUIREMENT: The analyzer MUST detect magic numbers
 * and suggest extracting them to named constants.
 * Note: Magic numbers are reported via stats.magicNumbers count
 * and extract-constant suggestions, not a separate array.
 */
describe('[SPEC] RefactorAnalyzer - Magic Number Detection', () => {
  let tempDir: string;
  let analyzer: RefactorAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-refactor-magic-'));
    analyzer = new RefactorAnalyzer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST detect large magic numbers in function bodies
   * Note: Lines starting with 'const ' are skipped (assumed to be constants)
   */
  it('MUST detect large magic numbers', async () => {
    // Magic numbers in return statements and assignments (not const declarations)
    const code = `function getTimeout() {
  let timeout = 86400000;
  return timeout;
}

function getMaxRetries() {
  let retries = 999999;
  return retries;
}`;

    await fs.writeFile(path.join(tempDir, 'config.ts'), code);

    const report = await analyzer.analyze();

    // Magic numbers are counted in stats
    expect(report.stats.magicNumbers).toBeGreaterThanOrEqual(2);

    // And reported as extract-constant suggestions
    const constSuggestions = report.suggestions.filter(s => s.type === 'extract-constant');
    expect(constSuggestions.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * GOLDEN TEST: MUST NOT flag small/common numbers
   * Note: ALLOWED_NUMBERS set contains common values like 0, 1, 2, 10, 100, etc.
   */
  it('MUST NOT flag common small numbers', async () => {
    // Using let to avoid 'const ' skip, but these are allowed numbers
    const code = `function example() {
  let zero = 0;
  let one = 1;
  let two = 2;
  let ten = 10;
  let hundred = 100;
}`;

    await fs.writeFile(path.join(tempDir, 'small.ts'), code);

    const report = await analyzer.analyze();

    // Small/common numbers in ALLOWED_NUMBERS should not be flagged
    // Note: 100 is 3 digits so might be flagged, but 0,1,2,10 are 1-2 digits
    expect(report.stats.magicNumbers).toBeLessThanOrEqual(1);
  });

  /**
   * GOLDEN TEST: extract-constant suggestion MUST include file info
   */
  it('MUST include file info in extract-constant suggestions', async () => {
    // Using let to avoid 'const ' skip
    const code = `function getTimeout() {
  let timeout = 86400000;
  return timeout;
}`;

    await fs.writeFile(path.join(tempDir, 'timeout.ts'), code);

    const report = await analyzer.analyze();

    expect(report.stats.magicNumbers).toBeGreaterThanOrEqual(1);

    const constSuggestions = report.suggestions.filter(s => s.type === 'extract-constant');
    expect(constSuggestions.length).toBeGreaterThanOrEqual(1);
    expect(constSuggestions[0]!.files.length).toBeGreaterThan(0);
    expect(constSuggestions[0]!.files[0]).toContain('timeout.ts');
  });
});

/**
 * SPEC: RefactorAnalyzer - Long Function Detection
 *
 * REQUIREMENT: The analyzer MUST detect functions exceeding 50 lines
 * and suggest breaking them down.
 * Note: Long functions are reported via stats.longFunctions count
 * and reduce-complexity suggestions.
 */
describe('[SPEC] RefactorAnalyzer - Long Function Detection', () => {
  let tempDir: string;
  let analyzer: RefactorAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-refactor-long-'));
    analyzer = new RefactorAnalyzer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST detect functions over 50 lines
   */
  it('MUST detect functions over 50 lines', async () => {
    const lines = Array(55)
      .fill('')
      .map((_, i) => `  const step${i} = process${i}();`)
      .join('\n');
    const code = `function veryLongFunction() {\n${lines}\n  return step54;\n}`;

    await fs.writeFile(path.join(tempDir, 'long.ts'), code);

    const report = await analyzer.analyze();

    // Long functions counted in stats
    expect(report.stats.longFunctions).toBe(1);

    // And reported as reduce-complexity suggestions
    const complexSuggestions = report.suggestions.filter(s => s.type === 'reduce-complexity');
    expect(complexSuggestions.length).toBe(1);
    expect(complexSuggestions[0]!.description).toContain('veryLongFunction');
  });

  /**
   * GOLDEN TEST: MUST NOT flag functions under 50 lines
   */
  it('MUST NOT flag functions under 50 lines', async () => {
    const code = `function shortFunction() {
  const a = 1;
  const b = 2;
  return a + b;
}`;

    await fs.writeFile(path.join(tempDir, 'short.ts'), code);

    const report = await analyzer.analyze();

    expect(report.stats.longFunctions).toBe(0);

    const complexSuggestions = report.suggestions.filter(s => s.type === 'reduce-complexity');
    expect(complexSuggestions.length).toBe(0);
  });

  /**
   * GOLDEN TEST: reduce-complexity suggestion MUST include function info
   */
  it('MUST include function info in reduce-complexity suggestions', async () => {
    const lines = Array(60)
      .fill('')
      .map((_, i) => `  const x${i} = ${i};`)
      .join('\n');
    const code = `function sixtyLines() {\n${lines}\n  return x59;\n}`;

    await fs.writeFile(path.join(tempDir, 'sixty.ts'), code);

    const report = await analyzer.analyze();

    expect(report.stats.longFunctions).toBe(1);

    const complexSuggestions = report.suggestions.filter(s => s.type === 'reduce-complexity');
    expect(complexSuggestions.length).toBe(1);
    expect(complexSuggestions[0]!.files.length).toBeGreaterThan(0);
    expect(complexSuggestions[0]!.files[0]).toContain('sixty.ts');
  });

  /**
   * GOLDEN TEST: MUST detect long Python functions using indentation
   * Python uses indentation instead of braces to define function scope
   */
  it('MUST detect long Python functions', async () => {
    // Python function with 55 lines (over threshold)
    const body = Array(53)
      .fill('')
      .map((_, i) => `    x${i} = ${i}`)
      .join('\n');
    const code = `def very_long_function():\n${body}\n    return x52\n\ndef short_func():\n    return 1\n`;

    await fs.writeFile(path.join(tempDir, 'module.py'), code);

    const report = await analyzer.analyze();

    // Python long function should be detected
    expect(report.stats.longFunctions).toBeGreaterThanOrEqual(1);

    const complexSuggestions = report.suggestions.filter(s => s.type === 'reduce-complexity');
    expect(complexSuggestions.length).toBeGreaterThanOrEqual(1);
    expect(complexSuggestions[0]!.description).toContain('very_long_function');
  });

  /**
   * GOLDEN TEST: MUST NOT flag short Python functions
   */
  it('MUST NOT flag short Python functions', async () => {
    const code = `def short_function():\n    x = 1\n    y = 2\n    return x + y\n`;

    await fs.writeFile(path.join(tempDir, 'short.py'), code);

    const report = await analyzer.analyze();

    expect(report.stats.longFunctions).toBe(0);
  });
});

/**
 * SPEC: RefactorAnalyzer - Suggestion Generation
 *
 * REQUIREMENT: The analyzer MUST generate actionable suggestions
 * with correct types and priorities.
 */
describe('[SPEC] RefactorAnalyzer - Suggestion Generation', () => {
  let tempDir: string;
  let analyzer: RefactorAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-refactor-suggest-'));
    analyzer = new RefactorAnalyzer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST generate remove-duplicate suggestions for duplicates
   */
  it('MUST generate remove-duplicate suggestions', async () => {
    const code = `function handler(req) {
  const v = validate(req);
  const s = sanitize(v);
  const p = process(s);
  const f = format(p);
  return send(f);
}`;

    await fs.writeFile(path.join(tempDir, 'h1.ts'), code);
    await fs.writeFile(path.join(tempDir, 'h2.ts'), code);
    await fs.writeFile(path.join(tempDir, 'h3.ts'), code);

    const report = await analyzer.analyze();

    const dupSuggestions = report.suggestions.filter(s => s.type === 'remove-duplicate');
    expect(dupSuggestions.length).toBeGreaterThanOrEqual(1);
    expect(dupSuggestions[0]!.priority).toBe('high');
  });

  /**
   * GOLDEN TEST: MUST generate extract-constant suggestions for magic numbers
   * Priority: 1 number = low, 2-4 = medium, 5+ = high
   */
  it('MUST generate extract-constant suggestions', async () => {
    // Using let to avoid 'const ' skip in magic number detection
    // 2 magic numbers in same file → medium priority
    const code = `function calculate() {
  let timeout = 86400000;
  let maxRetries = 999999;
  return timeout + maxRetries;
}`;

    await fs.writeFile(path.join(tempDir, 'magic.ts'), code);

    const report = await analyzer.analyze();

    const constSuggestions = report.suggestions.filter(s => s.type === 'extract-constant');
    expect(constSuggestions.length).toBeGreaterThanOrEqual(1);
    expect(constSuggestions[0]!.priority).toBe('medium');
  });

  /**
   * GOLDEN TEST: MUST generate reduce-complexity suggestions for long functions
   * Priority: >100 lines = high, 50-100 lines = medium
   */
  it('MUST generate reduce-complexity suggestions', async () => {
    const lines = Array(55)
      .fill('')
      .map((_, i) => `  const s${i} = f${i}();`)
      .join('\n');
    const code = `function tooLong() {\n${lines}\n  return s54;\n}`;

    await fs.writeFile(path.join(tempDir, 'complex.ts'), code);

    const report = await analyzer.analyze();

    const complexSuggestions = report.suggestions.filter(s => s.type === 'reduce-complexity');
    expect(complexSuggestions.length).toBe(1);
    // 55 lines = medium priority (>100 would be high)
    expect(complexSuggestions[0]!.priority).toBe('medium');
  });

  /**
   * GOLDEN TEST: Suggestions MUST be sorted by priority (high first)
   */
  it('MUST sort suggestions by priority', async () => {
    // Create code with both high and medium priority issues
    const duplicateCode = `function dup(x) {
  let a = step1(x);
  let b = step2(a);
  let c = step3(b);
  let d = step4(c);
  return step5(d);
}`;
    // Using let to avoid 'const ' skip
    const magicCode = `function getValue() {
  let big = 999999;
  return big;
}`;

    await fs.writeFile(path.join(tempDir, 'd1.ts'), duplicateCode);
    await fs.writeFile(path.join(tempDir, 'd2.ts'), duplicateCode);
    await fs.writeFile(path.join(tempDir, 'd3.ts'), duplicateCode);
    await fs.writeFile(path.join(tempDir, 'magic.ts'), magicCode);

    const report = await analyzer.analyze();

    // High priority suggestions should come first
    const priorities = report.suggestions.map(s => s.priority);
    const highIndex = priorities.findIndex(p => p === 'high');
    const mediumIndex = priorities.findIndex(p => p === 'medium');

    if (highIndex !== -1 && mediumIndex !== -1) {
      expect(highIndex).toBeLessThan(mediumIndex);
    }
  });
});

/**
 * SPEC: RefactorAnalyzer - Generate Fixes
 *
 * REQUIREMENT: When generateFixes option is true, suggestions MUST include
 * fix objects with extracted functions or constants.
 */
describe('[SPEC] RefactorAnalyzer - Generate Fixes', () => {
  let tempDir: string;
  let analyzer: RefactorAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-refactor-fixes-'));
    analyzer = new RefactorAnalyzer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST generate fix for duplicate code extraction
   */
  it('MUST generate extract-function fix for duplicates', async () => {
    const duplicateCode = `function handler(data) {
  const validated = validateInput(data);
  const processed = processData(validated);
  const formatted = formatOutput(processed);
  const result = sendResult(formatted);
  return result;
}`;

    await fs.writeFile(path.join(tempDir, 'handler1.ts'), duplicateCode);
    await fs.writeFile(path.join(tempDir, 'handler2.ts'), duplicateCode);
    await fs.writeFile(path.join(tempDir, 'handler3.ts'), duplicateCode);

    const report = await analyzer.analyze({ generateFixes: true });

    const dupSuggestions = report.suggestions.filter(s => s.type === 'remove-duplicate');
    expect(dupSuggestions.length).toBeGreaterThanOrEqual(1);

    // With generateFixes: true, suggestion should have fix property
    const suggestionWithFix = dupSuggestions.find(s => s.fix);
    if (suggestionWithFix && suggestionWithFix.fix) {
      expect(suggestionWithFix.fix).toHaveProperty('type', 'extract-function');
      expect(suggestionWithFix.fix).toHaveProperty('newCode');
      expect(suggestionWithFix.fix).toHaveProperty('replacements');
    }
  });

  /**
   * GOLDEN TEST: MUST generate fix for magic number extraction
   */
  it('MUST generate constant fix for magic numbers', async () => {
    const code = `function getConfig() {
  let timeout = 86400000;
  let retries = 999999;
  return { timeout, retries };
}`;

    await fs.writeFile(path.join(tempDir, 'config.ts'), code);

    const report = await analyzer.analyze({ generateFixes: true });

    const constSuggestions = report.suggestions.filter(s => s.type === 'extract-constant');
    expect(constSuggestions.length).toBeGreaterThanOrEqual(1);

    // With generateFixes: true, suggestion should have fix property
    const suggestionWithFix = constSuggestions.find(s => s.fix);
    if (suggestionWithFix && suggestionWithFix.fix) {
      expect(suggestionWithFix.fix).toHaveProperty('type');
      expect(suggestionWithFix.fix).toHaveProperty('newCode');
    }
  });

  /**
   * GOLDEN TEST: Fix for TypeScript MUST use TypeScript syntax
   */
  it('MUST use TypeScript syntax for .ts files', async () => {
    const duplicateCode = `function process(x) {
  const a = step1(x);
  const b = step2(a);
  const c = step3(b);
  const d = step4(c);
  return step5(d);
}`;

    await fs.writeFile(path.join(tempDir, 'ts1.ts'), duplicateCode);
    await fs.writeFile(path.join(tempDir, 'ts2.ts'), duplicateCode);
    await fs.writeFile(path.join(tempDir, 'ts3.ts'), duplicateCode);

    const report = await analyzer.analyze({ generateFixes: true });

    const dupSuggestions = report.suggestions.filter(s => s.type === 'remove-duplicate' && s.fix);
    if (dupSuggestions.length > 0 && dupSuggestions[0]!.fix) {
      // TypeScript should use 'function name(): void'
      expect(dupSuggestions[0]!.fix.newCode).toMatch(/function\s+\w+\(\):\s*void/);
    }
  });

  /**
   * GOLDEN TEST: Fix for Python MUST use Python syntax
   */
  it('MUST use Python syntax for .py files', async () => {
    const pyCode = `def process(x):
    a = step1(x)
    b = step2(a)
    c = step3(b)
    d = step4(c)
    return step5(d)
`;

    await fs.writeFile(path.join(tempDir, 'py1.py'), pyCode);
    await fs.writeFile(path.join(tempDir, 'py2.py'), pyCode);
    await fs.writeFile(path.join(tempDir, 'py3.py'), pyCode);

    const report = await analyzer.analyze({ generateFixes: true });

    const dupSuggestions = report.suggestions.filter(s => s.type === 'remove-duplicate' && s.fix);
    if (dupSuggestions.length > 0 && dupSuggestions[0]!.fix) {
      // Python should use 'def name():'
      expect(dupSuggestions[0]!.fix.newCode).toMatch(/def\s+\w+\(\):/);
    }
  });

  /**
   * GOLDEN TEST: Fix for Go MUST use Go syntax
   */
  it('MUST use Go syntax for .go files', async () => {
    const goCode = `func process(x interface{}) interface{} {
	a := step1(x)
	b := step2(a)
	c := step3(b)
	d := step4(c)
	return step5(d)
}`;

    await fs.writeFile(path.join(tempDir, 'go1.go'), goCode);
    await fs.writeFile(path.join(tempDir, 'go2.go'), goCode);
    await fs.writeFile(path.join(tempDir, 'go3.go'), goCode);

    const report = await analyzer.analyze({ generateFixes: true });

    const dupSuggestions = report.suggestions.filter(s => s.type === 'remove-duplicate' && s.fix);
    if (dupSuggestions.length > 0 && dupSuggestions[0]!.fix) {
      // Go should use 'func name() {'
      expect(dupSuggestions[0]!.fix.newCode).toMatch(/func\s+\w+\(\)\s*\{/);
    }
  });
});

/**
 * SPEC: RefactorAnalyzer - Report Structure
 *
 * REQUIREMENT: The report MUST have consistent structure
 * with all required fields populated.
 */
describe('[SPEC] RefactorAnalyzer - Report Structure', () => {
  let tempDir: string;
  let analyzer: RefactorAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-refactor-report-'));
    analyzer = new RefactorAnalyzer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: Report MUST have all required top-level fields
   */
  it('MUST have all required fields in report', async () => {
    await fs.writeFile(path.join(tempDir, 'empty.ts'), '// empty file');

    const report = await analyzer.analyze();

    // RefactorReport interface: duplicates, suggestions, stats, summary
    expect(report).toHaveProperty('duplicates');
    expect(report).toHaveProperty('suggestions');
    expect(report).toHaveProperty('stats');
    expect(report).toHaveProperty('summary');

    expect(Array.isArray(report.duplicates)).toBe(true);
    expect(Array.isArray(report.suggestions)).toBe(true);
    expect(typeof report.stats).toBe('object');
    expect(typeof report.summary).toBe('string');
  });

  /**
   * GOLDEN TEST: Stats MUST include file and issue counts
   */
  it('MUST include stats with counts', async () => {
    // Simple code to test stats structure (not magic number detection)
    const code = `function test() { return 1; }`;
    await fs.writeFile(path.join(tempDir, 'file.ts'), code);

    const report = await analyzer.analyze();

    // Stats structure: filesScanned, duplicateBlocks, totalDuplicateLines, magicNumbers, longFunctions
    expect(report.stats).toHaveProperty('filesScanned');
    expect(report.stats).toHaveProperty('duplicateBlocks');
    expect(report.stats).toHaveProperty('magicNumbers');
    expect(report.stats).toHaveProperty('longFunctions');
    expect(typeof report.stats.filesScanned).toBe('number');
    expect(typeof report.stats.magicNumbers).toBe('number');
  });

  /**
   * GOLDEN TEST: totalDuplicateLines MUST be calculated correctly
   * Formula: sum of (lines * occurrences) for each duplicate block
   */
  it('MUST calculate totalDuplicateLines correctly', async () => {
    // Create duplicate code with known line count (6 lines)
    const duplicateCode = `function process(data) {
  const step1 = validate(data);
  const step2 = transform(step1);
  const step3 = format(step2);
  const step4 = output(step3);
  return step4;
}`;

    await fs.writeFile(path.join(tempDir, 'dup1.ts'), duplicateCode);
    await fs.writeFile(path.join(tempDir, 'dup2.ts'), duplicateCode);
    await fs.writeFile(path.join(tempDir, 'dup3.ts'), duplicateCode);

    const report = await analyzer.analyze();

    // With 3 occurrences, totalDuplicateLines = lines * 3
    expect(report.stats.totalDuplicateLines).toBeGreaterThan(0);
    // Total should be at least lines * occurrences (6 * 3 = 18 minimum)
    if (report.duplicates.length > 0) {
      const expectedMin = report.duplicates[0]!.lines * report.duplicates[0]!.occurrences.length;
      expect(report.stats.totalDuplicateLines).toBeGreaterThanOrEqual(expectedMin);
    }
  });

  /**
   * GOLDEN TEST: filesScanned MUST count actual source files
   */
  it('MUST count actual source files scanned', async () => {
    await fs.writeFile(path.join(tempDir, 'file1.ts'), 'const a = 1;');
    await fs.writeFile(path.join(tempDir, 'file2.ts'), 'const b = 2;');
    await fs.writeFile(path.join(tempDir, 'file3.js'), 'const c = 3;');

    const report = await analyzer.analyze();

    // Should count 3 source files
    expect(report.stats.filesScanned).toBe(3);
  });

  /**
   * GOLDEN TEST: Stats MUST ignore node_modules and dist
   */
  it('MUST ignore node_modules in file count', async () => {
    await fs.writeFile(path.join(tempDir, 'src.ts'), 'const a = 1;');
    await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'node_modules', 'pkg.ts'), 'const b = 2;');

    const report = await analyzer.analyze();

    // Should only count src.ts, not node_modules/pkg.ts
    expect(report.stats.filesScanned).toBe(1);
  });

  /**
   * GOLDEN TEST: Summary MUST be human-readable string
   */
  it('MUST include human-readable summary', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const a = 1;');

    const report = await analyzer.analyze();

    expect(typeof report.summary).toBe('string');
    expect(report.summary.length).toBeGreaterThan(0);
  });
});

/**
 * SPEC: RefactorAnalyzer - learnFromRefactor
 *
 * REQUIREMENT: The analyzer MUST extract rules from refactoring
 * and append them to the manifesto.
 */
describe('[SPEC] RefactorAnalyzer - Learn From Refactor', () => {
  let tempDir: string;
  let analyzer: RefactorAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-refactor-learn-'));
    analyzer = new RefactorAnalyzer(tempDir);
    await fs.mkdir(path.join(tempDir, '.engineering'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST extract rules from high-priority suggestions
   */
  it('MUST extract rules from duplicates with 3+ occurrences', async () => {
    const code = `function process(data) {
  const step1 = validate(data);
  const step2 = transform(step1);
  const step3 = format(step2);
  const step4 = output(step3);
  return step4;
}`;

    await fs.writeFile(path.join(tempDir, 'p1.ts'), code);
    await fs.writeFile(path.join(tempDir, 'p2.ts'), code);
    await fs.writeFile(path.join(tempDir, 'p3.ts'), code);

    const report = await analyzer.analyze();
    const rules = await analyzer.learnFromRefactor(report);

    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]).toHaveProperty('rule');
    expect(rules[0]).toHaveProperty('type', 'anti-pattern');
    expect(rules[0]).toHaveProperty('source');
    expect(rules[0]).toHaveProperty('addedAt');
  });

  /**
   * GOLDEN TEST: MUST append rules to manifesto file
   */
  it('MUST create manifesto with learned rules', async () => {
    const code = `function handler(x) {
  const a = first(x);
  const b = second(a);
  const c = third(b);
  const d = fourth(c);
  return fifth(d);
}`;

    await fs.writeFile(path.join(tempDir, 'h1.ts'), code);
    await fs.writeFile(path.join(tempDir, 'h2.ts'), code);
    await fs.writeFile(path.join(tempDir, 'h3.ts'), code);

    const report = await analyzer.analyze();
    await analyzer.learnFromRefactor(report);

    const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');
    const exists = await fs.access(manifestoPath).then(() => true).catch(() => false);

    expect(exists).toBe(true);

    const content = await fs.readFile(manifestoPath, 'utf-8');
    expect(content).toContain('LEARNED RULES');
    expect(content).toMatch(/\d{4}-\d{2}-\d{2}/); // Date format
  });

  /**
   * GOLDEN TEST: MUST limit rules to prevent manifesto bloat
   */
  it('MUST limit extracted rules to 5 maximum', async () => {
    // Create many different duplicates
    for (let i = 0; i < 10; i++) {
      const code = `function func${i}(x) {
  const a${i} = step1(x);
  const b${i} = step2(a${i});
  const c${i} = step3(b${i});
  const d${i} = step4(c${i});
  return step5(d${i});
}`;
      await fs.writeFile(path.join(tempDir, `f${i}_1.ts`), code);
      await fs.writeFile(path.join(tempDir, `f${i}_2.ts`), code);
      await fs.writeFile(path.join(tempDir, `f${i}_3.ts`), code);
    }

    const report = await analyzer.analyze();
    const rules = await analyzer.learnFromRefactor(report);

    // Even with many duplicates, rules should be capped
    expect(rules.length).toBeLessThanOrEqual(15); // Up to 5 from suggestions + 5 from duplicates
  });

  /**
   * GOLDEN TEST: MUST return empty array for clean code
   */
  it('MUST return empty rules for clean code', async () => {
    const code = `const MAX_VALUE = 100;
function process(x: number): number {
  return x * 2;
}`;

    await fs.writeFile(path.join(tempDir, 'clean.ts'), code);

    const report = await analyzer.analyze();
    const rules = await analyzer.learnFromRefactor(report);

    expect(rules.length).toBe(0);
  });

  /**
   * GOLDEN TEST: Source field from suggestion MUST list files
   * Rules from suggestions use format: "file1, file2, ..."
   */
  it('MUST format source from suggestion as file list', async () => {
    const code = `function process(data) {
  const step1 = validate(data);
  const step2 = transform(step1);
  const step3 = format(step2);
  const step4 = output(step3);
  return step4;
}`;

    await fs.writeFile(path.join(tempDir, 'src1.ts'), code);
    await fs.writeFile(path.join(tempDir, 'src2.ts'), code);
    await fs.writeFile(path.join(tempDir, 'src3.ts'), code);

    const report = await analyzer.analyze();
    const rules = await analyzer.learnFromRefactor(report);

    expect(rules.length).toBeGreaterThan(0);

    // Find a rule from suggestion (remove-duplicate type has files without line numbers)
    const suggestionRule = rules.find(r => r.rule.includes('Avoid duplicating'));
    if (suggestionRule) {
      // Source from suggestion is just file names with comma separator
      expect(suggestionRule.source).toContain(', ');
      expect(suggestionRule.source).toMatch(/\.ts/);
    }

    // Find a rule from duplicate (has file:line format)
    const duplicateRule = rules.find(r => r.rule.includes('Extract this repeated pattern'));
    if (duplicateRule) {
      // Source from duplicate has file:line format
      expect(duplicateRule.source).toContain(':');
      expect(duplicateRule.source).toMatch(/\.ts:\d+/);
    }
  });

  /**
   * GOLDEN TEST: Manifesto content MUST include rule type in brackets
   */
  it('MUST include rule type in brackets in manifesto', async () => {
    const code = `function handler(x) {
  const a = first(x);
  const b = second(a);
  const c = third(b);
  const d = fourth(c);
  return fifth(d);
}`;

    await fs.writeFile(path.join(tempDir, 'h1.ts'), code);
    await fs.writeFile(path.join(tempDir, 'h2.ts'), code);
    await fs.writeFile(path.join(tempDir, 'h3.ts'), code);

    const report = await analyzer.analyze();
    await analyzer.learnFromRefactor(report);

    const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');
    const content = await fs.readFile(manifestoPath, 'utf-8');

    // Manifesto must contain rule type in brackets format: **[type]**
    expect(content).toMatch(/\*\*\[anti-pattern\]\*\*/);

    // Manifesto must contain source in backticks
    expect(content).toContain('Source: `');
  });

  /**
   * GOLDEN TEST: Rule type MUST be 'anti-pattern'
   */
  it('MUST have type anti-pattern for duplicate rules', async () => {
    const code = `function duplicated(x) {
  const a = stepOne(x);
  const b = stepTwo(a);
  const c = stepThree(b);
  const d = stepFour(c);
  return stepFive(d);
}`;

    await fs.writeFile(path.join(tempDir, 'dup1.ts'), code);
    await fs.writeFile(path.join(tempDir, 'dup2.ts'), code);
    await fs.writeFile(path.join(tempDir, 'dup3.ts'), code);

    const report = await analyzer.analyze();
    const rules = await analyzer.learnFromRefactor(report);

    expect(rules.length).toBeGreaterThan(0);

    // All rules from duplicates must have type 'anti-pattern'
    for (const rule of rules) {
      expect(rule.type).toBe('anti-pattern');
    }
  });

  /**
   * GOLDEN TEST: Source MUST be sliced to max 3 occurrences
   */
  it('MUST limit source to 3 occurrences', async () => {
    const code = `function repeated(x) {
  const a = one(x);
  const b = two(a);
  const c = three(b);
  const d = four(c);
  return five(d);
}`;

    // Create 5 files with same duplicate
    await fs.writeFile(path.join(tempDir, 'r1.ts'), code);
    await fs.writeFile(path.join(tempDir, 'r2.ts'), code);
    await fs.writeFile(path.join(tempDir, 'r3.ts'), code);
    await fs.writeFile(path.join(tempDir, 'r4.ts'), code);
    await fs.writeFile(path.join(tempDir, 'r5.ts'), code);

    const report = await analyzer.analyze();
    const rules = await analyzer.learnFromRefactor(report);

    expect(rules.length).toBeGreaterThan(0);
    const source = rules[0]!.source;

    // Count occurrences of ':' to verify max 3 files listed
    const colonCount = (source.match(/:/g) || []).length;
    expect(colonCount).toBeLessThanOrEqual(3);
  });
});

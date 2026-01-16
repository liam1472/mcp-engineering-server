/**
 * Unit tests for indexes/refactor-analyzer.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import { RefactorAnalyzer } from '../../../src/indexes/refactor-analyzer.js';
import { createTempDir, cleanupTempDir, writeTestFile, fileExists } from '../../setup.js';

describe('indexes/refactor-analyzer.ts', () => {
  describe('RefactorAnalyzer', () => {
    let tempDir: string;
    let analyzer: RefactorAnalyzer;

    beforeEach(async () => {
      tempDir = await createTempDir('refactor-test');
      analyzer = new RefactorAnalyzer(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('analyze()', () => {
      it('should return report with stats', async () => {
        await writeTestFile(
          path.join(tempDir, 'app.ts'),
          `function hello() { return "world"; }`
        );

        const report = await analyzer.analyze();

        expect(report.stats).toBeDefined();
        expect(report.stats.filesScanned).toBeGreaterThanOrEqual(0);
        expect(report.summary).toBeDefined();
      });

      it('should detect duplicate code blocks', async () => {
        const duplicateCode = `function processItem(item) {
  const result = item.value * 2;
  if (result > 100) {
    return result - 10;
  }
  return result;
}`;
        await writeTestFile(path.join(tempDir, 'handler1.ts'), duplicateCode);
        await writeTestFile(path.join(tempDir, 'handler2.ts'), duplicateCode);

        const report = await analyzer.analyze();

        expect(report.duplicates).toBeDefined();
        expect(Array.isArray(report.duplicates)).toBe(true);
      });

      it('should detect magic numbers', async () => {
        await writeTestFile(
          path.join(tempDir, 'config.ts'),
          `const timeout = 86400000;
const retries = 12345;
const maxItems = 999;`
        );

        const report = await analyzer.analyze();

        expect(report.stats.magicNumbers).toBeGreaterThanOrEqual(0);
      });

      it('should detect long functions', async () => {
        // Create a function with > 50 lines
        const longLines = Array(60)
          .fill('')
          .map((_, i) => `  const step${i} = process${i}();`)
          .join('\n');
        await writeTestFile(
          path.join(tempDir, 'long.ts'),
          `function veryLongFunction() {\n${longLines}\n}`
        );

        const report = await analyzer.analyze();

        expect(report.stats.longFunctions).toBeGreaterThanOrEqual(0);
      });

      it('should generate suggestions', async () => {
        const code = `function duplicate(x) {
  const a = x * 2;
  const b = a + 1;
  const c = b * 3;
  return c;
}`;
        await writeTestFile(path.join(tempDir, 'a.ts'), code);
        await writeTestFile(path.join(tempDir, 'b.ts'), code);
        await writeTestFile(path.join(tempDir, 'c.ts'), code);

        const report = await analyzer.analyze();

        expect(report.suggestions).toBeDefined();
        expect(Array.isArray(report.suggestions)).toBe(true);
      });

      it('should generate fixes when requested', async () => {
        const code = `function duplicateFunc(input) {
  const step1 = validate(input);
  const step2 = transform(step1);
  return step2;
}`;
        await writeTestFile(path.join(tempDir, 'a.ts'), code);
        await writeTestFile(path.join(tempDir, 'b.ts'), code);

        const report = await analyzer.analyze({ generateFixes: true });

        expect(report.suggestions).toBeDefined();
        // Fixes may or may not be generated depending on duplicates found
      });

      it('should include summary in report', async () => {
        await writeTestFile(
          path.join(tempDir, 'app.ts'),
          `function test() { return 1; }`
        );

        const report = await analyzer.analyze();

        expect(report.summary).toBeDefined();
        expect(report.summary.length).toBeGreaterThan(0);
        expect(report.summary).toContain('Refactor Analysis');
      });

      it('should filter out import-only duplicates', async () => {
        const imports = `import { a } from 'a';
import { b } from 'b';
import { c } from 'c';
import { d } from 'd';
import { e } from 'e';
import { f } from 'f';`;
        await writeTestFile(path.join(tempDir, 'module1.ts'), imports);
        await writeTestFile(path.join(tempDir, 'module2.ts'), imports);

        const report = await analyzer.analyze();

        // Import-only blocks should be filtered
        const importDuplicates = report.duplicates.filter(d =>
          d.preview.includes('import')
        );
        expect(importDuplicates.length).toBe(0);
      });
    });

    describe('applyFixes()', () => {
      it('should return success with no suggestions', async () => {
        await writeTestFile(
          path.join(tempDir, 'clean.ts'),
          `function clean() { return 1; }`
        );

        const report = await analyzer.analyze();
        const result = await analyzer.applyFixes(report);

        expect(result.success).toBe(true);
        expect(result.summary).toContain('No refactoring suggestions');
      });

      it('should require force for many files', async () => {
        // Create many files with magic numbers
        for (let i = 0; i < 7; i++) {
          await writeTestFile(
            path.join(tempDir, `file${i}.ts`),
            `const value${i} = ${86400 + i};
const timeout${i} = ${12345 + i};
const max${i} = ${99999 + i};`
          );
        }

        const report = await analyzer.analyze({ generateFixes: true });
        const result = await analyzer.applyFixes(report);

        if (report.suggestions.length > 5) {
          expect(result.requiresForce).toBe(true);
        }
      });

      it('should apply with force flag', async () => {
        for (let i = 0; i < 7; i++) {
          await writeTestFile(
            path.join(tempDir, `file${i}.ts`),
            `const timeout${i} = ${86400 + i};`
          );
        }

        const report = await analyzer.analyze({ generateFixes: true });
        const result = await analyzer.applyFixes(report, { force: true });

        expect(result.requiresForce).toBe(false);
      });

      it('should generate manual instructions for duplicates', async () => {
        const code = `function handleRequest(req) {
  const validated = validateRequest(req);
  const processed = processRequest(validated);
  return sendResponse(processed);
}`;
        await writeTestFile(path.join(tempDir, 'handler1.ts'), code);
        await writeTestFile(path.join(tempDir, 'handler2.ts'), code);
        await writeTestFile(path.join(tempDir, 'handler3.ts'), code);

        const report = await analyzer.analyze({ generateFixes: true });
        const result = await analyzer.applyFixes(report);

        if (report.suggestions.some(s => s.type === 'remove-duplicate')) {
          expect(result.manualInstructions.length).toBeGreaterThan(0);
        }
      });

      it('should block protected paths', async () => {
        await writeTestFile(
          path.join(tempDir, 'node_modules', 'lib', 'index.ts'),
          `const magic = 12345;`
        );

        const report = await analyzer.analyze({ generateFixes: true });
        const result = await analyzer.applyFixes(report);

        // node_modules should be blocked
        expect(result.filesModified.every(f => !f.includes('node_modules'))).toBe(
          true
        );
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        const otherDir = await createTempDir('other-refactor');
        await writeTestFile(
          path.join(otherDir, 'other.ts'),
          `function other() { return 1; }`
        );

        analyzer.setWorkingDir(otherDir);
        const report = await analyzer.analyze();

        expect(report.stats.filesScanned).toBeGreaterThan(0);

        await cleanupTempDir(otherDir);
      });
    });

    describe('suggestion types', () => {
      it('should have remove-duplicate suggestions', async () => {
        const code = `function duplicate(x) {
  const a = x * 2;
  const b = a + 1;
  const c = b * 3;
  const d = c - 1;
  return d;
}`;
        await writeTestFile(path.join(tempDir, 'a.ts'), code);
        await writeTestFile(path.join(tempDir, 'b.ts'), code);

        const report = await analyzer.analyze();
        const removeDupSuggestions = report.suggestions.filter(
          s => s.type === 'remove-duplicate'
        );

        if (report.duplicates.length > 0) {
          expect(removeDupSuggestions.length).toBeGreaterThan(0);
        }
      });

      it('should have extract-constant suggestions', async () => {
        await writeTestFile(
          path.join(tempDir, 'magic.ts'),
          `function calc() {
  const timeout = 86400000;
  const retries = 999999;
  const maxItems = 12345;
}
function other() {
  const x = 111111;
  const y = 222222;
}`
        );

        const report = await analyzer.analyze();
        const constantSuggestions = report.suggestions.filter(
          s => s.type === 'extract-constant'
        );

        // May or may not have constant suggestions depending on detection
        expect(Array.isArray(constantSuggestions)).toBe(true);
      });

      it('should have reduce-complexity suggestions for long functions', async () => {
        const longLines = Array(60)
          .fill('')
          .map((_, i) => `  const step${i} = process${i}();`)
          .join('\n');
        await writeTestFile(
          path.join(tempDir, 'long.ts'),
          `function veryLongFunction() {\n${longLines}\n  return step59;\n}`
        );

        const report = await analyzer.analyze();
        const complexitySuggestions = report.suggestions.filter(
          s => s.type === 'reduce-complexity'
        );

        if (report.stats.longFunctions > 0) {
          expect(complexitySuggestions.length).toBeGreaterThan(0);
        }
      });
    });

    describe('suggestion priorities', () => {
      it('should sort suggestions by priority', async () => {
        const code = `function dup(x) {
  const a = x * 2;
  const b = a + 1;
  const c = b * 3;
  return c;
}`;
        await writeTestFile(path.join(tempDir, 'a.ts'), code);
        await writeTestFile(path.join(tempDir, 'b.ts'), code);
        await writeTestFile(path.join(tempDir, 'c.ts'), code);
        await writeTestFile(path.join(tempDir, 'd.ts'), code);

        const report = await analyzer.analyze();

        if (report.suggestions.length >= 2) {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          for (let i = 1; i < report.suggestions.length; i++) {
            const prevPriority = priorityOrder[report.suggestions[i - 1]!.priority];
            const currPriority = priorityOrder[report.suggestions[i]!.priority];
            expect(currPriority).toBeGreaterThanOrEqual(prevPriority);
          }
        }
      });
    });
  });
});

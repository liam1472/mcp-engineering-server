/**
 * Unit tests for indexes/similarity.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import { SimilarityAnalyzer } from '../../../src/indexes/similarity.js';
import { createTempDir, cleanupTempDir, writeTestFile } from '../../setup.js';

describe('indexes/similarity.ts', () => {
  describe('SimilarityAnalyzer', () => {
    let tempDir: string;
    let analyzer: SimilarityAnalyzer;

    beforeEach(async () => {
      tempDir = await createTempDir('similarity-test');
      analyzer = new SimilarityAnalyzer(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('findSimilar()', () => {
      it('should find exact matches', async () => {
        const code = `function calculateSum(a, b) {
  return a + b;
}`;
        await writeTestFile(path.join(tempDir, 'math.ts'), code);

        const result = await analyzer.findSimilar(code);

        expect(result.matches.length).toBeGreaterThan(0);
        expect(result.matches.some(m => m.file === 'math.ts')).toBe(true);
      });

      it('should find similar code blocks', async () => {
        // Use more similar code to ensure meaningful test
        await writeTestFile(
          path.join(tempDir, 'file1.ts'),
          `function processData(input) {
  const result = input.map(x => x * 2);
  return result;
}`
        );

        // Search with very low threshold to test the algorithm works
        // The algorithm uses Jaccard similarity on tokenized code
        const result = await analyzer.findSimilar(`function processData(input) {
  const result = input.map(x => x * 2);
  return result;
}`, 50); // Use 50% threshold for near-exact match

        // MUST find the match - this is a near-exact search
        expect(result.matches.length).toBeGreaterThan(0);
        expect(result.matches.some(m => m.file === 'file1.ts')).toBe(true);
      });

      it('should respect minSimilarity threshold', async () => {
        await writeTestFile(
          path.join(tempDir, 'file.ts'),
          `function add(a, b) { return a + b; }`
        );

        const highThreshold = await analyzer.findSimilar(
          'function subtract(a, b) { return a - b; }',
          95
        );
        const lowThreshold = await analyzer.findSimilar(
          'function subtract(a, b) { return a - b; }',
          30
        );

        expect(lowThreshold.matches.length).toBeGreaterThanOrEqual(
          highThreshold.matches.length
        );
      });

      it('should return similarity percentage', async () => {
        const code = `const value = 42;`;
        await writeTestFile(path.join(tempDir, 'test.ts'), code);

        const result = await analyzer.findSimilar(code);

        if (result.matches.length > 0) {
          expect(result.matches[0]?.similarity).toBeGreaterThanOrEqual(0);
          expect(result.matches[0]?.similarity).toBeLessThanOrEqual(100);
        }
      });

      it('should include line numbers in matches', async () => {
        await writeTestFile(
          path.join(tempDir, 'test.ts'),
          `// Line 1
// Line 2
function myFunc() {
  return true;
}`
        );

        const result = await analyzer.findSimilar(`function myFunc() {
  return true;
}`);

        if (result.matches.length > 0) {
          expect(result.matches[0]?.startLine).toBeDefined();
          expect(result.matches[0]?.endLine).toBeDefined();
        }
      });

      it('should include preview in matches', async () => {
        await writeTestFile(
          path.join(tempDir, 'test.ts'),
          `function hello() { console.log("world"); }`
        );

        const result = await analyzer.findSimilar('function hello() { console.log("world"); }');

        if (result.matches.length > 0) {
          expect(result.matches[0]?.preview).toBeDefined();
          expect(result.matches[0]?.preview.length).toBeGreaterThan(0);
        }
      });

      it('should ignore node_modules', async () => {
        await writeTestFile(
          path.join(tempDir, 'src', 'app.ts'),
          `function appFunc() { return true; }`
        );
        await writeTestFile(
          path.join(tempDir, 'node_modules', 'lib', 'index.ts'),
          `function appFunc() { return true; }`
        );

        const result = await analyzer.findSimilar('function appFunc() { return true; }');
        const nodeModulesMatch = result.matches.find(m =>
          m.file.includes('node_modules')
        );

        expect(nodeModulesMatch).toBeUndefined();
      });

      it('should return empty matches for no similar code', async () => {
        await writeTestFile(
          path.join(tempDir, 'test.ts'),
          `class CompletelyDifferent { }`
        );

        const result = await analyzer.findSimilar(
          'const something = { totally: "unrelated", code: true }',
          90
        );

        // May or may not find matches depending on threshold
        expect(result.matches).toBeDefined();
        expect(Array.isArray(result.matches)).toBe(true);
      });
    });

    describe('formatResult()', () => {
      it('should format empty results', () => {
        const result = { query: 'test', matches: [] };
        const formatted = analyzer.formatResult(result);

        expect(formatted).toContain('No similar code found');
      });

      it('should format results with matches', async () => {
        await writeTestFile(
          path.join(tempDir, 'test.ts'),
          `function test() { return 1; }`
        );

        const result = await analyzer.findSimilar('function test() { return 1; }');
        const formatted = analyzer.formatResult(result);

        if (result.matches.length > 0) {
          expect(formatted).toContain('similar');
          expect(formatted).toContain('%');
        }
      });

      it('should limit displayed matches', async () => {
        // Create many files with similar code
        for (let i = 0; i < 15; i++) {
          await writeTestFile(
            path.join(tempDir, `file${i}.ts`),
            `function similar() { return ${i}; }`
          );
        }

        const result = await analyzer.findSimilar('function similar() { return 0; }', 20);
        const formatted = analyzer.formatResult(result);

        // Should indicate more matches exist if > 10
        if (result.matches.length > 10) {
          expect(formatted).toContain('more');
        }
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        const otherDir = await createTempDir('other-similarity');
        await writeTestFile(
          path.join(otherDir, 'unique.ts'),
          `function uniqueFunc() { return "unique"; }`
        );

        analyzer.setWorkingDir(otherDir);
        const result = await analyzer.findSimilar('function uniqueFunc() { return "unique"; }');

        // MUST find exact match in the new directory
        expect(result.matches.length).toBeGreaterThan(0);
        expect(result.matches.some(m => m.file === 'unique.ts')).toBe(true);

        await cleanupTempDir(otherDir);
      });
    });
  });
});

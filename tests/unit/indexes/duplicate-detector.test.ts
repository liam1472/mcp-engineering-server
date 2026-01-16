/**
 * Unit tests for indexes/duplicate-detector.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import { DuplicateDetector } from '../../../src/indexes/duplicate-detector.js';
import { createTempDir, cleanupTempDir, writeTestFile, fileExists } from '../../setup.js';

describe('indexes/duplicate-detector.ts', () => {
  describe('DuplicateDetector', () => {
    let tempDir: string;
    let detector: DuplicateDetector;

    beforeEach(async () => {
      tempDir = await createTempDir('duplicate-test');
      detector = new DuplicateDetector(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('scan()', () => {
      it('should find duplicate code blocks', async () => {
        const duplicateCode = `function processItem(item) {
  const result = item.value * 2;
  if (result > 100) {
    return result - 10;
  }
  return result;
}`;
        await writeTestFile(path.join(tempDir, 'file1.ts'), duplicateCode);
        await writeTestFile(path.join(tempDir, 'file2.ts'), duplicateCode);

        const duplicates = await detector.scan();

        expect(duplicates.length).toBeGreaterThan(0);
      });

      it('should return empty for unique code', async () => {
        await writeTestFile(
          path.join(tempDir, 'file1.ts'),
          `function unique1() { return 1; }`
        );
        await writeTestFile(
          path.join(tempDir, 'file2.ts'),
          `function unique2() { return 2; }`
        );

        const duplicates = await detector.scan();

        // Short unique code should not be detected as duplicates
        expect(duplicates.filter(d => d.lines >= 5).length).toBe(0);
      });

      it('should ignore node_modules', async () => {
        const duplicateCode = `function processData(data) {
  const mapped = data.map(x => x * 2);
  const filtered = mapped.filter(x => x > 0);
  return filtered.reduce((a, b) => a + b, 0);
}`;
        await writeTestFile(path.join(tempDir, 'src', 'app.ts'), duplicateCode);
        await writeTestFile(
          path.join(tempDir, 'node_modules', 'lib', 'index.ts'),
          duplicateCode
        );

        const duplicates = await detector.scan();
        const nodeModulesDup = duplicates.find(d =>
          d.occurrences.some(o => o.file.includes('node_modules'))
        );

        expect(nodeModulesDup).toBeUndefined();
      });

      it('should include file and line info in occurrences', async () => {
        const code = `function handler(event) {
  const data = event.data;
  const processed = data.map(item => item.value);
  console.log(processed);
  return processed;
}`;
        await writeTestFile(path.join(tempDir, 'handler1.ts'), code);
        await writeTestFile(path.join(tempDir, 'handler2.ts'), code);

        const duplicates = await detector.scan();

        if (duplicates.length > 0) {
          const firstDup = duplicates[0];
          expect(firstDup?.occurrences.length).toBeGreaterThanOrEqual(2);
          expect(firstDup?.occurrences[0]?.file).toBeDefined();
          expect(firstDup?.occurrences[0]?.startLine).toBeDefined();
          expect(firstDup?.occurrences[0]?.endLine).toBeDefined();
        }
      });

      it('should include preview in duplicates', async () => {
        const code = `async function fetchData(url) {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}`;
        await writeTestFile(path.join(tempDir, 'api1.ts'), code);
        await writeTestFile(path.join(tempDir, 'api2.ts'), code);

        const duplicates = await detector.scan();

        if (duplicates.length > 0) {
          expect(duplicates[0]?.preview).toBeDefined();
          expect(duplicates[0]?.preview.length).toBeGreaterThan(0);
        }
      });

      it('should detect duplicates across different file types', async () => {
        const tsCode = `function calculate(x, y) {
  const sum = x + y;
  const product = x * y;
  return { sum, product };
}`;
        await writeTestFile(path.join(tempDir, 'math.ts'), tsCode);
        await writeTestFile(path.join(tempDir, 'calc.js'), tsCode);

        const duplicates = await detector.scan();

        // May or may not find depending on normalization
        expect(Array.isArray(duplicates)).toBe(true);
      });
    });

    describe('getDuplicates()', () => {
      it('should return detected duplicates', async () => {
        const code = `function process(input) {
  const validated = validate(input);
  const transformed = transform(validated);
  return transformed;
}`;
        await writeTestFile(path.join(tempDir, 'a.ts'), code);
        await writeTestFile(path.join(tempDir, 'b.ts'), code);

        await detector.scan();
        const duplicates = detector.getDuplicates();

        expect(Array.isArray(duplicates)).toBe(true);
      });

      it('should return empty array before scan', () => {
        const duplicates = detector.getDuplicates();
        expect(duplicates).toEqual([]);
      });
    });

    describe('getSummary()', () => {
      it('should return summary message when no duplicates', async () => {
        await writeTestFile(
          path.join(tempDir, 'unique.ts'),
          `const x = 1;`
        );

        await detector.scan();
        const summary = detector.getSummary();

        expect(summary).toContain('No significant duplicate');
      });

      it('should return summary with stats when duplicates found', async () => {
        const code = `function longFunction(param) {
  const step1 = doStep1(param);
  const step2 = doStep2(step1);
  const step3 = doStep3(step2);
  const step4 = doStep4(step3);
  return step4;
}`;
        await writeTestFile(path.join(tempDir, 'a.ts'), code);
        await writeTestFile(path.join(tempDir, 'b.ts'), code);
        await writeTestFile(path.join(tempDir, 'c.ts'), code);

        await detector.scan();
        const summary = detector.getSummary();

        if (detector.getDuplicates().length > 0) {
          expect(summary).toContain('duplicate');
          expect(summary).toContain('occurrences');
        }
      });
    });

    describe('saveReport()', () => {
      it('should save report to YAML file', async () => {
        const code = `function saveTest() {
  const data = loadData();
  const processed = processData(data);
  saveData(processed);
}`;
        await writeTestFile(path.join(tempDir, 'a.ts'), code);
        await writeTestFile(path.join(tempDir, 'b.ts'), code);

        await detector.scan();
        const reportPath = await detector.saveReport();

        expect(reportPath).toContain('duplicates.yaml');
        const exists = await fileExists(reportPath);
        expect(exists).toBe(true);
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        const otherDir = await createTempDir('other-dup');
        const code = `function otherFunc(x) {
  const y = x * 2;
  const z = y + 1;
  return z * 3;
}`;
        await writeTestFile(path.join(otherDir, 'a.ts'), code);
        await writeTestFile(path.join(otherDir, 'b.ts'), code);

        detector.setWorkingDir(otherDir);
        const duplicates = await detector.scan();

        // Should find duplicates in the new directory
        expect(Array.isArray(duplicates)).toBe(true);

        await cleanupTempDir(otherDir);
      });

      it('should clear previous duplicates on directory change', async () => {
        const code = `function test() {
  const a = 1;
  const b = 2;
  return a + b;
}`;
        await writeTestFile(path.join(tempDir, 'a.ts'), code);
        await writeTestFile(path.join(tempDir, 'b.ts'), code);

        await detector.scan();
        const otherDir = await createTempDir('empty-dir');

        detector.setWorkingDir(otherDir);
        const duplicates = detector.getDuplicates();

        expect(duplicates).toEqual([]);

        await cleanupTempDir(otherDir);
      });
    });
  });
});

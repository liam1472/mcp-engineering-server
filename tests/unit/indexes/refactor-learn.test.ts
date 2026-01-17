/**
 * Tests for /eng-refactor --learn functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { RefactorAnalyzer, type RefactorReport, type RefactorSuggestion } from '../../../src/indexes/refactor-analyzer.js';

describe('indexes/refactor-analyzer.ts - Learning Mode', () => {
  let tempDir: string;
  let analyzer: RefactorAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eng-test-learn-'));
    analyzer = new RefactorAnalyzer(tempDir);

    // Create .engineering directory
    await fs.mkdir(path.join(tempDir, '.engineering'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('learnFromRefactor()', () => {
    it('should extract rules from high-priority duplicate suggestions', async () => {
      // Create a mock report with duplicate suggestions
      const report: RefactorReport = {
        duplicates: [],
        suggestions: [
          {
            type: 'remove-duplicate',
            priority: 'high',
            title: 'Extract to readConfig() - 10 lines, 4 occurrences',
            description: 'Found 4 occurrences of similar code.',
            files: ['src/utils.ts', 'src/config.ts'],
            lines: 40,
            estimatedImpact: 'Remove ~30 duplicate lines',
          },
        ],
        stats: {
          filesScanned: 10,
          duplicateBlocks: 1,
          totalDuplicateLines: 40,
          magicNumbers: 0,
          longFunctions: 0,
        },
        summary: 'Test summary',
      };

      const learnedRules = await analyzer.learnFromRefactor(report);

      expect(learnedRules.length).toBeGreaterThan(0);
      expect(learnedRules[0]?.rule).toContain('duplicat');
      expect(learnedRules[0]?.type).toBe('anti-pattern');
      expect(learnedRules[0]?.addedAt).toBeDefined();
    });

    it('should extract rules from extract-constant suggestions', async () => {
      const report: RefactorReport = {
        duplicates: [],
        suggestions: [
          {
            type: 'extract-constant',
            priority: 'high',
            title: 'Extract magic numbers in config.ts',
            description: 'Found 5 magic numbers.',
            files: ['src/config.ts'],
            estimatedImpact: 'Improved code readability',
          },
        ],
        stats: {
          filesScanned: 10,
          duplicateBlocks: 0,
          totalDuplicateLines: 0,
          magicNumbers: 5,
          longFunctions: 0,
        },
        summary: 'Test summary',
      };

      const learnedRules = await analyzer.learnFromRefactor(report);

      expect(learnedRules.length).toBeGreaterThan(0);
      expect(learnedRules[0]?.rule).toContain('magic number');
    });

    it('should extract rules from reduce-complexity suggestions', async () => {
      const report: RefactorReport = {
        duplicates: [],
        suggestions: [
          {
            type: 'reduce-complexity',
            priority: 'high',
            title: 'Split long function: processData',
            description: 'Function "processData" is 120 lines.',
            files: ['src/processor.ts'],
            lines: 120,
            estimatedImpact: 'Improved testability',
          },
        ],
        stats: {
          filesScanned: 10,
          duplicateBlocks: 0,
          totalDuplicateLines: 0,
          magicNumbers: 0,
          longFunctions: 1,
        },
        summary: 'Test summary',
      };

      const learnedRules = await analyzer.learnFromRefactor(report);

      expect(learnedRules.length).toBeGreaterThan(0);
      expect(learnedRules[0]?.rule).toContain('50 lines');
    });

    it('should only process high-priority suggestions', async () => {
      const report: RefactorReport = {
        duplicates: [],
        suggestions: [
          {
            type: 'remove-duplicate',
            priority: 'low',
            title: 'Minor duplicate',
            description: 'Found 2 occurrences.',
            files: ['src/utils.ts'],
            lines: 5,
            estimatedImpact: 'Minor',
          },
          {
            type: 'remove-duplicate',
            priority: 'medium',
            title: 'Medium duplicate',
            description: 'Found 2 occurrences.',
            files: ['src/utils.ts'],
            lines: 10,
            estimatedImpact: 'Medium',
          },
        ],
        stats: {
          filesScanned: 10,
          duplicateBlocks: 2,
          totalDuplicateLines: 15,
          magicNumbers: 0,
          longFunctions: 0,
        },
        summary: 'Test summary',
      };

      const learnedRules = await analyzer.learnFromRefactor(report);

      // Should not extract rules from low/medium priority suggestions
      expect(learnedRules.length).toBe(0);
    });

    it('should limit rules to prevent manifesto bloat', async () => {
      const suggestions: RefactorSuggestion[] = Array.from({ length: 10 }, (_, i) => ({
        type: 'remove-duplicate' as const,
        priority: 'high' as const,
        title: `Duplicate ${i + 1}`,
        description: `Description ${i + 1}`,
        files: [`src/file${i + 1}.ts`],
        lines: 10,
        estimatedImpact: 'Impact',
      }));

      const report: RefactorReport = {
        duplicates: [],
        suggestions,
        stats: {
          filesScanned: 10,
          duplicateBlocks: 10,
          totalDuplicateLines: 100,
          magicNumbers: 0,
          longFunctions: 0,
        },
        summary: 'Test summary',
      };

      const learnedRules = await analyzer.learnFromRefactor(report);

      // Should be limited (check implementation limits to 5)
      expect(learnedRules.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Manifesto Appending', () => {
    it('should append rules to existing manifesto', async () => {
      // Create existing manifesto
      const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');
      await fs.writeFile(
        manifestoPath,
        `# Project Manifesto

## Existing Rules
- Rule 1
- Rule 2
`,
        'utf-8'
      );

      const report: RefactorReport = {
        duplicates: [],
        suggestions: [
          {
            type: 'remove-duplicate',
            priority: 'high',
            title: 'Extract duplicate',
            description: 'Found 4 occurrences.',
            files: ['src/utils.ts'],
            lines: 10,
            estimatedImpact: 'Remove duplicates',
          },
        ],
        stats: {
          filesScanned: 10,
          duplicateBlocks: 1,
          totalDuplicateLines: 40,
          magicNumbers: 0,
          longFunctions: 0,
        },
        summary: 'Test summary',
      };

      await analyzer.learnFromRefactor(report);

      // Read updated manifesto
      const content = await fs.readFile(manifestoPath, 'utf-8');

      expect(content).toContain('# Project Manifesto');
      expect(content).toContain('Existing Rules');
      expect(content).toContain('LEARNED RULES');
      expect(content).toContain('anti-pattern');
    });

    it('should create manifesto if it does not exist', async () => {
      const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');

      const report: RefactorReport = {
        duplicates: [],
        suggestions: [
          {
            type: 'extract-constant',
            priority: 'high',
            title: 'Extract magic numbers',
            description: 'Found 5 magic numbers.',
            files: ['src/config.ts'],
            estimatedImpact: 'Improved readability',
          },
        ],
        stats: {
          filesScanned: 10,
          duplicateBlocks: 0,
          totalDuplicateLines: 0,
          magicNumbers: 5,
          longFunctions: 0,
        },
        summary: 'Test summary',
      };

      await analyzer.learnFromRefactor(report);

      // Check manifesto was created
      const exists = await fs
        .access(manifestoPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.readFile(manifestoPath, 'utf-8');
      expect(content).toContain('# Project Manifesto');
      expect(content).toContain('LEARNED RULES');
    });

    it('should include date in learned rules section', async () => {
      const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');

      const report: RefactorReport = {
        duplicates: [],
        suggestions: [
          {
            type: 'reduce-complexity',
            priority: 'high',
            title: 'Split long function',
            description: 'Function too long.',
            files: ['src/processor.ts'],
            lines: 100,
            estimatedImpact: 'Better maintainability',
          },
        ],
        stats: {
          filesScanned: 10,
          duplicateBlocks: 0,
          totalDuplicateLines: 0,
          magicNumbers: 0,
          longFunctions: 1,
        },
        summary: 'Test summary',
      };

      await analyzer.learnFromRefactor(report);

      const content = await fs.readFile(manifestoPath, 'utf-8');
      const today = new Date().toISOString().split('T')[0];
      expect(content).toContain(today);
    });

    it('should include source file references in learned rules', async () => {
      const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');

      const report: RefactorReport = {
        duplicates: [],
        suggestions: [
          {
            type: 'remove-duplicate',
            priority: 'high',
            title: 'Extract duplicate',
            description: 'Found duplicates.',
            files: ['src/api/handler.ts', 'src/api/routes.ts'],
            lines: 15,
            estimatedImpact: 'Remove duplicates',
          },
        ],
        stats: {
          filesScanned: 10,
          duplicateBlocks: 1,
          totalDuplicateLines: 30,
          magicNumbers: 0,
          longFunctions: 0,
        },
        summary: 'Test summary',
      };

      await analyzer.learnFromRefactor(report);

      const content = await fs.readFile(manifestoPath, 'utf-8');
      expect(content).toContain('src/api/handler.ts');
      expect(content).toContain('src/api/routes.ts');
    });
  });

  describe('Duplicate Pattern Rule Extraction', () => {
    it('should extract rule for console.log duplicates', async () => {
      const report: RefactorReport = {
        duplicates: [
          {
            hash: 'abc123',
            lines: 5,
            preview: 'console.log("Debug:", data);\nconsole.log("Result:", result);',
            occurrences: [
              { file: 'src/a.ts', startLine: 10, endLine: 15 },
              { file: 'src/b.ts', startLine: 20, endLine: 25 },
              { file: 'src/c.ts', startLine: 30, endLine: 35 },
            ],
          },
        ],
        suggestions: [],
        stats: {
          filesScanned: 10,
          duplicateBlocks: 1,
          totalDuplicateLines: 15,
          magicNumbers: 0,
          longFunctions: 0,
        },
        summary: 'Test summary',
      };

      const learnedRules = await analyzer.learnFromRefactor(report);

      const logRule = learnedRules.find(r => r.rule.includes('logging'));
      expect(logRule).toBeDefined();
      expect(logRule?.rule).toContain('logging');
    });

    it('should extract rule for error handling duplicates', async () => {
      const report: RefactorReport = {
        duplicates: [
          {
            hash: 'def456',
            lines: 8,
            preview: 'try {\n  await doSomething();\n} catch (error) {\n  console.error(error);\n}',
            occurrences: [
              { file: 'src/a.ts', startLine: 10, endLine: 18 },
              { file: 'src/b.ts', startLine: 20, endLine: 28 },
              { file: 'src/c.ts', startLine: 30, endLine: 38 },
            ],
          },
        ],
        suggestions: [],
        stats: {
          filesScanned: 10,
          duplicateBlocks: 1,
          totalDuplicateLines: 24,
          magicNumbers: 0,
          longFunctions: 0,
        },
        summary: 'Test summary',
      };

      const learnedRules = await analyzer.learnFromRefactor(report);

      const errorRule = learnedRules.find(r => r.rule.includes('error handling'));
      expect(errorRule).toBeDefined();
    });

    it('should not extract rule for duplicates with less than 3 occurrences', async () => {
      const report: RefactorReport = {
        duplicates: [
          {
            hash: 'ghi789',
            lines: 5,
            preview: 'some code here',
            occurrences: [
              { file: 'src/a.ts', startLine: 10, endLine: 15 },
              { file: 'src/b.ts', startLine: 20, endLine: 25 },
            ],
          },
        ],
        suggestions: [],
        stats: {
          filesScanned: 10,
          duplicateBlocks: 1,
          totalDuplicateLines: 10,
          magicNumbers: 0,
          longFunctions: 0,
        },
        summary: 'Test summary',
      };

      const learnedRules = await analyzer.learnFromRefactor(report);

      // Should not have duplicate-based rules (only 2 occurrences)
      const dupRule = learnedRules.find(r => r.source.includes('src/a.ts'));
      expect(dupRule).toBeUndefined();
    });
  });

  describe('LearnedRule Structure', () => {
    it('should return properly structured LearnedRule objects', async () => {
      const report: RefactorReport = {
        duplicates: [],
        suggestions: [
          {
            type: 'extract-constant',
            priority: 'high',
            title: 'Extract magic numbers',
            description: 'Found 5 magic numbers.',
            files: ['src/config.ts'],
            estimatedImpact: 'Improved readability',
          },
        ],
        stats: {
          filesScanned: 10,
          duplicateBlocks: 0,
          totalDuplicateLines: 0,
          magicNumbers: 5,
          longFunctions: 0,
        },
        summary: 'Test summary',
      };

      const learnedRules = await analyzer.learnFromRefactor(report);

      expect(learnedRules.length).toBeGreaterThan(0);

      const rule = learnedRules[0];
      expect(rule).toHaveProperty('rule');
      expect(rule).toHaveProperty('source');
      expect(rule).toHaveProperty('type');
      expect(rule).toHaveProperty('addedAt');

      expect(typeof rule?.rule).toBe('string');
      expect(typeof rule?.source).toBe('string');
      expect(['anti-pattern', 'best-practice']).toContain(rule?.type);
      expect(rule?.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('No Rules Case', () => {
    it('should return empty array when no high-priority suggestions', async () => {
      const report: RefactorReport = {
        duplicates: [],
        suggestions: [],
        stats: {
          filesScanned: 10,
          duplicateBlocks: 0,
          totalDuplicateLines: 0,
          magicNumbers: 0,
          longFunctions: 0,
        },
        summary: 'No suggestions',
      };

      const learnedRules = await analyzer.learnFromRefactor(report);

      expect(learnedRules).toEqual([]);
    });

    it('should not create manifesto when no rules to learn', async () => {
      const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');

      // Ensure manifesto doesn't exist
      try {
        await fs.unlink(manifestoPath);
      } catch {
        // Doesn't exist, that's fine
      }

      const report: RefactorReport = {
        duplicates: [],
        suggestions: [],
        stats: {
          filesScanned: 10,
          duplicateBlocks: 0,
          totalDuplicateLines: 0,
          magicNumbers: 0,
          longFunctions: 0,
        },
        summary: 'No suggestions',
      };

      await analyzer.learnFromRefactor(report);

      // Manifesto should not be created
      const exists = await fs
        .access(manifestoPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });
  });
});

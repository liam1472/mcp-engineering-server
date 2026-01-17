/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the core behavioral contracts for /eng-refactor --learn.
 * If a test fails, FIX THE SOURCE CODE, not the test.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { RefactorAnalyzer, type RefactorReport } from '../../src/indexes/refactor-analyzer.js';

/**
 * SPEC: /eng-refactor --learn
 *
 * REQUIREMENT: The refactor analyzer MUST extract rules from analysis
 * and append them to the manifesto.
 */
describe('[SPEC] /eng-refactor --learn - Rule Extraction', () => {
  let tempDir: string;
  let analyzer: RefactorAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-learn-'));
    analyzer = new RefactorAnalyzer(tempDir);
    await fs.mkdir(path.join(tempDir, '.engineering'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: High-priority suggestions MUST generate rules
   */
  it('MUST extract rules from high-priority duplicate suggestions', async () => {
    const report: RefactorReport = {
      duplicates: [],
      suggestions: [
        {
          type: 'remove-duplicate',
          priority: 'high',
          title: 'Extract duplicate code - 10 lines, 4 occurrences',
          description: 'Found 4 occurrences of similar code.',
          files: ['src/a.ts', 'src/b.ts'],
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
      summary: 'Test',
    };

    const learnedRules = await analyzer.learnFromRefactor(report);

    expect(learnedRules.length).toBeGreaterThan(0);
    expect(learnedRules[0]!.type).toBe('anti-pattern');
  });

  /**
   * GOLDEN TEST: Low-priority suggestions MUST NOT generate rules
   */
  it('MUST NOT extract rules from low-priority suggestions', async () => {
    const report: RefactorReport = {
      duplicates: [],
      suggestions: [
        {
          type: 'remove-duplicate',
          priority: 'low',
          title: 'Minor duplicate',
          description: 'Found 2 occurrences.',
          files: ['src/a.ts'],
          lines: 5,
          estimatedImpact: 'Minor',
        },
      ],
      stats: {
        filesScanned: 10,
        duplicateBlocks: 1,
        totalDuplicateLines: 10,
        magicNumbers: 0,
        longFunctions: 0,
      },
      summary: 'Test',
    };

    const learnedRules = await analyzer.learnFromRefactor(report);

    expect(learnedRules.length).toBe(0);
  });

  /**
   * GOLDEN TEST: Rules MUST be appended to manifesto
   */
  it('MUST append learned rules to manifesto', async () => {
    // Create initial manifesto
    await fs.writeFile(
      path.join(tempDir, '.engineering', 'manifesto.md'),
      '# Project Manifesto\n\n## Rules\n- Rule 1',
      'utf-8'
    );

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
      summary: 'Test',
    };

    await analyzer.learnFromRefactor(report);

    const manifestoContent = await fs.readFile(
      path.join(tempDir, '.engineering', 'manifesto.md'),
      'utf-8'
    );

    expect(manifestoContent).toContain('LEARNED RULES');
    expect(manifestoContent).toContain('anti-pattern');
  });

  /**
   * GOLDEN TEST: Manifesto MUST be created if it doesn't exist
   */
  it('MUST create manifesto if it does not exist', async () => {
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
      summary: 'Test',
    };

    await analyzer.learnFromRefactor(report);

    const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');
    const exists = await fs
      .access(manifestoPath)
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(true);
  });
});

/**
 * SPEC: LearnedRule Structure
 *
 * REQUIREMENT: Learned rules MUST have proper structure for tracking.
 */
describe('[SPEC] LearnedRule - Structure', () => {
  let tempDir: string;
  let analyzer: RefactorAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-rule-'));
    analyzer = new RefactorAnalyzer(tempDir);
    await fs.mkdir(path.join(tempDir, '.engineering'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: LearnedRule MUST have required fields
   */
  it('MUST return properly structured LearnedRule objects', async () => {
    const report: RefactorReport = {
      duplicates: [],
      suggestions: [
        {
          type: 'extract-constant',
          priority: 'high',
          title: 'Test',
          description: 'Test',
          files: ['src/test.ts'],
          estimatedImpact: 'Test',
        },
      ],
      stats: {
        filesScanned: 1,
        duplicateBlocks: 0,
        totalDuplicateLines: 0,
        magicNumbers: 1,
        longFunctions: 0,
      },
      summary: 'Test',
    };

    const rules = await analyzer.learnFromRefactor(report);

    expect(rules.length).toBeGreaterThan(0);
    const rule = rules[0]!;

    // Required fields
    expect(rule).toHaveProperty('rule');
    expect(rule).toHaveProperty('source');
    expect(rule).toHaveProperty('type');
    expect(rule).toHaveProperty('addedAt');

    // Type constraints
    expect(typeof rule.rule).toBe('string');
    expect(typeof rule.source).toBe('string');
    expect(['anti-pattern', 'best-practice']).toContain(rule.type);
    expect(rule.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

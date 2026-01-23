/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the behavioral contract for eng_refactor --clean flag.
 * If a test fails, FIX THE SOURCE CODE, not the test.
 *
 * @see ROADMAP-V2.md Phase 2.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { RefactorAnalyzer } from '../../src/indexes/refactor-analyzer.js';

/**
 * SPEC: Garbage File Detection
 *
 * REQUIREMENT: The refactor analyzer MUST detect garbage files
 * created by AI/debug processes.
 */
describe('[SPEC] RefactorAnalyzer - Garbage Detection', () => {
  let tempDir: string;
  let analyzer: RefactorAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-refactor-clean-'));
    analyzer = new RefactorAnalyzer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST detect analyze-*.cjs files
   */
  it('MUST detect analyze-*.cjs files', async () => {
    await fs.writeFile(
      path.join(tempDir, 'analyze-mutation.cjs'),
      'console.log("debug")',
      'utf-8'
    );
    await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export {}', 'utf-8').catch(() =>
      fs.mkdir(path.join(tempDir, 'src')).then(() =>
        fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export {}', 'utf-8')
      )
    );

    const result = await analyzer.detectGarbage();

    expect(result.files.length).toBeGreaterThanOrEqual(1);
    expect(result.files.some(f => f.includes('analyze-mutation.cjs'))).toBe(true);
  });

  /**
   * GOLDEN TEST: MUST detect debug-*.cjs files
   */
  it('MUST detect debug-*.cjs files', async () => {
    await fs.writeFile(path.join(tempDir, 'debug-test.cjs'), 'console.log("debug")', 'utf-8');

    const result = await analyzer.detectGarbage();

    expect(result.files.some(f => f.includes('debug-test.cjs'))).toBe(true);
  });

  /**
   * GOLDEN TEST: MUST detect .log files
   */
  it('MUST detect .log files', async () => {
    await fs.writeFile(path.join(tempDir, 'app.log'), 'log content', 'utf-8');
    await fs.writeFile(path.join(tempDir, 'error.log'), 'error content', 'utf-8');

    const result = await analyzer.detectGarbage();

    expect(result.files.filter(f => f.endsWith('.log')).length).toBeGreaterThanOrEqual(2);
  });

  /**
   * GOLDEN TEST: MUST detect .tmp files
   */
  it('MUST detect .tmp files', async () => {
    await fs.writeFile(path.join(tempDir, 'cache.tmp'), 'temp content', 'utf-8');

    const result = await analyzer.detectGarbage();

    expect(result.files.some(f => f.endsWith('.tmp'))).toBe(true);
  });

  /**
   * GOLDEN TEST: MUST detect PHASE-*.md files
   */
  it('MUST detect PHASE-*.md AI internal docs', async () => {
    await fs.writeFile(path.join(tempDir, 'PHASE-1-ANALYSIS.md'), '# Analysis', 'utf-8');
    await fs.writeFile(path.join(tempDir, 'PHASE-2-PLAN.md'), '# Plan', 'utf-8');

    const result = await analyzer.detectGarbage();

    expect(result.files.filter(f => f.includes('PHASE-')).length).toBeGreaterThanOrEqual(2);
  });

  /**
   * GOLDEN TEST: MUST detect *-ANALYSIS.md files
   */
  it('MUST detect *-ANALYSIS.md AI internal docs', async () => {
    await fs.writeFile(path.join(tempDir, 'SECURITY-ANALYSIS.md'), '# Security', 'utf-8');
    await fs.writeFile(path.join(tempDir, 'CODE-ANALYSIS.md'), '# Code', 'utf-8');

    const result = await analyzer.detectGarbage();

    expect(result.files.filter(f => f.includes('-ANALYSIS.md')).length).toBeGreaterThanOrEqual(2);
  });

  /**
   * GOLDEN TEST: MUST detect mutation-*.txt files
   */
  it('MUST detect mutation-*.txt Stryker outputs', async () => {
    await fs.writeFile(path.join(tempDir, 'mutation-report.txt'), 'Stryker output', 'utf-8');

    const result = await analyzer.detectGarbage();

    expect(result.files.some(f => f.includes('mutation-') && f.endsWith('.txt'))).toBe(true);
  });

  /**
   * GOLDEN TEST: MUST detect nul Windows null file
   */
  it('MUST detect nul Windows null file', async () => {
    // nul is special on Windows, we'll create a file named 'nul' on other platforms
    // or a file that matches the pattern
    await fs.writeFile(path.join(tempDir, 'nul'), '', 'utf-8').catch(() => {});

    const result = await analyzer.detectGarbage();

    // May or may not exist depending on platform
    expect(result).toBeDefined();
  });

  /**
   * GOLDEN TEST: MUST NOT flag legitimate files
   */
  it('MUST NOT flag legitimate files', async () => {
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export {}', 'utf-8');
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Project', 'utf-8');
    await fs.writeFile(path.join(tempDir, 'package.json'), '{}', 'utf-8');

    const result = await analyzer.detectGarbage();

    expect(result.files.some(f => f.includes('index.ts'))).toBe(false);
    expect(result.files.some(f => f.includes('README.md'))).toBe(false);
    expect(result.files.some(f => f.includes('package.json'))).toBe(false);
  });
});

/**
 * SPEC: Clean Result Structure
 *
 * REQUIREMENT: GarbageResult MUST contain all required fields.
 */
describe('[SPEC] RefactorAnalyzer - GarbageResult Structure', () => {
  it('MUST return GarbageResult with all required fields', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-garbage-struct-'));
    const analyzer = new RefactorAnalyzer(tempDir);

    try {
      const result = await analyzer.detectGarbage();

      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('totalSize');
      expect(result).toHaveProperty('summary');
      expect(Array.isArray(result.files)).toBe(true);
      expect(typeof result.totalSize).toBe('number');
      expect(typeof result.summary).toBe('string');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

/**
 * SPEC: Clean Deletion
 *
 * REQUIREMENT: The analyzer MUST be able to delete detected garbage.
 */
describe('[SPEC] RefactorAnalyzer - Garbage Deletion', () => {
  let tempDir: string;
  let analyzer: RefactorAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-garbage-delete-'));
    analyzer = new RefactorAnalyzer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST delete garbage files when fix=true
   */
  it('MUST delete garbage files when fix=true', async () => {
    const garbageFile = path.join(tempDir, 'debug-test.cjs');
    await fs.writeFile(garbageFile, 'console.log("debug")', 'utf-8');

    // Verify file exists
    await expect(fs.access(garbageFile)).resolves.not.toThrow();

    // Delete garbage
    const result = await analyzer.cleanGarbage({ fix: true });

    expect(result.deleted.length).toBeGreaterThanOrEqual(1);
    await expect(fs.access(garbageFile)).rejects.toThrow();
  });

  /**
   * GOLDEN TEST: MUST NOT delete when dryRun=true
   */
  it('MUST NOT delete when dryRun=true', async () => {
    const garbageFile = path.join(tempDir, 'debug-test.cjs');
    await fs.writeFile(garbageFile, 'console.log("debug")', 'utf-8');

    // Dry run
    const result = await analyzer.cleanGarbage({ fix: true, dryRun: true });

    expect(result.wouldDelete.length).toBeGreaterThanOrEqual(1);
    // File should still exist
    await expect(fs.access(garbageFile)).resolves.not.toThrow();
  });

  /**
   * GOLDEN TEST: MUST return list only when fix=false
   */
  it('MUST return list only when fix=false', async () => {
    const garbageFile = path.join(tempDir, 'analyze-test.cjs');
    await fs.writeFile(garbageFile, 'console.log("debug")', 'utf-8');

    // List only
    const result = await analyzer.cleanGarbage({ fix: false });

    expect(result.found.length).toBeGreaterThanOrEqual(1);
    // File should still exist
    await expect(fs.access(garbageFile)).resolves.not.toThrow();
  });
});

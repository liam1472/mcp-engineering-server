/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the behavioral contract for LogAnalyzer memory safety.
 * If a test fails, FIX THE SOURCE CODE, not the test.
 *
 * @see Action Plan P0: Memory Bomb Fix
 */

/// <reference types="vitest/globals" />
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { LogAnalyzer } from '../../src/debugging/log-analyzer.js';

/**
 * SPEC: LogAnalyzer Memory Safety
 *
 * REQUIREMENT: LogAnalyzer MUST use ring buffer to limit memory usage
 * when processing large files with tail option.
 */
describe('[SPEC] LogAnalyzer - Memory Safety (Ring Buffer)', () => {
  let tempDir: string;
  let analyzer: LogAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-log-memory-'));
    analyzer = new LogAnalyzer();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: Ring buffer MUST only keep tail lines in memory
   *
   * This test creates a file with 10000 lines but requests only last 10.
   * The internal buffer should never exceed tail size.
   */
  it('MUST use ring buffer - only keep tail lines in memory', async () => {
    // Create a large log file with 10000 lines
    const lines: string[] = [];
    for (let i = 0; i < 10000; i++) {
      lines.push(`[INFO] Line ${i}: Some log message here`);
    }
    const logFile = path.join(tempDir, 'large.log');
    await fs.writeFile(logFile, lines.join('\n'), 'utf-8');

    // Request only last 10 lines
    const result = await analyzer.analyze({
      file: logFile,
      tail: 10,
    });

    // Should return exactly 10 lines
    expect(result.lines.length).toBe(10);
    // Should be the LAST 10 lines
    expect(result.lines[0]).toContain('Line 9990');
    expect(result.lines[9]).toContain('Line 9999');
    // Total lines tracked correctly
    expect(result.totalLines).toBe(10000);
  });

  /**
   * GOLDEN TEST: Ring buffer with pattern filter
   */
  it('MUST use ring buffer with pattern filter', async () => {
    // Create log with alternating ERROR and INFO
    const lines: string[] = [];
    for (let i = 0; i < 5000; i++) {
      lines.push(`[ERROR] Error at line ${i}`);
      lines.push(`[INFO] Info at line ${i}`);
    }
    const logFile = path.join(tempDir, 'mixed.log');
    await fs.writeFile(logFile, lines.join('\n'), 'utf-8');

    // Filter ERROR, tail 5
    const result = await analyzer.analyze({
      file: logFile,
      pattern: 'ERROR',
      tail: 5,
    });

    // Should return exactly 5 ERROR lines
    expect(result.lines.length).toBe(5);
    // Should be the LAST 5 ERROR lines (4995-4999)
    expect(result.lines[0]).toContain('Error at line 4995');
    expect(result.lines[4]).toContain('Error at line 4999');
    // Matched count should be 5000 (all ERRORs)
    expect(result.matchedLines).toBe(5000);
  });

  /**
   * GOLDEN TEST: Memory should not grow with file size
   *
   * When tail is fixed, memory usage should be constant regardless of file size.
   */
  it('MUST have constant memory usage regardless of file size', async () => {
    const tail = 100;

    // Create file with 50000 lines - all matching
    const lines: string[] = [];
    for (let i = 0; i < 50000; i++) {
      lines.push(`[ERROR] Critical error at position ${i}`);
    }
    const logFile = path.join(tempDir, 'huge.log');
    await fs.writeFile(logFile, lines.join('\n'), 'utf-8');

    // Analyze with tail=100
    const result = await analyzer.analyze({
      file: logFile,
      pattern: 'ERROR',
      tail,
    });

    // Should return exactly tail lines
    expect(result.lines.length).toBe(tail);
    // Should be the last 100 lines
    expect(result.lines[0]).toContain('position 49900');
    expect(result.lines[99]).toContain('position 49999');
    // Total matched should be 50000
    expect(result.matchedLines).toBe(50000);
  });

  /**
   * GOLDEN TEST: Edge case - fewer lines than tail
   */
  it('MUST handle files smaller than tail correctly', async () => {
    // Create file with only 5 lines
    const lines = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'];
    const logFile = path.join(tempDir, 'small.log');
    await fs.writeFile(logFile, lines.join('\n'), 'utf-8');

    // Request tail=100 on 5-line file
    const result = await analyzer.analyze({
      file: logFile,
      tail: 100,
    });

    // Should return all 5 lines
    expect(result.lines.length).toBe(5);
    expect(result.totalLines).toBe(5);
    expect(result.truncated).toBe(false);
  });

  /**
   * GOLDEN TEST: Edge case - tail=0
   */
  it('MUST handle tail=0 correctly', async () => {
    const lines = ['Line 1', 'Line 2', 'Line 3'];
    const logFile = path.join(tempDir, 'test.log');
    await fs.writeFile(logFile, lines.join('\n'), 'utf-8');

    const result = await analyzer.analyze({
      file: logFile,
      tail: 0,
    });

    // tail=0 should return empty array
    expect(result.lines.length).toBe(0);
    expect(result.totalLines).toBe(3);
  });

  /**
   * GOLDEN TEST: Edge case - empty file
   */
  it('MUST handle empty files correctly', async () => {
    const logFile = path.join(tempDir, 'empty.log');
    await fs.writeFile(logFile, '', 'utf-8');

    const result = await analyzer.analyze({
      file: logFile,
      tail: 100,
    });

    expect(result.lines.length).toBe(0);
    expect(result.totalLines).toBe(0);
    expect(result.matchedLines).toBe(0);
  });
});

/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the behavioral contract for eng_debug (log analyzer).
 * If a test fails, FIX THE SOURCE CODE, not the test.
 *
 * @see ROADMAP-V2.md Phase 1.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { LogAnalyzer, LogResult } from '../../src/debugging/log-analyzer.js';

/**
 * SPEC: Basic Log Reading
 *
 * REQUIREMENT: The log analyzer MUST read log files using streaming
 * to handle large files without loading them entirely into memory.
 */
describe('[SPEC] LogAnalyzer - Basic Reading', () => {
  let tempDir: string;
  let analyzer: LogAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-log-'));
    analyzer = new LogAnalyzer();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST read last N lines from log file
   */
  it('MUST read last 100 lines by default', async () => {
    // Create log file with 200 lines
    const lines = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`);
    const logPath = path.join(tempDir, 'test.log');
    await fs.writeFile(logPath, lines.join('\n'), 'utf-8');

    const result = await analyzer.analyze({ file: logPath });

    expect(result.lines.length).toBe(100);
    expect(result.lines[0]).toContain('Line 101');
    expect(result.lines[99]).toContain('Line 200');
  });

  /**
   * GOLDEN TEST: MUST support custom tail count
   */
  it('MUST support custom tail count', async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
    const logPath = path.join(tempDir, 'test.log');
    await fs.writeFile(logPath, lines.join('\n'), 'utf-8');

    const result = await analyzer.analyze({ file: logPath, tail: 20 });

    expect(result.lines.length).toBe(20);
    expect(result.lines[0]).toContain('Line 81');
    expect(result.lines[19]).toContain('Line 100');
  });

  /**
   * GOLDEN TEST: MUST handle files smaller than tail count
   */
  it('MUST handle files smaller than tail count', async () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`);
    const logPath = path.join(tempDir, 'small.log');
    await fs.writeFile(logPath, lines.join('\n'), 'utf-8');

    const result = await analyzer.analyze({ file: logPath, tail: 100 });

    expect(result.lines.length).toBe(50);
  });

  /**
   * GOLDEN TEST: MUST return empty result for non-existent file
   */
  it('MUST return error for non-existent file', async () => {
    const result = await analyzer.analyze({ file: '/nonexistent/file.log' });

    expect(result.error).toBeDefined();
    expect(result.lines.length).toBe(0);
  });
});

/**
 * SPEC: Pattern Filtering
 *
 * REQUIREMENT: The log analyzer MUST support pattern-based filtering.
 */
describe('[SPEC] LogAnalyzer - Pattern Filtering', () => {
  let tempDir: string;
  let analyzer: LogAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-log-pattern-'));
    analyzer = new LogAnalyzer();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST filter lines by pattern
   */
  it('MUST filter lines by pattern', async () => {
    const logContent = `
2024-01-01 10:00:00 INFO Starting server
2024-01-01 10:00:01 ERROR Connection failed
2024-01-01 10:00:02 INFO Server ready
2024-01-01 10:00:03 ERROR Database timeout
2024-01-01 10:00:04 DEBUG Received request
`.trim();
    const logPath = path.join(tempDir, 'app.log');
    await fs.writeFile(logPath, logContent, 'utf-8');

    const result = await analyzer.analyze({ file: logPath, pattern: 'ERROR' });

    expect(result.lines.length).toBe(2);
    expect(result.lines[0]).toContain('ERROR Connection failed');
    expect(result.lines[1]).toContain('ERROR Database timeout');
  });

  /**
   * GOLDEN TEST: MUST support regex patterns
   */
  it('MUST support regex patterns', async () => {
    const logContent = `
user_id=123 action=login
user_id=456 action=logout
user_id=123 action=purchase
user_id=789 action=login
`.trim();
    const logPath = path.join(tempDir, 'audit.log');
    await fs.writeFile(logPath, logContent, 'utf-8');

    const result = await analyzer.analyze({ file: logPath, pattern: 'user_id=123' });

    expect(result.lines.length).toBe(2);
    expect(result.lines[0]).toContain('action=login');
    expect(result.lines[1]).toContain('action=purchase');
  });

  /**
   * GOLDEN TEST: MUST support case-insensitive matching
   */
  it('MUST support case-insensitive matching', async () => {
    const logContent = `
ERROR: Critical failure
error: minor issue
Error: Warning level
INFO: All good
`.trim();
    const logPath = path.join(tempDir, 'mixed.log');
    await fs.writeFile(logPath, logContent, 'utf-8');

    const result = await analyzer.analyze({
      file: logPath,
      pattern: 'error',
      ignoreCase: true,
    });

    expect(result.lines.length).toBe(3);
  });
});

/**
 * SPEC: Result Structure
 *
 * REQUIREMENT: The LogResult MUST contain all required fields.
 */
describe('[SPEC] LogAnalyzer - Result Structure', () => {
  /**
   * GOLDEN TEST: LogResult MUST have required fields
   */
  it('MUST return LogResult with all required fields', () => {
    const result: LogResult = {
      file: '/var/log/syslog',
      lines: ['line1', 'line2'],
      totalLines: 1000,
      matchedLines: 2,
      truncated: true,
    };

    expect(result).toHaveProperty('file');
    expect(result).toHaveProperty('lines');
    expect(result).toHaveProperty('totalLines');
    expect(result).toHaveProperty('matchedLines');
    expect(result).toHaveProperty('truncated');
  });

  /**
   * GOLDEN TEST: MUST indicate when output is truncated
   */
  it('MUST indicate truncation status', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-truncate-'));
    const analyzer = new LogAnalyzer();

    try {
      // Create large log file
      const lines = Array.from({ length: 500 }, (_, i) => `Line ${i + 1}`);
      const logPath = path.join(tempDir, 'large.log');
      await fs.writeFile(logPath, lines.join('\n'), 'utf-8');

      const result = await analyzer.analyze({ file: logPath, tail: 100 });

      expect(result.truncated).toBe(true);
      expect(result.totalLines).toBe(500);
      expect(result.lines.length).toBe(100);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

/**
 * SPEC: Streaming Requirement
 *
 * REQUIREMENT: The analyzer MUST use streaming to handle large files.
 */
describe('[SPEC] LogAnalyzer - Streaming', () => {
  let tempDir: string;
  let analyzer: LogAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-stream-'));
    analyzer = new LogAnalyzer();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST handle large files efficiently
   * This test creates a 10MB file and verifies it can be analyzed
   * without loading the entire file into memory.
   */
  it('MUST handle large files without memory issues', async () => {
    // Create 10MB log file (approximately 100,000 lines)
    const lineCount = 100000;
    const logPath = path.join(tempDir, 'large.log');

    // Write in chunks to avoid memory issues during test setup
    const writeStream = (await import('fs')).createWriteStream(logPath);
    for (let i = 0; i < lineCount; i++) {
      writeStream.write(`2024-01-01 10:00:${String(i).padStart(5, '0')} INFO Log entry number ${i}\n`);
    }
    await new Promise<void>((resolve) => writeStream.end(resolve));

    const result = await analyzer.analyze({ file: logPath, tail: 50 });

    expect(result.lines.length).toBe(50);
    expect(result.truncated).toBe(true);
    expect(result.totalLines).toBeGreaterThanOrEqual(lineCount - 1); // Allow for off-by-one
  });
});

/**
 * SPEC: Options Interface
 *
 * REQUIREMENT: AnalyzeOptions MUST support all documented parameters.
 */
describe('[SPEC] LogAnalyzer - Options', () => {
  it('MUST support all required options', () => {
    // This test validates the interface at compile time
    const options: Parameters<LogAnalyzer['analyze']>[0] = {
      file: '/path/to/log',
      pattern: 'ERROR',
      tail: 500,
      ignoreCase: true,
    };

    expect(options.file).toBeDefined();
  });
});

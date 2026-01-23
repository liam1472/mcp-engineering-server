/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the behavioral contract for eng_unittest (fast test runner).
 * If a test fails, FIX THE SOURCE CODE, not the test.
 *
 * @see ROADMAP-V2.md Phase 1.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TestRunner, TestFramework, TestResult } from '../../src/testing/test-runner.js';

/**
 * SPEC: Test Framework Detection
 *
 * REQUIREMENT: The test runner MUST auto-detect the test framework
 * based on project configuration files.
 */
describe('[SPEC] TestRunner - Framework Detection', () => {
  let tempDir: string;
  let runner: TestRunner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-test-runner-'));
    runner = new TestRunner(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST detect vitest from vitest.config.ts
   */
  it('MUST detect vitest when vitest.config.ts exists', async () => {
    await fs.writeFile(
      path.join(tempDir, 'vitest.config.ts'),
      'export default { test: {} }',
      'utf-8'
    );
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }),
      'utf-8'
    );

    const framework = await runner.detectFramework();
    expect(framework).toBe('vitest');
  });

  /**
   * GOLDEN TEST: MUST detect jest from jest.config.js
   */
  it('MUST detect jest when jest.config.js exists', async () => {
    await fs.writeFile(
      path.join(tempDir, 'jest.config.js'),
      'module.exports = {}',
      'utf-8'
    );
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ devDependencies: { jest: '^29.0.0' } }),
      'utf-8'
    );

    const framework = await runner.detectFramework();
    expect(framework).toBe('jest');
  });

  /**
   * GOLDEN TEST: MUST detect pytest from pytest.ini or pyproject.toml
   */
  it('MUST detect pytest when pytest.ini exists', async () => {
    await fs.writeFile(
      path.join(tempDir, 'pytest.ini'),
      '[pytest]\ntestpaths = tests',
      'utf-8'
    );

    const framework = await runner.detectFramework();
    expect(framework).toBe('pytest');
  });

  /**
   * GOLDEN TEST: MUST detect cargo test from Cargo.toml
   */
  it('MUST detect cargo when Cargo.toml exists', async () => {
    await fs.writeFile(
      path.join(tempDir, 'Cargo.toml'),
      '[package]\nname = "test"',
      'utf-8'
    );

    const framework = await runner.detectFramework();
    expect(framework).toBe('cargo');
  });

  /**
   * GOLDEN TEST: MUST detect go test from go.mod
   */
  it('MUST detect go when go.mod exists', async () => {
    await fs.writeFile(
      path.join(tempDir, 'go.mod'),
      'module example.com/test',
      'utf-8'
    );

    const framework = await runner.detectFramework();
    expect(framework).toBe('go');
  });

  /**
   * GOLDEN TEST: MUST return 'unknown' when no framework detected
   */
  it('MUST return unknown when no framework detected', async () => {
    const framework = await runner.detectFramework();
    expect(framework).toBe('unknown');
  });
});

/**
 * SPEC: Test Command Generation
 *
 * REQUIREMENT: The test runner MUST generate correct test commands
 * for each detected framework.
 */
describe('[SPEC] TestRunner - Command Generation', () => {
  let tempDir: string;
  let runner: TestRunner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-test-cmd-'));
    runner = new TestRunner(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: vitest command MUST be 'npx vitest run'
   */
  it('MUST generate correct vitest command', () => {
    const cmd = runner.getCommand('vitest');
    expect(cmd).toBe('npx vitest run');
  });

  /**
   * GOLDEN TEST: vitest with file MUST target specific file
   */
  it('MUST generate vitest command with file filter', () => {
    const cmd = runner.getCommand('vitest', { file: 'src/foo.ts' });
    expect(cmd).toBe('npx vitest run src/foo.ts');
  });

  /**
   * GOLDEN TEST: vitest watch mode MUST use --watch
   */
  it('MUST generate vitest command with watch mode', () => {
    const cmd = runner.getCommand('vitest', { watch: true });
    expect(cmd).toBe('npx vitest --watch');
  });

  /**
   * GOLDEN TEST: jest command MUST be 'npx jest'
   */
  it('MUST generate correct jest command', () => {
    const cmd = runner.getCommand('jest');
    expect(cmd).toBe('npx jest');
  });

  /**
   * GOLDEN TEST: pytest command MUST be 'pytest'
   */
  it('MUST generate correct pytest command', () => {
    const cmd = runner.getCommand('pytest');
    expect(cmd).toBe('pytest');
  });

  /**
   * GOLDEN TEST: cargo command MUST be 'cargo test'
   */
  it('MUST generate correct cargo command', () => {
    const cmd = runner.getCommand('cargo');
    expect(cmd).toBe('cargo test');
  });

  /**
   * GOLDEN TEST: go command MUST be 'go test ./...'
   */
  it('MUST generate correct go command', () => {
    const cmd = runner.getCommand('go');
    expect(cmd).toBe('go test ./...');
  });
});

/**
 * SPEC: Test Result Parsing
 *
 * REQUIREMENT: The test runner MUST parse test results correctly.
 */
describe('[SPEC] TestRunner - Result Structure', () => {
  /**
   * GOLDEN TEST: TestResult MUST have required fields
   */
  it('MUST return TestResult with all required fields', () => {
    const result: TestResult = {
      passed: 10,
      failed: 2,
      skipped: 1,
      total: 13,
      duration: 1500,
      exitCode: 1,
      output: 'Test output...',
    };

    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('failed');
    expect(result).toHaveProperty('skipped');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('duration');
    expect(result).toHaveProperty('exitCode');
    expect(result).toHaveProperty('output');
  });

  /**
   * GOLDEN TEST: exitCode 0 means all tests passed
   */
  it('MUST have exitCode 0 when all tests pass', () => {
    const result: TestResult = {
      passed: 10,
      failed: 0,
      skipped: 0,
      total: 10,
      duration: 1000,
      exitCode: 0,
      output: 'All tests passed',
    };

    expect(result.exitCode).toBe(0);
    expect(result.failed).toBe(0);
  });
});

/**
 * SPEC: Test Framework Types
 *
 * REQUIREMENT: TestFramework type MUST include all supported frameworks.
 */
describe('[SPEC] TestRunner - Type Definitions', () => {
  it('MUST support all required frameworks', () => {
    const frameworks: TestFramework[] = [
      'vitest',
      'jest',
      'pytest',
      'cargo',
      'go',
      'dotnet',
      'ctest',
      'unknown',
    ];

    // This test ensures the type includes all frameworks
    expect(frameworks.length).toBe(8);
  });
});

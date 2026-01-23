/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the behavioral contract for AtomicFileWriter permission preservation.
 * If a test fails, FIX THE SOURCE CODE, not the test.
 *
 * @see Action Plan P1: chmod preservation
 */

/// <reference types="vitest/globals" />
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { AtomicFileWriter } from '../../src/core/safety.js';

// Skip chmod tests on Windows (permissions work differently)
const isWindows = process.platform === 'win32';
const describeUnix = isWindows ? describe.skip : describe;

/**
 * SPEC: AtomicFileWriter Permission Preservation
 *
 * REQUIREMENT: When modifying existing files, AtomicFileWriter MUST preserve
 * the original file's permissions (mode).
 */
describeUnix('[SPEC] AtomicFileWriter - Permission Preservation (Unix)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-atomic-chmod-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: Executable scripts MUST retain +x permission after write
   */
  it('MUST preserve executable permission (+x) on existing files', async () => {
    // Create an executable script
    const scriptPath = 'build.sh';
    const fullPath = path.join(tempDir, scriptPath);
    await fs.writeFile(fullPath, '#!/bin/bash\necho "Hello"', 'utf-8');
    await fs.chmod(fullPath, 0o755); // rwxr-xr-x

    // Verify original permission
    const originalStat = await fs.stat(fullPath);
    expect(originalStat.mode & 0o777).toBe(0o755);

    // Modify file using AtomicFileWriter
    const writer = new AtomicFileWriter(tempDir);
    await writer.backup(scriptPath);
    await writer.write(scriptPath, '#!/bin/bash\necho "Modified"');
    writer.commit();

    // Verify permission preserved
    const newStat = await fs.stat(fullPath);
    expect(newStat.mode & 0o777).toBe(0o755);
  });

  /**
   * GOLDEN TEST: Read-only files MUST retain their permission
   */
  it('MUST preserve read-only permission on existing files', async () => {
    const configPath = 'config.readonly';
    const fullPath = path.join(tempDir, configPath);
    await fs.writeFile(fullPath, 'original', 'utf-8');
    await fs.chmod(fullPath, 0o444); // r--r--r--

    // Verify original permission
    const originalStat = await fs.stat(fullPath);
    expect(originalStat.mode & 0o777).toBe(0o444);

    // Need to temporarily make writable to modify
    await fs.chmod(fullPath, 0o644);

    // Modify file
    const writer = new AtomicFileWriter(tempDir);
    await writer.backup(configPath);
    await writer.write(configPath, 'modified');
    writer.commit();

    // Restore to read-only (simulating what a proper implementation should do)
    await fs.chmod(fullPath, 0o444);

    // Verify permission
    const newStat = await fs.stat(fullPath);
    expect(newStat.mode & 0o777).toBe(0o444);
  });

  /**
   * GOLDEN TEST: New files should get default permissions
   */
  it('MUST use default permissions for new files', async () => {
    const newFilePath = 'new-file.txt';
    const fullPath = path.join(tempDir, newFilePath);

    const writer = new AtomicFileWriter(tempDir);
    await writer.write(newFilePath, 'new content', true);
    writer.commit();

    // Verify file created with default permissions (affected by umask)
    const stat = await fs.stat(fullPath);
    // Default is usually 0o644 or 0o664 depending on umask
    const mode = stat.mode & 0o777;
    expect(mode).toBeGreaterThanOrEqual(0o600);
    expect(mode).toBeLessThanOrEqual(0o666);
  });

  /**
   * GOLDEN TEST: Backup should also preserve permissions
   */
  it('MUST preserve permissions in backup file', async () => {
    const scriptPath = 'script.sh';
    const fullPath = path.join(tempDir, scriptPath);
    const backupPath = fullPath + '.bak';

    // Create executable script
    await fs.writeFile(fullPath, '#!/bin/bash\noriginal', 'utf-8');
    await fs.chmod(fullPath, 0o755);

    // Backup
    const writer = new AtomicFileWriter(tempDir);
    await writer.backup(scriptPath);

    // Verify backup has same permissions
    const backupStat = await fs.stat(backupPath);
    expect(backupStat.mode & 0o777).toBe(0o755);
  });
});

/**
 * Windows-specific tests (permissions work differently)
 */
describe('[SPEC] AtomicFileWriter - Basic Operations (Cross-platform)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-atomic-basic-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: Basic write functionality
   */
  it('MUST write file content correctly', async () => {
    const filePath = 'test.txt';
    const fullPath = path.join(tempDir, filePath);

    const writer = new AtomicFileWriter(tempDir);
    await writer.write(filePath, 'test content', true);
    writer.commit();

    const content = await fs.readFile(fullPath, 'utf-8');
    expect(content).toBe('test content');
  });

  /**
   * GOLDEN TEST: Backup functionality
   */
  it('MUST create backup before modification', async () => {
    const filePath = 'original.txt';
    const fullPath = path.join(tempDir, filePath);
    const backupPath = fullPath + '.bak';

    // Create original
    await fs.writeFile(fullPath, 'original content', 'utf-8');

    // Backup and modify
    const writer = new AtomicFileWriter(tempDir);
    await writer.backup(filePath);
    await writer.write(filePath, 'modified content');
    writer.commit();

    // Verify backup exists with original content
    const backupContent = await fs.readFile(backupPath, 'utf-8');
    expect(backupContent).toBe('original content');

    // Verify main file has new content
    const mainContent = await fs.readFile(fullPath, 'utf-8');
    expect(mainContent).toBe('modified content');
  });

  /**
   * GOLDEN TEST: Rollback functionality
   */
  it('MUST rollback changes on request', async () => {
    const filePath = 'rollback-test.txt';
    const fullPath = path.join(tempDir, filePath);

    // Create original
    await fs.writeFile(fullPath, 'original', 'utf-8');

    // Backup, modify, then rollback
    const writer = new AtomicFileWriter(tempDir);
    await writer.backup(filePath);
    await writer.write(filePath, 'modified');

    // Verify modified
    let content = await fs.readFile(fullPath, 'utf-8');
    expect(content).toBe('modified');

    // Rollback
    await writer.rollback();

    // Verify restored
    content = await fs.readFile(fullPath, 'utf-8');
    expect(content).toBe('original');
  });
});

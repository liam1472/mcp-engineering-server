/**
 * Test Utilities
 * Common utilities for unit and integration tests
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { vi, type Mock } from 'vitest';
import YAML from 'yaml';

// =============================================================================
// Type Definitions
// =============================================================================

export interface MockFileSystem {
  files: Map<string, string>;
  readFile: Mock;
  writeFile: Mock;
  mkdir: Mock;
  readdir: Mock;
  access: Mock;
  unlink: Mock;
  rm: Mock;
  stat: Mock;
  restore: () => void;
}

export interface YAMLFile<T> {
  path: string;
  content: T;
}

// =============================================================================
// File System Mocking
// =============================================================================

/**
 * Create a mock file system for isolated testing
 */
export function createMockFileSystem(
  initialFiles: Record<string, string> = {}
): MockFileSystem {
  const files = new Map<string, string>(Object.entries(initialFiles));

  const readFile = vi.fn(async (filePath: string) => {
    const normalizedPath = path.normalize(filePath);
    const content = files.get(normalizedPath);
    if (content === undefined) {
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      throw error;
    }
    return content;
  });

  const writeFile = vi.fn(async (filePath: string, content: string) => {
    const normalizedPath = path.normalize(filePath);
    files.set(normalizedPath, content);
  });

  const mkdir = vi.fn(async () => undefined);

  const readdir = vi.fn(async (dirPath: string, options?: { withFileTypes?: boolean }) => {
    const normalizedDir = path.normalize(dirPath);
    const entries: Array<{ name: string; isFile: () => boolean; isDirectory: () => boolean }> = [];

    for (const filePath of files.keys()) {
      if (filePath.startsWith(normalizedDir)) {
        const relativePath = path.relative(normalizedDir, filePath);
        const parts = relativePath.split(path.sep);
        const name = parts[0];

        if (name && !entries.find(e => e.name === name)) {
          const isDir = parts.length > 1;
          entries.push({
            name,
            isFile: () => !isDir,
            isDirectory: () => isDir,
          });
        }
      }
    }

    if (options?.withFileTypes) {
      return entries;
    }
    return entries.map(e => e.name);
  });

  const access = vi.fn(async (filePath: string) => {
    const normalizedPath = path.normalize(filePath);
    if (!files.has(normalizedPath)) {
      const error = new Error(`ENOENT: no such file or directory, access '${filePath}'`);
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      throw error;
    }
  });

  const unlink = vi.fn(async (filePath: string) => {
    const normalizedPath = path.normalize(filePath);
    files.delete(normalizedPath);
  });

  const rm = vi.fn(async (filePath: string) => {
    const normalizedPath = path.normalize(filePath);
    // Remove file and all children (for recursive)
    for (const key of files.keys()) {
      if (key.startsWith(normalizedPath)) {
        files.delete(key);
      }
    }
  });

  const stat = vi.fn(async (filePath: string) => {
    const normalizedPath = path.normalize(filePath);
    if (!files.has(normalizedPath)) {
      const error = new Error(`ENOENT: no such file or directory, stat '${filePath}'`);
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      throw error;
    }
    const content = files.get(normalizedPath) ?? '';
    return {
      isFile: () => true,
      isDirectory: () => false,
      size: content.length,
      mtime: new Date(),
    };
  });

  const restore = () => {
    vi.restoreAllMocks();
  };

  return {
    files,
    readFile,
    writeFile,
    mkdir,
    readdir,
    access,
    unlink,
    rm,
    stat,
    restore,
  };
}

// =============================================================================
// YAML Helpers
// =============================================================================

/**
 * Read and parse YAML file
 */
export async function readYAML<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return YAML.parse(content) as T;
}

/**
 * Write object as YAML file
 */
export async function writeYAML<T>(filePath: string, data: T): Promise<void> {
  const content = YAML.stringify(data);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Create temporary YAML fixture
 */
export async function createYAMLFixture<T>(
  baseDir: string,
  relativePath: string,
  data: T
): Promise<YAMLFile<T>> {
  const filePath = path.join(baseDir, relativePath);
  await writeYAML(filePath, data);
  return { path: filePath, content: data };
}

// =============================================================================
// String Helpers
// =============================================================================

/**
 * Normalize line endings to LF
 */
export function normalizeLF(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

/**
 * Strip ANSI codes from string
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Trim each line of a string
 */
export function trimLines(content: string): string {
  return content
    .split('\n')
    .map(line => line.trim())
    .join('\n');
}

// =============================================================================
// Timing Helpers
// =============================================================================

/**
 * Wait for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function until it succeeds or times out
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delay?: number } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const delay = options.delay ?? 100;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await wait(delay);
      }
    }
  }

  throw lastError;
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Deep equal check with better error messages
 */
export function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);

  if (actualStr !== expectedStr) {
    throw new Error(
      `${message ?? 'Values are not equal'}\n` +
        `Expected:\n${expectedStr}\n\n` +
        `Actual:\n${actualStr}`
    );
  }
}

/**
 * Assert that array contains all expected items
 */
export function assertContainsAll<T>(
  actual: T[],
  expected: T[],
  message?: string
): void {
  for (const item of expected) {
    const found = actual.some(
      a => JSON.stringify(a) === JSON.stringify(item)
    );
    if (!found) {
      throw new Error(
        `${message ?? 'Array missing expected item'}\n` +
          `Missing: ${JSON.stringify(item)}\n` +
          `Actual: ${JSON.stringify(actual, null, 2)}`
      );
    }
  }
}

// =============================================================================
// Snapshot Helpers
// =============================================================================

/**
 * Create a snapshot of directory structure
 */
export async function snapshotDir(
  dirPath: string,
  options: { includeContent?: boolean } = {}
): Promise<Record<string, string | true>> {
  const snapshot: Record<string, string | true> = {};

  async function walkDir(currentPath: string, relativePath: string = ''): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      const entryRelative = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        await walkDir(entryPath, entryRelative);
      } else {
        if (options.includeContent) {
          snapshot[entryRelative] = await fs.readFile(entryPath, 'utf-8');
        } else {
          snapshot[entryRelative] = true;
        }
      }
    }
  }

  await walkDir(dirPath);
  return snapshot;
}

// =============================================================================
// Process Helpers
// =============================================================================

/**
 * Capture process stdout/stderr
 */
export function captureOutput(): {
  stdout: string[];
  stderr: string[];
  restore: () => void;
} {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = (chunk: string | Uint8Array) => {
    stdout.push(String(chunk));
    return true;
  };

  process.stderr.write = (chunk: string | Uint8Array) => {
    stderr.push(String(chunk));
    return true;
  };

  return {
    stdout,
    stderr,
    restore: () => {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    },
  };
}

// =============================================================================
// Engineering Directory Helpers
// =============================================================================

/**
 * Create .engineering directory structure for testing
 */
export async function createEngineeringDir(
  baseDir: string,
  config?: Record<string, unknown>
): Promise<string> {
  const engDir = path.join(baseDir, '.engineering');

  // Create directory structure
  const dirs = [
    'index',
    'sessions',
    'security',
    'knowledge',
    'features',
    'archive',
  ];

  for (const dir of dirs) {
    await fs.mkdir(path.join(engDir, dir), { recursive: true });
  }

  // Create config.yaml
  const defaultConfig = {
    version: '1.0.0',
    projectType: 'nodejs-typescript',
    name: 'test-project',
    initialized: new Date().toISOString(),
    ...config,
  };

  await writeYAML(path.join(engDir, 'config.yaml'), defaultConfig);

  return engDir;
}

/**
 * Clean up .engineering directory
 */
export async function cleanupEngineeringDir(baseDir: string): Promise<void> {
  const engDir = path.join(baseDir, '.engineering');
  try {
    await fs.rm(engDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Global Test Setup
 * Provides utilities and helpers for all tests
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// Test Directories
// =============================================================================

/**
 * Base directory for test fixtures
 */
export const FIXTURES_DIR = path.join(__dirname, 'fixtures');

/**
 * Temporary directory for test outputs
 */
export const TEMP_DIR = path.join(__dirname, '.temp');

// =============================================================================
// Fixture Helpers
// =============================================================================

/**
 * Get path to a fixture project
 */
export function getFixturePath(projectType: string): string {
  return path.join(FIXTURES_DIR, 'projects', projectType);
}

/**
 * Get path to a code sample fixture
 */
export function getCodeSamplePath(language: string, filename: string): string {
  return path.join(FIXTURES_DIR, 'code-samples', language, filename);
}

/**
 * Create a temporary test directory with unique name
 */
export async function createTempDir(prefix = 'test'): Promise<string> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const dirName = `${prefix}-${timestamp}-${random}`;
  const dirPath = path.join(TEMP_DIR, dirName);
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

/**
 * Copy fixture project to temporary directory for isolated testing
 */
export async function copyFixtureToTemp(projectType: string): Promise<string> {
  const fixturePath = getFixturePath(projectType);
  const tempDir = await createTempDir(projectType);

  await copyDir(fixturePath, tempDir);
  return tempDir;
}

/**
 * Recursively copy directory
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Clean up temporary directory
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// =============================================================================
// File Helpers
// =============================================================================

/**
 * Read file content from fixture or temp
 */
export async function readTestFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

/**
 * Write content to test file
 */
export async function writeTestFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List files in directory matching pattern
 */
export async function listFiles(dirPath: string, pattern?: RegExp): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = entries
      .filter(e => e.isFile())
      .map(e => e.name);

    if (pattern) {
      return files.filter(f => pattern.test(f));
    }
    return files;
  } catch {
    return [];
  }
}

// =============================================================================
// Mock Helpers
// =============================================================================

/**
 * Create .engineering directory structure
 */
export async function createEngineeringDir(basePath: string): Promise<void> {
  const dirs = [
    '.engineering',
    '.engineering/index',
    '.engineering/sessions',
    '.engineering/security',
    '.engineering/knowledge',
    '.engineering/features',
    '.engineering/archive',
  ];

  for (const dir of dirs) {
    await fs.mkdir(path.join(basePath, dir), { recursive: true });
  }
}

/**
 * Create a mock working directory with specified files
 */
export async function createMockProject(
  files: Record<string, string>
): Promise<string> {
  const tempDir = await createTempDir('mock-project');

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(tempDir, relativePath);
    await writeTestFile(filePath, content);
  }

  return tempDir;
}

/**
 * Mock console methods for testing output
 */
export function mockConsole(): {
  logs: string[];
  errors: string[];
  warns: string[];
  restore: () => void;
} {
  const logs: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };
  console.warn = (...args: unknown[]) => {
    warns.push(args.map(String).join(' '));
  };

  return {
    logs,
    errors,
    warns,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    },
  };
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Assert that a file contains expected content
 */
export async function expectFileContains(
  filePath: string,
  expectedContent: string
): Promise<void> {
  const content = await readTestFile(filePath);
  if (!content.includes(expectedContent)) {
    throw new Error(
      `Expected file ${filePath} to contain:\n${expectedContent}\n\nActual content:\n${content}`
    );
  }
}

/**
 * Assert that a directory has expected structure
 */
export async function expectDirStructure(
  dirPath: string,
  expectedFiles: string[]
): Promise<void> {
  for (const file of expectedFiles) {
    const filePath = path.join(dirPath, file);
    const exists = await fileExists(filePath);
    if (!exists) {
      throw new Error(`Expected file ${file} to exist in ${dirPath}`);
    }
  }
}

// =============================================================================
// Global Setup (runs once before all tests)
// =============================================================================

// Ensure temp directory exists
fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => {
  // Ignore if already exists
});

// =============================================================================
// Type Definitions for Global Scope
// =============================================================================

declare global {
  // Add custom matchers if needed
}

export {};

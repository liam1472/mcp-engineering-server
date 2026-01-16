/**
 * Setup Test
 * Verifies test infrastructure is working correctly
 */

/// <reference types="vitest/globals" />
import { vi } from 'vitest';
import * as path from 'path';
import {
  FIXTURES_DIR,
  TEMP_DIR,
  createTempDir,
  cleanupTempDir,
  createMockProject,
  fileExists,
} from '../setup.js';

describe('Test Setup', () => {
  describe('Constants', () => {
    it('should have FIXTURES_DIR defined', () => {
      expect(FIXTURES_DIR).toBeDefined();
      expect(FIXTURES_DIR).toContain('fixtures');
    });

    it('should have TEMP_DIR defined', () => {
      expect(TEMP_DIR).toBeDefined();
      expect(TEMP_DIR).toContain('.temp');
    });
  });

  describe('createTempDir', () => {
    it('should create a temporary directory', async () => {
      const tempDir = await createTempDir('test');
      expect(tempDir).toContain('.temp');
      expect(tempDir).toContain('test');

      // Cleanup
      await cleanupTempDir(tempDir);
    });

    it('should create unique directories', async () => {
      const tempDir1 = await createTempDir('unique');
      const tempDir2 = await createTempDir('unique');

      expect(tempDir1).not.toBe(tempDir2);

      // Cleanup
      await cleanupTempDir(tempDir1);
      await cleanupTempDir(tempDir2);
    });
  });

  describe('createMockProject', () => {
    it('should create a mock project with specified files', async () => {
      const projectDir = await createMockProject({
        'package.json': '{"name": "test"}',
        'src/index.ts': 'export const x = 1;',
      });

      expect(await fileExists(path.join(projectDir, 'package.json'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'src/index.ts'))).toBe(true);

      // Cleanup
      await cleanupTempDir(projectDir);
    });
  });
});

describe('Vitest Features', () => {
  it('should support async/await', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it('should support mocking', () => {
    const mockFn = vi.fn(() => 'mocked');
    expect(mockFn()).toBe('mocked');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should support matchers', () => {
    expect('hello world').toContain('world');
    expect([1, 2, 3]).toHaveLength(3);
    expect({ a: 1 }).toHaveProperty('a', 1);
  });
});

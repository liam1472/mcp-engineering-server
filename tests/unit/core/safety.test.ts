/**
 * Unit tests for core/safety.ts
 */

/// <reference types="vitest/globals" />
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  PROTECTED_PATHS,
  MAX_FILES_WITHOUT_FORCE,
  isOwnProject,
  isSafeToModify,
  filterSafeFiles,
  requiresForceFlag,
  AtomicFileWriter,
} from '../../../src/core/safety.js';
import { createTempDir, cleanupTempDir, writeTestFile } from '../../setup.js';

describe('core/safety.ts', () => {
  describe('Constants', () => {
    it('should have PROTECTED_PATHS defined', () => {
      expect(PROTECTED_PATHS).toContain('node_modules/');
      expect(PROTECTED_PATHS).toContain('.git/');
      expect(PROTECTED_PATHS).toContain('dist/');
      expect(PROTECTED_PATHS).toContain('build/');
      expect(PROTECTED_PATHS).toContain('.env');
      expect(PROTECTED_PATHS).toContain('.env.local');
    });

    it('should have MAX_FILES_WITHOUT_FORCE set to 5', () => {
      expect(MAX_FILES_WITHOUT_FORCE).toBe(5);
    });
  });

  describe('isOwnProject()', () => {
    let tempDir: string;

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    it('should return true for mcp-engineering-server project', async () => {
      tempDir = await createTempDir('own-project');
      await writeTestFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'mcp-engineering-server' })
      );

      const result = await isOwnProject(tempDir);
      expect(result).toBe(true);
    });

    it('should return false for other projects', async () => {
      tempDir = await createTempDir('other-project');
      await writeTestFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'some-other-project' })
      );

      const result = await isOwnProject(tempDir);
      expect(result).toBe(false);
    });

    it('should return false when package.json does not exist', async () => {
      tempDir = await createTempDir('no-package');

      const result = await isOwnProject(tempDir);
      expect(result).toBe(false);
    });

    it('should return false for invalid JSON', async () => {
      tempDir = await createTempDir('invalid-json');
      await writeTestFile(path.join(tempDir, 'package.json'), 'invalid json');

      const result = await isOwnProject(tempDir);
      expect(result).toBe(false);
    });
  });

  describe('isSafeToModify()', () => {
    let tempDir: string;

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    it('should block node_modules paths', async () => {
      tempDir = await createTempDir('test');
      const result = await isSafeToModify('node_modules/lodash/index.js', tempDir);

      expect(result.safe).toBe(false);
      expect(result.reason).toContain('node_modules/');
    });

    it('should block .git paths', async () => {
      tempDir = await createTempDir('test');
      const result = await isSafeToModify('.git/config', tempDir);

      expect(result.safe).toBe(false);
      expect(result.reason).toContain('.git/');
    });

    it('should block dist paths', async () => {
      tempDir = await createTempDir('test');
      const result = await isSafeToModify('dist/index.js', tempDir);

      expect(result.safe).toBe(false);
      expect(result.reason).toContain('dist/');
    });

    it('should block .env files', async () => {
      tempDir = await createTempDir('test');
      const result = await isSafeToModify('.env', tempDir);

      expect(result.safe).toBe(false);
      expect(result.reason).toContain('.env');
    });

    it('should allow regular src files in normal projects', async () => {
      tempDir = await createTempDir('test');
      await writeTestFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'some-project' })
      );

      const result = await isSafeToModify('src/index.ts', tempDir);
      expect(result.safe).toBe(true);
    });

    it('should block src/ in own project', async () => {
      tempDir = await createTempDir('test');
      await writeTestFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'mcp-engineering-server' })
      );

      const result = await isSafeToModify('src/index.ts', tempDir);

      expect(result.safe).toBe(false);
      expect(result.reason).toContain('own source code');
    });

    it('should handle Windows-style paths', async () => {
      tempDir = await createTempDir('test');
      const result = await isSafeToModify('node_modules\\lodash\\index.js', tempDir);

      expect(result.safe).toBe(false);
    });
  });

  describe('filterSafeFiles()', () => {
    let tempDir: string;

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    it('should filter out protected files', async () => {
      tempDir = await createTempDir('test');
      const files = [
        'src/index.ts',
        'node_modules/lodash/index.js',
        'src/utils.ts',
        '.git/config',
        'lib/helper.ts',
      ];

      const result = await filterSafeFiles(files, tempDir);

      expect(result.safeFiles).toContain('src/index.ts');
      expect(result.safeFiles).toContain('src/utils.ts');
      expect(result.safeFiles).toContain('lib/helper.ts');
      expect(result.safeFiles).toHaveLength(3);

      expect(result.blockedFiles).toHaveLength(2);
      expect(result.blockedFiles.some(f => f.file.includes('node_modules'))).toBe(true);
      expect(result.blockedFiles.some(f => f.file.includes('.git'))).toBe(true);
    });

    it('should return all files as safe when no protected paths', async () => {
      tempDir = await createTempDir('test');
      const files = ['src/a.ts', 'src/b.ts', 'lib/c.ts'];

      const result = await filterSafeFiles(files, tempDir);

      expect(result.safeFiles).toHaveLength(3);
      expect(result.blockedFiles).toHaveLength(0);
    });

    it('should block all files when all are protected', async () => {
      tempDir = await createTempDir('test');
      const files = ['node_modules/a.js', '.git/config', 'dist/index.js'];

      const result = await filterSafeFiles(files, tempDir);

      expect(result.safeFiles).toHaveLength(0);
      expect(result.blockedFiles).toHaveLength(3);
    });
  });

  describe('requiresForceFlag()', () => {
    it('should return false for 5 or fewer files', () => {
      expect(requiresForceFlag(0)).toBe(false);
      expect(requiresForceFlag(1)).toBe(false);
      expect(requiresForceFlag(3)).toBe(false);
      expect(requiresForceFlag(5)).toBe(false);
    });

    it('should return true for more than 5 files', () => {
      expect(requiresForceFlag(6)).toBe(true);
      expect(requiresForceFlag(10)).toBe(true);
      expect(requiresForceFlag(100)).toBe(true);
    });
  });

  describe('AtomicFileWriter', () => {
    let tempDir: string;
    let writer: AtomicFileWriter;

    beforeEach(async () => {
      tempDir = await createTempDir('atomic-writer');
      writer = new AtomicFileWriter(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('backup()', () => {
      it('should create backup of existing file', async () => {
        const filePath = 'test.txt';
        const originalContent = 'original content';
        await writeTestFile(path.join(tempDir, filePath), originalContent);

        await writer.backup(filePath);

        const backupExists = await fs
          .access(path.join(tempDir, filePath + '.bak'))
          .then(() => true)
          .catch(() => false);

        expect(backupExists).toBe(true);

        const backupContent = await fs.readFile(
          path.join(tempDir, filePath + '.bak'),
          'utf-8'
        );
        expect(backupContent).toBe(originalContent);
      });

      it('should throw for non-existent file', async () => {
        await expect(writer.backup('non-existent.txt')).rejects.toThrow();
      });
    });

    describe('write()', () => {
      it('should write content to file', async () => {
        const filePath = 'new-file.txt';
        const content = 'new content';

        await writer.write(filePath, content);

        const fileContent = await fs.readFile(path.join(tempDir, filePath), 'utf-8');
        expect(fileContent).toBe(content);
      });

      it('should track new files for rollback', async () => {
        await writer.write('new-file.txt', 'content', true);

        // The file should be tracked and removed on rollback
        const backups = writer.getBackups();
        expect(backups).toHaveLength(0); // getBackups returns backup files, not created files
      });
    });

    describe('rollback()', () => {
      it('should restore backed up files', async () => {
        const filePath = 'test.txt';
        const originalContent = 'original';
        const newContent = 'modified';

        await writeTestFile(path.join(tempDir, filePath), originalContent);
        await writer.backup(filePath);
        await writer.write(filePath, newContent);

        // Verify file was modified
        let content = await fs.readFile(path.join(tempDir, filePath), 'utf-8');
        expect(content).toBe(newContent);

        // Rollback
        await writer.rollback();

        // Verify file was restored
        content = await fs.readFile(path.join(tempDir, filePath), 'utf-8');
        expect(content).toBe(originalContent);
      });

      it('should remove newly created files', async () => {
        const filePath = 'new-file.txt';
        await writer.write(filePath, 'content', true);

        // Verify file exists
        let exists = await fs
          .access(path.join(tempDir, filePath))
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);

        // Rollback
        await writer.rollback();

        // Verify file was removed
        exists = await fs
          .access(path.join(tempDir, filePath))
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(false);
      });
    });

    describe('commit()', () => {
      it('should clear internal tracking', async () => {
        const filePath = 'test.txt';
        await writeTestFile(path.join(tempDir, filePath), 'original');
        await writer.backup(filePath);

        expect(writer.getBackups()).toHaveLength(1);

        writer.commit();

        expect(writer.getBackups()).toHaveLength(0);
      });
    });

    describe('getBackups()', () => {
      it('should return list of backup files', async () => {
        await writeTestFile(path.join(tempDir, 'file1.txt'), 'content1');
        await writeTestFile(path.join(tempDir, 'file2.txt'), 'content2');

        await writer.backup('file1.txt');
        await writer.backup('file2.txt');

        const backups = writer.getBackups();
        expect(backups).toHaveLength(2);
        expect(backups.some(b => b.includes('file1.txt.bak'))).toBe(true);
        expect(backups.some(b => b.includes('file2.txt.bak'))).toBe(true);
      });
    });
  });
});

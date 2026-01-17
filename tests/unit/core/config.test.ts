/**
 * Unit tests for core/config.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import { ConfigManager } from '../../../src/core/config.js';
import {
  createTempDir,
  cleanupTempDir,
  writeTestFile,
  fileExists,
  readTestFile,
} from '../../setup.js';

describe('core/config.ts', () => {
  describe('ConfigManager', () => {
    let tempDir: string;
    let configManager: ConfigManager;

    beforeEach(async () => {
      tempDir = await createTempDir('config-test');
      configManager = new ConfigManager(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('configPath', () => {
      it('should return correct config path', () => {
        expect(configManager.configPath).toBe(
          path.join(tempDir, '.engineering', 'config.yaml')
        );
      });
    });

    describe('engineeringDir', () => {
      it('should return correct engineering directory', () => {
        expect(configManager.engineeringDir).toBe(
          path.join(tempDir, '.engineering')
        );
      });
    });

    describe('exists()', () => {
      it('should return false when config does not exist', async () => {
        const exists = await configManager.exists();
        expect(exists).toBe(false);
      });

      it('should return true when config exists', async () => {
        await writeTestFile(
          path.join(tempDir, '.engineering', 'config.yaml'),
          'version: "1.0.0"'
        );

        const exists = await configManager.exists();
        expect(exists).toBe(true);
      });
    });

    describe('initialize()', () => {
      it('should create config file', async () => {
        await configManager.initialize('test-project', 'web-node');

        const exists = await fileExists(configManager.configPath);
        expect(exists).toBe(true);
      });

      it('should create directory structure', async () => {
        await configManager.initialize('test-project', 'web-node');

        const dirs = [
          'index',
          'sessions',
          'features',
          'security',
          'archive',
          'knowledge/patterns',
          'knowledge/solutions',
          'knowledge/bugs',
        ];

        for (const dir of dirs) {
          const dirPath = path.join(configManager.engineeringDir, dir);
          expect(await fileExists(dirPath)).toBe(true);
        }
      });

      it('should create initial files', async () => {
        await configManager.initialize('test-project', 'web-node');

        const files = [
          'sessions/context.yaml',
          'security/patterns.yaml',
          'security/whitelist.yaml',
        ];

        for (const file of files) {
          const filePath = path.join(configManager.engineeringDir, file);
          expect(await fileExists(filePath)).toBe(true);
        }
      });

      it('should return config with correct values', async () => {
        const result = await configManager.initialize('my-project', 'native-rust');

        expect(result.config.projectName).toBe('my-project');
        expect(result.config.projectType).toBe('native-rust');
        expect(result.config.version).toBe('1.0.0');
        expect(result.config.security.enabled).toBe(true);
        expect(result.config.indexes.functions).toBe(true);
        expect(result.profile).toBe('native');
        expect(result.architecturalReport).toBeDefined();
        expect(result.architecturalReport.gaps).toBeInstanceOf(Array);
      });
    });

    describe('save()', () => {
      it('should save config to file', async () => {
        const config = {
          version: '1.0.0',
          projectType: 'web-node' as const,
          projectName: 'save-test',
          autoSaveInterval: 300,
          security: {
            enabled: true,
            customPatterns: [],
            whitelist: [],
          },
          indexes: {
            functions: true,
            errors: true,
            constants: true,
            dependencies: true,
          },
        };

        await configManager.save(config);

        const content = await readTestFile(configManager.configPath);
        expect(content).toContain('projectName: save-test');
        expect(content).toContain('projectType: web-node');
      });

      it('should create directory if not exists', async () => {
        const config = {
          version: '1.0.0',
          projectType: 'web-node' as const,
          projectName: 'test',
          autoSaveInterval: 300,
          security: { enabled: true, customPatterns: [], whitelist: [] },
          indexes: { functions: true, errors: true, constants: true, dependencies: true },
        };

        await configManager.save(config);

        expect(await fileExists(configManager.engineeringDir)).toBe(true);
      });
    });

    describe('load()', () => {
      it('should load existing config', async () => {
        const configContent = `
version: "1.0.0"
projectType: native-go
projectName: load-test
autoSaveInterval: 600
security:
  enabled: false
  customPatterns: []
  whitelist: []
indexes:
  functions: true
  errors: false
  constants: true
  dependencies: true
`;
        await writeTestFile(configManager.configPath, configContent);

        const config = await configManager.load();

        expect(config.projectName).toBe('load-test');
        expect(config.projectType).toBe('native-go');
        expect(config.autoSaveInterval).toBe(600);
        expect(config.security.enabled).toBe(false);
      });

      it('should cache loaded config', async () => {
        await configManager.initialize('cache-test', 'web-node');

        const config1 = await configManager.load();
        const config2 = await configManager.load();

        expect(config1).toBe(config2); // Same reference
      });

      it('should throw error for non-existent config', async () => {
        await expect(configManager.load()).rejects.toThrow('Failed to load config');
      });

      it('should throw error for invalid config', async () => {
        await writeTestFile(configManager.configPath, 'invalid: yaml: content:');

        await expect(configManager.load()).rejects.toThrow();
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        const newDir = await createTempDir('new-working-dir');

        configManager.setWorkingDir(newDir);

        expect(configManager.configPath).toContain(newDir);

        await cleanupTempDir(newDir);
      });

      it('should clear cached config', async () => {
        await configManager.initialize('test', 'web-node');
        const config1 = await configManager.load();

        const newDir = await createTempDir('new-dir');
        configManager.setWorkingDir(newDir);

        // After setWorkingDir, load should fail (no config in new dir)
        await expect(configManager.load()).rejects.toThrow();

        await cleanupTempDir(newDir);
      });
    });
  });
});

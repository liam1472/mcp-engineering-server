/**
 * Tests for /eng-init template copying and architectural scan
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../../../src/core/config.js';

describe('core/config.ts - Template Copying', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eng-test-templates-'));
    configManager = new ConfigManager(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('copyTemplates()', () => {
    it('should copy embedded manifesto when project type is embedded', async () => {
      const result = await configManager.initialize('test-project', 'embedded-stm32');

      expect(result.profile).toBe('embedded');

      // Check manifesto was created
      const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');
      const manifestoExists = await fs
        .access(manifestoPath)
        .then(() => true)
        .catch(() => false);

      expect(manifestoExists).toBe(true);

      // Check content specific to embedded
      const content = await fs.readFile(manifestoPath, 'utf-8');
      expect(content).toContain('Dynamic Memory Allocation');
      expect(content).toContain('Blocking Delays');
    });

    it('should copy web manifesto when project type is web', async () => {
      const result = await configManager.initialize('test-project', 'web-node');

      expect(result.profile).toBe('web');

      const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');
      const content = await fs.readFile(manifestoPath, 'utf-8');

      expect(content).toContain('SQL Injection');
      expect(content).toContain('XSS');
    });

    it('should copy dotnet manifesto when project type is dotnet', async () => {
      const result = await configManager.initialize('test-project', 'dotnet-aspnet');

      expect(result.profile).toBe('dotnet');

      const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');
      const content = await fs.readFile(manifestoPath, 'utf-8');

      expect(content).toContain('async void');
      expect(content).toContain('Thread.Sleep');
    });

    it('should copy blueprint when project type has template', async () => {
      await configManager.initialize('test-project', 'embedded-esp32');

      const blueprintPath = path.join(tempDir, '.engineering', 'blueprint.md');
      const blueprintExists = await fs
        .access(blueprintPath)
        .then(() => true)
        .catch(() => false);

      expect(blueprintExists).toBe(true);

      const content = await fs.readFile(blueprintPath, 'utf-8');
      expect(content).toContain('OTA');
    });

    it('should not create manifesto for unknown project type', async () => {
      const result = await configManager.initialize('test-project', 'unknown');

      expect(result.profile).toBe('unknown');

      const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');
      const manifestoExists = await fs
        .access(manifestoPath)
        .then(() => true)
        .catch(() => false);

      expect(manifestoExists).toBe(false);
    });
  });

  describe('runArchitecturalScan()', () => {
    it('should detect missing CI/CD for all profiles', async () => {
      const result = await configManager.initialize('test-project', 'web-node');

      const cicdGap = result.architecturalReport.gaps.find(g => g.name === 'CI/CD Pipeline');
      expect(cicdGap).toBeDefined();
      expect(cicdGap?.severity).toBe('warning');
    });

    it('should not report CI/CD gap when workflows exist', async () => {
      // Create .github/workflows directory with a file
      const workflowsDir = path.join(tempDir, '.github', 'workflows');
      await fs.mkdir(workflowsDir, { recursive: true });
      await fs.writeFile(path.join(workflowsDir, 'ci.yml'), 'name: CI\n');

      const result = await configManager.initialize('test-project', 'web-node');

      const cicdGap = result.architecturalReport.gaps.find(g => g.name === 'CI/CD Pipeline');
      expect(cicdGap).toBeUndefined();
    });

    it('should detect missing Dockerfile for web projects', async () => {
      const result = await configManager.initialize('test-project', 'web-node');

      const dockerGap = result.architecturalReport.gaps.find(g => g.name === 'Dockerfile');
      expect(dockerGap).toBeDefined();
    });

    it('should detect missing OTA for embedded projects', async () => {
      const result = await configManager.initialize('test-project', 'embedded-stm32');

      const otaGap = result.architecturalReport.gaps.find(g => g.name === 'OTA Update');
      expect(otaGap).toBeDefined();
      expect(otaGap?.suggestion).toContain('RAUC');
    });

    it('should provide recommendations when gaps exist', async () => {
      const result = await configManager.initialize('test-project', 'web-node');

      expect(result.architecturalReport.recommendations.length).toBeGreaterThan(0);
      expect(result.architecturalReport.recommendations).toContain(
        'Review the manifesto.md for coding standards'
      );
    });
  });
});

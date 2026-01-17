/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the core behavioral contracts for manifesto injection.
 * If a test fails, FIX THE SOURCE CODE, not the test.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../../src/core/config.js';
import { FeatureManager } from '../../src/features/manager.js';

/**
 * SPEC: /eng-init Template Copying
 *
 * REQUIREMENT: When initializing a project, the appropriate manifesto
 * and blueprint templates MUST be copied based on project type.
 */
describe('[SPEC] /eng-init - Template Copying', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-init-'));
    configManager = new ConfigManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: Embedded projects MUST get embedded manifesto
   */
  it('MUST copy embedded manifesto for embedded-stm32 project', async () => {
    const result = await configManager.initialize('test-project', 'embedded-stm32');

    expect(result.profile).toBe('embedded');

    const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');
    const manifestoExists = await fs
      .access(manifestoPath)
      .then(() => true)
      .catch(() => false);

    expect(manifestoExists).toBe(true);

    const content = await fs.readFile(manifestoPath, 'utf-8');
    // MUST contain embedded-specific rules
    expect(content.toLowerCase()).toContain('dynamic memory');
    expect(content.toLowerCase()).toContain('blocking');
  });

  /**
   * GOLDEN TEST: Web projects MUST get web manifesto
   */
  it('MUST copy web manifesto for web-node project', async () => {
    const result = await configManager.initialize('test-project', 'web-node');

    expect(result.profile).toBe('web');

    const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');
    const content = await fs.readFile(manifestoPath, 'utf-8');

    // MUST contain web-specific security rules
    expect(content.toLowerCase()).toContain('sql');
    expect(content.toLowerCase()).toContain('xss');
  });

  /**
   * GOLDEN TEST: .NET projects MUST get dotnet manifesto
   */
  it('MUST copy dotnet manifesto for dotnet-aspnet project', async () => {
    const result = await configManager.initialize('test-project', 'dotnet-aspnet');

    expect(result.profile).toBe('dotnet');

    const manifestoPath = path.join(tempDir, '.engineering', 'manifesto.md');
    const content = await fs.readFile(manifestoPath, 'utf-8');

    // MUST contain .NET-specific rules
    expect(content.toLowerCase()).toContain('async void');
  });

  /**
   * GOLDEN TEST: Unknown projects MUST NOT get any manifesto
   */
  it('MUST NOT copy manifesto for unknown project type', async () => {
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

/**
 * SPEC: /eng-init Architectural Scan
 *
 * REQUIREMENT: The initialization MUST detect missing infrastructure
 * and report architectural gaps.
 */
describe('[SPEC] /eng-init - Architectural Scan', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-arch-'));
    configManager = new ConfigManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: Missing CI/CD MUST be reported
   */
  it('MUST detect missing CI/CD pipeline', async () => {
    const result = await configManager.initialize('test-project', 'web-node');

    const cicdGap = result.architecturalReport.gaps.find(g => g.name === 'CI/CD Pipeline');

    expect(cicdGap).toBeDefined();
    expect(cicdGap!.severity).toBe('warning');
  });

  /**
   * GOLDEN TEST: Existing CI/CD MUST NOT be reported as missing
   */
  it('MUST NOT report CI/CD gap when workflows exist', async () => {
    // Create .github/workflows with a file
    const workflowsDir = path.join(tempDir, '.github', 'workflows');
    await fs.mkdir(workflowsDir, { recursive: true });
    await fs.writeFile(path.join(workflowsDir, 'ci.yml'), 'name: CI\n', 'utf-8');

    const result = await configManager.initialize('test-project', 'web-node');

    const cicdGap = result.architecturalReport.gaps.find(g => g.name === 'CI/CD Pipeline');

    expect(cicdGap).toBeUndefined();
  });

  /**
   * GOLDEN TEST: Embedded projects MUST check for OTA
   */
  it('MUST detect missing OTA for embedded projects', async () => {
    const result = await configManager.initialize('test-project', 'embedded-stm32');

    const otaGap = result.architecturalReport.gaps.find(g => g.name === 'OTA Update');

    expect(otaGap).toBeDefined();
  });
});

/**
 * SPEC: /eng-start Manifesto Injection
 *
 * REQUIREMENT: When starting a feature, the manifesto content
 * MUST be accessible for injection into AI context.
 */
describe('[SPEC] /eng-start - Manifesto Access', () => {
  let tempDir: string;
  let featureManager: FeatureManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-start-'));
    featureManager = new FeatureManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: getManifesto() MUST return content when file exists
   */
  it('MUST return manifesto content when file exists', async () => {
    const engDir = path.join(tempDir, '.engineering');
    await fs.mkdir(engDir, { recursive: true });
    await fs.writeFile(
      path.join(engDir, 'manifesto.md'),
      '# Test Manifesto\n\n## FORBIDDEN\n- malloc',
      'utf-8'
    );

    const manifesto = await featureManager.getManifesto();

    expect(manifesto).not.toBeNull();
    expect(manifesto).toContain('FORBIDDEN');
    expect(manifesto).toContain('malloc');
  });

  /**
   * GOLDEN TEST: getManifesto() MUST return null when no file
   */
  it('MUST return null when no manifesto exists', async () => {
    const manifesto = await featureManager.getManifesto();

    expect(manifesto).toBeNull();
  });

  /**
   * GOLDEN TEST: getBlueprint() MUST return content when file exists
   */
  it('MUST return blueprint content when file exists', async () => {
    const engDir = path.join(tempDir, '.engineering');
    await fs.mkdir(engDir, { recursive: true });
    await fs.writeFile(path.join(engDir, 'blueprint.md'), '# OTA Update\n\n- RAUC', 'utf-8');

    const blueprint = await featureManager.getBlueprint();

    expect(blueprint).not.toBeNull();
    expect(blueprint).toContain('OTA');
  });
});

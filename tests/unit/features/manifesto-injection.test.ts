/**
 * Tests for /eng-start manifesto and blueprint injection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FeatureManager } from '../../../src/features/manager.js';

describe('features/manager.ts - Manifesto Injection', () => {
  let tempDir: string;
  let featureManager: FeatureManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eng-test-manifesto-'));
    featureManager = new FeatureManager(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getManifesto()', () => {
    it('should return manifesto content when file exists', async () => {
      // Create manifesto file
      const engDir = path.join(tempDir, '.engineering');
      await fs.mkdir(engDir, { recursive: true });
      await fs.writeFile(
        path.join(engDir, 'manifesto.md'),
        `# Embedded Manifesto

## FORBIDDEN
- malloc/free - Use static buffers
- delay() blocking > 100ms
- Global variables without mutex

## REQUIRED
- Watchdog timer
- ISR < 50 cycles
`,
        'utf-8'
      );

      const manifesto = await featureManager.getManifesto();

      expect(manifesto).not.toBeNull();
      expect(manifesto).toContain('FORBIDDEN');
      expect(manifesto).toContain('malloc/free');
      expect(manifesto).toContain('Watchdog timer');
    });

    it('should return null when no manifesto exists', async () => {
      const manifesto = await featureManager.getManifesto();

      expect(manifesto).toBeNull();
    });

    it('should return null when .engineering directory does not exist', async () => {
      const manifesto = await featureManager.getManifesto();

      expect(manifesto).toBeNull();
    });
  });

  describe('getBlueprint()', () => {
    it('should return blueprint content when file exists', async () => {
      // Create blueprint file
      const engDir = path.join(tempDir, '.engineering');
      await fs.mkdir(engDir, { recursive: true });
      await fs.writeFile(
        path.join(engDir, 'blueprint.md'),
        `# Embedded Operations Blueprint

## OTA Update
- RAUC or Mender recommended
- Dual partition scheme required

## Monitoring
- Health check endpoint required
- Metrics export via Prometheus
`,
        'utf-8'
      );

      const blueprint = await featureManager.getBlueprint();

      expect(blueprint).not.toBeNull();
      expect(blueprint).toContain('OTA Update');
      expect(blueprint).toContain('RAUC');
      expect(blueprint).toContain('Prometheus');
    });

    it('should return null when no blueprint exists', async () => {
      const blueprint = await featureManager.getBlueprint();

      expect(blueprint).toBeNull();
    });
  });

  describe('Manifesto Integration with Feature Start', () => {
    it('should be accessible when starting a feature', async () => {
      // Create engineering directory with manifesto
      const engDir = path.join(tempDir, '.engineering');
      await fs.mkdir(engDir, { recursive: true });
      await fs.mkdir(path.join(engDir, 'features'), { recursive: true });

      const manifestoContent = `# Web Manifesto
## FORBIDDEN
- SQL string concatenation
- eval() usage
- console.log in production
`;
      await fs.writeFile(path.join(engDir, 'manifesto.md'), manifestoContent, 'utf-8');

      // Start a feature
      const manifest = await featureManager.startFeature('user-auth');

      // Verify feature was created
      expect(manifest.name).toBe('user-auth');
      expect(manifest.status).toBe('active');

      // Verify manifesto is still accessible
      const manifesto = await featureManager.getManifesto();
      expect(manifesto).toContain('SQL string concatenation');
      expect(manifesto).toContain('eval()');
    });

    it('should work even when no manifesto exists during feature start', async () => {
      // Create minimal engineering directory
      const engDir = path.join(tempDir, '.engineering');
      await fs.mkdir(engDir, { recursive: true });
      await fs.mkdir(path.join(engDir, 'features'), { recursive: true });

      // Start feature without manifesto
      const manifest = await featureManager.startFeature('new-feature');

      expect(manifest.name).toBe('new-feature');
      expect(manifest.status).toBe('active');

      // Manifesto should be null
      const manifesto = await featureManager.getManifesto();
      expect(manifesto).toBeNull();
    });
  });

  describe('Manifesto Content Validation', () => {
    it('should preserve markdown formatting', async () => {
      const engDir = path.join(tempDir, '.engineering');
      await fs.mkdir(engDir, { recursive: true });

      const manifestoContent = `# .NET Manifesto

## Code Quality Rules

### CRITICAL - Never Do
1. **async void** - Always return Task
2. **Thread.Sleep** - Use Task.Delay

### WARNING - Avoid
- Service Locator pattern
- Manual string concatenation for SQL

> Note: These rules are enforced by static analysis

\`\`\`csharp
// Bad
public async void OnClick() { }

// Good
public async Task OnClickAsync() { }
\`\`\`
`;

      await fs.writeFile(path.join(engDir, 'manifesto.md'), manifestoContent, 'utf-8');

      const manifesto = await featureManager.getManifesto();

      expect(manifesto).toContain('# .NET Manifesto');
      expect(manifesto).toContain('**async void**');
      expect(manifesto).toContain('```csharp');
      expect(manifesto).toContain('public async Task OnClickAsync()');
    });

    it('should handle large manifesto files', async () => {
      const engDir = path.join(tempDir, '.engineering');
      await fs.mkdir(engDir, { recursive: true });

      // Create a large manifesto (simulating comprehensive rules)
      const sections = Array.from({ length: 50 }, (_, i) => `
## Section ${i + 1}

### Rule ${i + 1}.1
Description for rule ${i + 1}.1 with detailed explanation.

### Rule ${i + 1}.2
Description for rule ${i + 1}.2 with examples and code snippets.
`);

      const largeManifesto = `# Comprehensive Manifesto\n${sections.join('\n')}`;
      await fs.writeFile(path.join(engDir, 'manifesto.md'), largeManifesto, 'utf-8');

      const manifesto = await featureManager.getManifesto();

      expect(manifesto).not.toBeNull();
      expect(manifesto!.length).toBeGreaterThan(5000);
      expect(manifesto).toContain('Section 50');
    });
  });

  describe('setWorkingDir()', () => {
    it('should update manifesto path when working directory changes', async () => {
      // Create second temp directory with its own manifesto
      const tempDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'eng-test-manifesto2-'));

      try {
        // Create manifesto in second directory
        const engDir2 = path.join(tempDir2, '.engineering');
        await fs.mkdir(engDir2, { recursive: true });
        await fs.writeFile(
          path.join(engDir2, 'manifesto.md'),
          '# Different Project Manifesto\n\nDifferent rules here.',
          'utf-8'
        );

        // Initially no manifesto in first directory
        let manifesto = await featureManager.getManifesto();
        expect(manifesto).toBeNull();

        // Change working directory
        featureManager.setWorkingDir(tempDir2);

        // Now should find the manifesto from second directory
        manifesto = await featureManager.getManifesto();
        expect(manifesto).not.toBeNull();
        expect(manifesto).toContain('Different Project Manifesto');
      } finally {
        await fs.rm(tempDir2, { recursive: true, force: true });
      }
    });
  });

  describe('Blueprint and Manifesto Combined', () => {
    it('should return both manifesto and blueprint independently', async () => {
      const engDir = path.join(tempDir, '.engineering');
      await fs.mkdir(engDir, { recursive: true });

      await fs.writeFile(
        path.join(engDir, 'manifesto.md'),
        '# Coding Standards\n\n- No magic numbers\n- Use dependency injection',
        'utf-8'
      );

      await fs.writeFile(
        path.join(engDir, 'blueprint.md'),
        '# Operations Standards\n\n- CI/CD required\n- Health checks mandatory',
        'utf-8'
      );

      const manifesto = await featureManager.getManifesto();
      const blueprint = await featureManager.getBlueprint();

      expect(manifesto).toContain('Coding Standards');
      expect(manifesto).toContain('dependency injection');

      expect(blueprint).toContain('Operations Standards');
      expect(blueprint).toContain('CI/CD required');

      // They should be different
      expect(manifesto).not.toEqual(blueprint);
    });

    it('should handle case where only manifesto exists', async () => {
      const engDir = path.join(tempDir, '.engineering');
      await fs.mkdir(engDir, { recursive: true });

      await fs.writeFile(path.join(engDir, 'manifesto.md'), '# Only Manifesto', 'utf-8');

      const manifesto = await featureManager.getManifesto();
      const blueprint = await featureManager.getBlueprint();

      expect(manifesto).not.toBeNull();
      expect(blueprint).toBeNull();
    });

    it('should handle case where only blueprint exists', async () => {
      const engDir = path.join(tempDir, '.engineering');
      await fs.mkdir(engDir, { recursive: true });

      await fs.writeFile(path.join(engDir, 'blueprint.md'), '# Only Blueprint', 'utf-8');

      const manifesto = await featureManager.getManifesto();
      const blueprint = await featureManager.getBlueprint();

      expect(manifesto).toBeNull();
      expect(blueprint).not.toBeNull();
    });
  });
});

/**
 * Unit tests for features/manager.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import { FeatureManager } from '../../../src/features/manager.js';
import {
  createTempDir,
  cleanupTempDir,
  writeTestFile,
  fileExists,
  readTestFile,
} from '../../setup.js';
import { createEngineeringDir } from '../../helpers/test-utils.js';

describe('features/manager.ts', () => {
  describe('FeatureManager', () => {
    let tempDir: string;
    let manager: FeatureManager;

    beforeEach(async () => {
      tempDir = await createTempDir('feature-test');
      manager = new FeatureManager(tempDir);
      // Create engineering directory structure
      await createEngineeringDir(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('startFeature()', () => {
      it('should create feature directory', async () => {
        await manager.startFeature('user-auth');

        const featureDir = path.join(
          tempDir,
          '.engineering',
          'features',
          'user-auth'
        );
        expect(await fileExists(featureDir)).toBe(true);
      });

      it('should create manifest.yaml', async () => {
        await manager.startFeature('my-feature');

        const manifestPath = path.join(
          tempDir,
          '.engineering',
          'features',
          'my-feature',
          'manifest.yaml'
        );
        expect(await fileExists(manifestPath)).toBe(true);
      });

      it('should create context.yaml', async () => {
        await manager.startFeature('test-feature');

        const contextPath = path.join(
          tempDir,
          '.engineering',
          'features',
          'test-feature',
          'context.yaml'
        );
        expect(await fileExists(contextPath)).toBe(true);
      });

      it('should create decisions.md', async () => {
        await manager.startFeature('new-feature');

        const decisionsPath = path.join(
          tempDir,
          '.engineering',
          'features',
          'new-feature',
          'decisions.md'
        );
        expect(await fileExists(decisionsPath)).toBe(true);
      });

      it('should return manifest with correct values', async () => {
        const manifest = await manager.startFeature('api-endpoints');

        expect(manifest.name).toBe('api-endpoints');
        expect(manifest.status).toBe('active');
        expect(manifest.files).toEqual([]);
        expect(manifest.decisions).toEqual([]);
        expect(manifest.startedAt).toBeDefined();
      });

      it('should throw if feature already exists', async () => {
        await manager.startFeature('duplicate');

        await expect(manager.startFeature('duplicate')).rejects.toThrow(
          'Feature "duplicate" already exists'
        );
      });
    });

    describe('getActiveFeature()', () => {
      it('should return null when no features exist', async () => {
        const active = await manager.getActiveFeature();
        expect(active).toBeNull();
      });

      it('should return active feature name', async () => {
        await manager.startFeature('active-feature');

        const active = await manager.getActiveFeature();
        expect(active).toBe('active-feature');
      });

      it('should return first active feature when multiple exist', async () => {
        await manager.startFeature('feature-1');
        await manager.startFeature('feature-2');

        const active = await manager.getActiveFeature();
        expect(['feature-1', 'feature-2']).toContain(active);
      });
    });

    describe('listFeatures()', () => {
      it('should return empty array when no features', async () => {
        const features = await manager.listFeatures();
        expect(features).toEqual([]);
      });

      it('should list all features', async () => {
        await manager.startFeature('feature-a');
        await manager.startFeature('feature-b');

        const features = await manager.listFeatures();

        expect(features.length).toBe(2);
        expect(features.some(f => f.name === 'feature-a')).toBe(true);
        expect(features.some(f => f.name === 'feature-b')).toBe(true);
      });

      it('should include status and startedAt', async () => {
        await manager.startFeature('test');

        const features = await manager.listFeatures();
        const feature = features[0];

        expect(feature?.status).toBe('active');
        expect(feature?.startedAt).toBeDefined();
      });
    });

    describe('addDecision()', () => {
      it('should append decision to decisions.md', async () => {
        await manager.startFeature('decision-test');

        await manager.addDecision('decision-test', 'Use TypeScript for type safety');

        const decisionsPath = path.join(
          tempDir,
          '.engineering',
          'features',
          'decision-test',
          'decisions.md'
        );
        const content = await readTestFile(decisionsPath);

        expect(content).toContain('Use TypeScript for type safety');
      });

      it('should include timestamp', async () => {
        await manager.startFeature('timestamp-test');

        await manager.addDecision('timestamp-test', 'Test decision');

        const decisionsPath = path.join(
          tempDir,
          '.engineering',
          'features',
          'timestamp-test',
          'decisions.md'
        );
        const content = await readTestFile(decisionsPath);

        // Should contain ISO timestamp format
        expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      it('should preserve previous decisions', async () => {
        await manager.startFeature('multi-decision');

        await manager.addDecision('multi-decision', 'First decision');
        await manager.addDecision('multi-decision', 'Second decision');

        const decisionsPath = path.join(
          tempDir,
          '.engineering',
          'features',
          'multi-decision',
          'decisions.md'
        );
        const content = await readTestFile(decisionsPath);

        expect(content).toContain('First decision');
        expect(content).toContain('Second decision');
      });
    });

    describe('completeFeature()', () => {
      it('should move feature to archive', async () => {
        await manager.startFeature('to-complete');

        await manager.completeFeature('to-complete');

        const archiveDir = path.join(tempDir, '.engineering', 'archive');
        const archives = await readTestFile(archiveDir).catch(() => null);

        // Feature should no longer be in features dir
        const featureDir = path.join(
          tempDir,
          '.engineering',
          'features',
          'to-complete'
        );
        expect(await fileExists(featureDir)).toBe(false);
      });

      it('should update manifest status to completed', async () => {
        await manager.startFeature('status-test');

        const result = await manager.completeFeature('status-test');

        // Check archive path was returned
        expect(result.archivePath).toContain('archive');
        expect(result.archivePath).toContain('status-test');
      });

      it('should return archive path', async () => {
        await manager.startFeature('archive-test');

        const result = await manager.completeFeature('archive-test');

        expect(result.archivePath).toContain('.engineering');
        expect(result.archivePath).toContain('archive');
      });

      it('should return extracted knowledge', async () => {
        await manager.startFeature('knowledge-test');

        const result = await manager.completeFeature('knowledge-test');

        expect(result.knowledgeExtracted).toBeDefined();
        expect(Array.isArray(result.knowledgeExtracted)).toBe(true);
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        const newDir = await createTempDir('new-feature-dir');
        await createEngineeringDir(newDir);

        manager.setWorkingDir(newDir);
        await manager.startFeature('new-dir-feature');

        const featureDir = path.join(
          newDir,
          '.engineering',
          'features',
          'new-dir-feature'
        );
        expect(await fileExists(featureDir)).toBe(true);

        await cleanupTempDir(newDir);
      });
    });

    describe('getKnowledgeExtractor()', () => {
      it('should return knowledge extractor instance', () => {
        const extractor = manager.getKnowledgeExtractor();
        expect(extractor).toBeDefined();
      });
    });
  });
});

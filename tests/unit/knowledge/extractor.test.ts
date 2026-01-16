/**
 * Unit tests for knowledge/extractor.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import * as fs from 'fs/promises';
import { stringify } from 'yaml';
import { KnowledgeExtractor } from '../../../src/knowledge/extractor.js';
import { createTempDir, cleanupTempDir, writeTestFile, fileExists } from '../../setup.js';

describe('knowledge/extractor.ts', () => {
  describe('KnowledgeExtractor', () => {
    let tempDir: string;
    let extractor: KnowledgeExtractor;

    beforeEach(async () => {
      tempDir = await createTempDir('knowledge-test');
      extractor = new KnowledgeExtractor(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('extractFromFeature()', () => {
      it('should extract decisions from feature', async () => {
        // Create feature directory structure
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test-feature');
        await fs.mkdir(featurePath, { recursive: true });

        // Create manifest
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({
            name: 'test-feature',
            startedAt: new Date().toISOString(),
            status: 'active',
            files: ['src/app.ts'],
            decisions: [],
          })
        );

        // Create decisions file
        await writeTestFile(
          path.join(featurePath, 'decisions.md'),
          `# Decisions

## 2024-01-15T10:00:00Z

Decided to use TypeScript for better type safety.

## 2024-01-15T11:00:00Z

Chose Redis for caching due to performance requirements.
`
        );

        // Create context file
        await writeTestFile(
          path.join(featurePath, 'context.yaml'),
          stringify({
            notes: ['Remember to update docs'],
            blockers: ['Resolved auth issue with JWT'],
          })
        );

        const entries = await extractor.extractFromFeature(featurePath);

        expect(entries.length).toBeGreaterThan(0);
        expect(entries.some(e => e.type === 'decision')).toBe(true);
      });

      it('should extract solutions from blockers', async () => {
        const featurePath = path.join(tempDir, '.engineering', 'features', 'blocker-feature');
        await fs.mkdir(featurePath, { recursive: true });

        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({
            name: 'blocker-feature',
            startedAt: new Date().toISOString(),
            status: 'active',
            files: [],
            decisions: [],
          })
        );

        await writeTestFile(path.join(featurePath, 'decisions.md'), '# Decisions\n');

        await writeTestFile(
          path.join(featurePath, 'context.yaml'),
          stringify({
            blockers: ['Fixed database connection timeout issue'],
          })
        );

        const entries = await extractor.extractFromFeature(featurePath);

        expect(entries.some(e => e.type === 'solution')).toBe(true);
      });

      it('should extract tips from notes', async () => {
        const featurePath = path.join(tempDir, '.engineering', 'features', 'notes-feature');
        await fs.mkdir(featurePath, { recursive: true });

        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({
            name: 'notes-feature',
            startedAt: new Date().toISOString(),
            status: 'active',
            files: [],
            decisions: [],
          })
        );

        await writeTestFile(path.join(featurePath, 'decisions.md'), '# Decisions\n');

        await writeTestFile(
          path.join(featurePath, 'context.yaml'),
          stringify({
            notes: ['Use environment variables for config', 'Cache API responses'],
          })
        );

        const entries = await extractor.extractFromFeature(featurePath);

        expect(entries.some(e => e.type === 'tip')).toBe(true);
      });

      it('should extract patterns from code comments', async () => {
        const featurePath = path.join(tempDir, '.engineering', 'features', 'pattern-feature');
        await fs.mkdir(featurePath, { recursive: true });

        // Create source file with pattern comment
        const srcPath = path.join(tempDir, 'src');
        await fs.mkdir(srcPath, { recursive: true });
        await writeTestFile(
          path.join(srcPath, 'utils.ts'),
          `// PATTERN: Use async/await for all async operations
async function fetchData() {
  return await api.get('/data');
}

// BUG: Infinite loop when input is empty
function processInput(input) {
  // FIX: Add empty check at start
  if (!input) return [];
}`
        );

        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({
            name: 'pattern-feature',
            startedAt: new Date().toISOString(),
            status: 'active',
            files: ['src/utils.ts'],
            decisions: [],
          })
        );

        await writeTestFile(path.join(featurePath, 'decisions.md'), '# Decisions\n');

        const entries = await extractor.extractFromFeature(featurePath);

        expect(entries.some(e => e.type === 'pattern')).toBe(true);
        expect(entries.some(e => e.type === 'bug')).toBe(true);
        expect(entries.some(e => e.type === 'solution')).toBe(true);
      });

      it('should handle missing files gracefully', async () => {
        const featurePath = path.join(tempDir, '.engineering', 'features', 'minimal');
        await fs.mkdir(featurePath, { recursive: true });

        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({
            name: 'minimal',
            startedAt: new Date().toISOString(),
            status: 'active',
            files: [],
            decisions: [],
          })
        );

        // No decisions.md or context.yaml

        const entries = await extractor.extractFromFeature(featurePath);

        expect(Array.isArray(entries)).toBe(true);
      });
    });

    describe('saveKnowledge()', () => {
      it('should save entries to knowledge base', async () => {
        const entries = [
          {
            id: 'k_test_1',
            type: 'pattern' as const,
            title: 'Test Pattern',
            content: 'Use dependency injection',
            tags: ['architecture'],
            source: {
              feature: 'test',
              files: ['app.ts'],
              date: new Date().toISOString(),
            },
          },
        ];

        const count = await extractor.saveKnowledge(entries);

        expect(count).toBe(1);

        const basePath = path.join(tempDir, '.engineering', 'knowledge', 'base.yaml');
        const exists = await fileExists(basePath);
        expect(exists).toBe(true);
      });

      it('should avoid duplicate entries', async () => {
        const entry = {
          id: 'k_unique_1',
          type: 'tip' as const,
          title: 'Unique Tip',
          content: 'Always validate input',
          tags: ['security'],
          source: {
            feature: 'test',
            files: [],
            date: new Date().toISOString(),
          },
        };

        await extractor.saveKnowledge([entry]);
        const count = await extractor.saveKnowledge([entry]);

        expect(count).toBe(0); // Should not add duplicate
      });

      it('should return 0 for empty entries', async () => {
        const count = await extractor.saveKnowledge([]);
        expect(count).toBe(0);
      });
    });

    describe('searchKnowledge()', () => {
      it('should find entries by title', async () => {
        await extractor.saveKnowledge([
          {
            id: 'k_search_1',
            type: 'pattern' as const,
            title: 'Authentication Pattern',
            content: 'Use JWT tokens',
            tags: ['auth'],
            source: { feature: 'test', files: [], date: new Date().toISOString() },
          },
        ]);

        const results = await extractor.searchKnowledge('Authentication');

        expect(results.length).toBe(1);
        expect(results[0]?.title).toContain('Authentication');
      });

      it('should find entries by content', async () => {
        await extractor.saveKnowledge([
          {
            id: 'k_search_2',
            type: 'solution' as const,
            title: 'Database Fix',
            content: 'Use connection pooling for better performance',
            tags: ['database'],
            source: { feature: 'test', files: [], date: new Date().toISOString() },
          },
        ]);

        const results = await extractor.searchKnowledge('pooling');

        expect(results.length).toBe(1);
      });

      it('should find entries by tags', async () => {
        await extractor.saveKnowledge([
          {
            id: 'k_search_3',
            type: 'tip' as const,
            title: 'Security Tip',
            content: 'Sanitize all user input',
            tags: ['security', 'validation'],
            source: { feature: 'test', files: [], date: new Date().toISOString() },
          },
        ]);

        const results = await extractor.searchKnowledge('security');

        expect(results.length).toBe(1);
      });

      it('should return empty array when no matches', async () => {
        await extractor.saveKnowledge([
          {
            id: 'k_search_4',
            type: 'pattern' as const,
            title: 'Some Pattern',
            content: 'Some content',
            tags: ['tag'],
            source: { feature: 'test', files: [], date: new Date().toISOString() },
          },
        ]);

        const results = await extractor.searchKnowledge('nonexistent');

        expect(results).toEqual([]);
      });

      it('should return empty array when knowledge base does not exist', async () => {
        const results = await extractor.searchKnowledge('anything');
        expect(results).toEqual([]);
      });
    });

    describe('getStats()', () => {
      it('should return stats from knowledge base', async () => {
        await extractor.saveKnowledge([
          {
            id: 'k_stat_1',
            type: 'pattern' as const,
            title: 'Pattern 1',
            content: 'Content',
            tags: [],
            source: { feature: 'test', files: [], date: new Date().toISOString() },
          },
          {
            id: 'k_stat_2',
            type: 'pattern' as const,
            title: 'Pattern 2',
            content: 'Content',
            tags: [],
            source: { feature: 'test', files: [], date: new Date().toISOString() },
          },
          {
            id: 'k_stat_3',
            type: 'tip' as const,
            title: 'Tip 1',
            content: 'Content',
            tags: [],
            source: { feature: 'test', files: [], date: new Date().toISOString() },
          },
        ]);

        const stats = await extractor.getStats();

        expect(stats.total).toBe(3);
        expect(stats.byType.pattern).toBe(2);
        expect(stats.byType.tip).toBe(1);
      });

      it('should return empty stats when no knowledge base', async () => {
        const stats = await extractor.getStats();

        expect(stats.total).toBe(0);
        expect(stats.byType).toEqual({});
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        const otherDir = await createTempDir('other-knowledge');

        extractor.setWorkingDir(otherDir);

        await extractor.saveKnowledge([
          {
            id: 'k_other_1',
            type: 'pattern' as const,
            title: 'Other Pattern',
            content: 'Content',
            tags: [],
            source: { feature: 'test', files: [], date: new Date().toISOString() },
          },
        ]);

        const basePath = path.join(otherDir, '.engineering', 'knowledge', 'base.yaml');
        const exists = await fileExists(basePath);
        expect(exists).toBe(true);

        await cleanupTempDir(otherDir);
      });
    });
  });
});

/**
 * Tests for Knowledge Base split storage (index.yaml + details/)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { parse } from 'yaml';
import { KnowledgeExtractor } from '../../../src/knowledge/extractor.js';
import type { KnowledgeEntry } from '../../../src/types/index.js';

describe('knowledge/extractor.ts - Split Storage', () => {
  let tempDir: string;
  let extractor: KnowledgeExtractor;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eng-test-knowledge-'));
    extractor = new KnowledgeExtractor(tempDir);

    // Create .engineering directory
    await fs.mkdir(path.join(tempDir, '.engineering', 'knowledge'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('saveKnowledge() - Split Storage', () => {
    it('should create index.yaml with metadata', async () => {
      const entries: KnowledgeEntry[] = [
        {
          id: 'k_test_1',
          type: 'decision',
          title: 'Use dependency injection',
          content: 'Decided to use DI for better testability and loose coupling.',
          tags: ['architecture', 'testing'],
          source: {
            feature: 'auth-refactor',
            files: ['src/auth/service.ts'],
            date: '2026-01-17T10:00:00.000Z',
          },
        },
      ];

      await extractor.saveKnowledge(entries);

      // Check index.yaml exists
      const indexPath = path.join(tempDir, '.engineering', 'knowledge', 'index.yaml');
      const indexExists = await fs
        .access(indexPath)
        .then(() => true)
        .catch(() => false);
      expect(indexExists).toBe(true);

      // Check index content
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = parse(indexContent) as {
        version: string;
        entries: Array<{
          id: string;
          type: string;
          title: string;
          summary: string;
          keywords: string[];
          path: string;
        }>;
        lastUpdated: string;
      };

      expect(index.version).toBe('2.0');
      expect(index.entries.length).toBe(1);
      expect(index.entries[0]?.id).toBe('k_test_1');
      expect(index.entries[0]?.title).toBe('Use dependency injection');
      expect(index.entries[0]?.path).toMatch(/^details\//);
    });

    it('should create detail files in details/ directory', async () => {
      const entries: KnowledgeEntry[] = [
        {
          id: 'k_detail_1',
          type: 'solution',
          title: 'Fix I2C timeout issue',
          content:
            'Added 100ms timeout to I2C communication. The sensor was not responding fast enough on cold boot.',
          tags: ['embedded', 'i2c', 'timeout'],
          source: {
            feature: 'sensor-fix',
            files: ['src/drivers/i2c.c'],
            date: '2026-01-17T11:00:00.000Z',
          },
        },
      ];

      await extractor.saveKnowledge(entries);

      // Check details directory exists
      const detailsDir = path.join(tempDir, '.engineering', 'knowledge', 'details');
      const detailsDirExists = await fs
        .access(detailsDir)
        .then(() => true)
        .catch(() => false);
      expect(detailsDirExists).toBe(true);

      // Check detail file exists
      const files = await fs.readdir(detailsDir);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/fix-i2c-timeout/);

      // Check detail content
      const detailContent = await fs.readFile(path.join(detailsDir, files[0]!), 'utf-8');
      expect(detailContent).toContain('# Fix I2C timeout issue');
      expect(detailContent).toContain('**Type:** solution');
      expect(detailContent).toContain('100ms timeout');
      expect(detailContent).toContain('src/drivers/i2c.c');
    });

    it('should extract keywords for fuzzy search', async () => {
      const entries: KnowledgeEntry[] = [
        {
          id: 'k_keywords_1',
          type: 'pattern',
          title: 'Singleton pattern for configuration',
          content: 'Used singleton to ensure single config instance across the app.',
          tags: ['design-pattern', 'config', 'singleton'],
          source: {
            feature: 'config-service',
            files: ['src/config/ConfigService.ts'],
            date: '2026-01-17T12:00:00.000Z',
          },
        },
      ];

      await extractor.saveKnowledge(entries);

      const indexPath = path.join(tempDir, '.engineering', 'knowledge', 'index.yaml');
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = parse(indexContent) as {
        entries: Array<{ keywords: string[] }>;
      };

      const keywords = index.entries[0]?.keywords ?? [];
      expect(keywords).toContain('pattern');
      expect(keywords).toContain('design-pattern');
      expect(keywords).toContain('config');
      expect(keywords).toContain('singleton');
    });

    it('should maintain backwards compatible base.yaml', async () => {
      const entries: KnowledgeEntry[] = [
        {
          id: 'k_compat_1',
          type: 'tip',
          title: 'Use early returns',
          content: 'Early returns reduce nesting and improve readability.',
          tags: ['code-style'],
          source: {
            feature: 'style-guide',
            files: ['docs/style.md'],
            date: '2026-01-17T13:00:00.000Z',
          },
        },
      ];

      await extractor.saveKnowledge(entries);

      // Check base.yaml exists (legacy)
      const basePath = path.join(tempDir, '.engineering', 'knowledge', 'base.yaml');
      const baseExists = await fs
        .access(basePath)
        .then(() => true)
        .catch(() => false);
      expect(baseExists).toBe(true);

      // Check base.yaml content
      const baseContent = await fs.readFile(basePath, 'utf-8');
      const base = parse(baseContent) as {
        version: string;
        entries: KnowledgeEntry[];
      };

      expect(base.version).toBe('1.0');
      expect(base.entries.length).toBe(1);
      expect(base.entries[0]?.content).toBe('Early returns reduce nesting and improve readability.');
    });

    it('should not duplicate entries with same ID', async () => {
      const entry: KnowledgeEntry = {
        id: 'k_unique_1',
        type: 'decision',
        title: 'Test decision',
        content: 'Some content.',
        tags: ['test'],
        source: {
          feature: 'test',
          files: ['test.ts'],
          date: '2026-01-17T14:00:00.000Z',
        },
      };

      // Save twice
      await extractor.saveKnowledge([entry]);
      await extractor.saveKnowledge([entry]);

      const indexPath = path.join(tempDir, '.engineering', 'knowledge', 'index.yaml');
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = parse(indexContent) as {
        entries: Array<{ id: string }>;
      };

      expect(index.entries.length).toBe(1);
    });

    it('should return count of new entries saved', async () => {
      const entries: KnowledgeEntry[] = [
        {
          id: 'k_count_1',
          type: 'bug',
          title: 'Bug 1',
          content: 'Bug content 1.',
          tags: ['bug'],
          source: { feature: 'fix', files: ['a.ts'], date: '2026-01-17T15:00:00.000Z' },
        },
        {
          id: 'k_count_2',
          type: 'bug',
          title: 'Bug 2',
          content: 'Bug content 2.',
          tags: ['bug'],
          source: { feature: 'fix', files: ['b.ts'], date: '2026-01-17T15:01:00.000Z' },
        },
      ];

      const count = await extractor.saveKnowledge(entries);
      expect(count).toBe(2);

      // Saving again should return 0
      const count2 = await extractor.saveKnowledge(entries);
      expect(count2).toBe(0);
    });
  });

  describe('searchKnowledge() - New Index', () => {
    beforeEach(async () => {
      // Pre-populate with test data
      const entries: KnowledgeEntry[] = [
        {
          id: 'k_search_1',
          type: 'solution',
          title: 'Redis caching implementation',
          content: 'Implemented Redis caching for API responses to improve performance.',
          tags: ['redis', 'caching', 'performance'],
          source: {
            feature: 'performance-opt',
            files: ['src/cache/redis.ts'],
            date: '2026-01-17T10:00:00.000Z',
          },
        },
        {
          id: 'k_search_2',
          type: 'decision',
          title: 'PostgreSQL for main database',
          content: 'Chose PostgreSQL over MySQL for better JSON support and performance.',
          tags: ['database', 'postgresql'],
          source: {
            feature: 'db-setup',
            files: ['src/db/index.ts'],
            date: '2026-01-17T11:00:00.000Z',
          },
        },
        {
          id: 'k_search_3',
          type: 'tip',
          title: 'Memory optimization tips',
          content: 'Use WeakMap for caching objects to allow garbage collection.',
          tags: ['memory', 'optimization', 'caching'],
          source: {
            feature: 'optimization',
            files: ['docs/tips.md'],
            date: '2026-01-17T12:00:00.000Z',
          },
        },
      ];

      await extractor.saveKnowledge(entries);
    });

    it('should search by title', async () => {
      const results = await extractor.searchKnowledge('Redis');

      expect(results.length).toBe(1);
      expect(results[0]?.title).toContain('Redis');
    });

    it('should search by keywords', async () => {
      const results = await extractor.searchKnowledge('caching');

      expect(results.length).toBe(2);
      expect(results.some(r => r.title.includes('Redis'))).toBe(true);
      expect(results.some(r => r.title.includes('Memory'))).toBe(true);
    });

    it('should search by summary content', async () => {
      const results = await extractor.searchKnowledge('PostgreSQL');

      expect(results.length).toBe(1);
      expect(results[0]?.type).toBe('decision');
    });

    it('should be case-insensitive', async () => {
      const results1 = await extractor.searchKnowledge('REDIS');
      const results2 = await extractor.searchKnowledge('redis');

      expect(results1.length).toBe(results2.length);
    });

    it('should return empty array for no matches', async () => {
      const results = await extractor.searchKnowledge('nonexistent');

      expect(results).toEqual([]);
    });
  });

  describe('getStats()', () => {
    it('should return stats from new index', async () => {
      const entries: KnowledgeEntry[] = [
        {
          id: 'k_stats_1',
          type: 'decision',
          title: 'Decision 1',
          content: 'Content 1.',
          tags: [],
          source: { feature: 'f1', files: [], date: '2026-01-17T10:00:00.000Z' },
        },
        {
          id: 'k_stats_2',
          type: 'decision',
          title: 'Decision 2',
          content: 'Content 2.',
          tags: [],
          source: { feature: 'f2', files: [], date: '2026-01-17T11:00:00.000Z' },
        },
        {
          id: 'k_stats_3',
          type: 'solution',
          title: 'Solution 1',
          content: 'Content 3.',
          tags: [],
          source: { feature: 'f3', files: [], date: '2026-01-17T12:00:00.000Z' },
        },
        {
          id: 'k_stats_4',
          type: 'pattern',
          title: 'Pattern 1',
          content: 'Content 4.',
          tags: [],
          source: { feature: 'f4', files: [], date: '2026-01-17T13:00:00.000Z' },
        },
      ];

      await extractor.saveKnowledge(entries);

      const stats = await extractor.getStats();

      expect(stats.total).toBe(4);
      expect(stats.byType['decision']).toBe(2);
      expect(stats.byType['solution']).toBe(1);
      expect(stats.byType['pattern']).toBe(1);
    });

    it('should return zero stats when no knowledge exists', async () => {
      const stats = await extractor.getStats();

      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({});
    });
  });

  describe('Detail File Format', () => {
    it('should format detail file as markdown', async () => {
      const entries: KnowledgeEntry[] = [
        {
          id: 'k_format_1',
          type: 'solution',
          title: 'Authentication flow fix',
          content:
            'Fixed the OAuth2 callback URL issue.\n\nThe redirect URI was not properly encoded.',
          tags: ['auth', 'oauth2', 'security'],
          source: {
            feature: 'auth-fix',
            files: ['src/auth/oauth.ts', 'src/auth/callback.ts'],
            date: '2026-01-17T10:00:00.000Z',
          },
        },
      ];

      await extractor.saveKnowledge(entries);

      const detailsDir = path.join(tempDir, '.engineering', 'knowledge', 'details');
      const files = await fs.readdir(detailsDir);
      const content = await fs.readFile(path.join(detailsDir, files[0]!), 'utf-8');

      // Check markdown structure
      expect(content).toContain('# Authentication flow fix');
      expect(content).toContain('**Type:** solution');
      expect(content).toContain('**Date:** 2026-01-17');
      expect(content).toContain('**Feature:** auth-fix');
      expect(content).toContain('**Tags:** auth, oauth2, security');
      expect(content).toContain('## Content');
      expect(content).toContain('OAuth2 callback URL');
      expect(content).toContain('## Source Files');
      expect(content).toContain('- src/auth/oauth.ts');
      expect(content).toContain('- src/auth/callback.ts');
    });

    it('should generate safe filename from title', async () => {
      const entries: KnowledgeEntry[] = [
        {
          id: 'k_filename_1',
          type: 'tip',
          title: 'Fix: Memory Leak in API Handler!!!',
          content: 'Content.',
          tags: [],
          source: { feature: 'fix', files: [], date: '2026-01-17T10:00:00.000Z' },
        },
      ];

      await extractor.saveKnowledge(entries);

      const detailsDir = path.join(tempDir, '.engineering', 'knowledge', 'details');
      const files = await fs.readdir(detailsDir);

      // Should be sanitized: lowercase, no special chars
      expect(files[0]).toMatch(/^2026-01-17_fix-memory-leak/);
      expect(files[0]).not.toContain('!');
      expect(files[0]).not.toContain(':');
    });
  });

  describe('setWorkingDir()', () => {
    it('should update all paths when working directory changes', async () => {
      const tempDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'eng-test-knowledge2-'));

      try {
        // Create knowledge directory in second temp
        await fs.mkdir(path.join(tempDir2, '.engineering', 'knowledge'), { recursive: true });

        // Save in first directory
        const entries: KnowledgeEntry[] = [
          {
            id: 'k_dir_1',
            type: 'tip',
            title: 'First directory entry',
            content: 'Content.',
            tags: [],
            source: { feature: 'f1', files: [], date: '2026-01-17T10:00:00.000Z' },
          },
        ];
        await extractor.saveKnowledge(entries);

        // Change directory
        extractor.setWorkingDir(tempDir2);

        // Save in second directory
        const entries2: KnowledgeEntry[] = [
          {
            id: 'k_dir_2',
            type: 'tip',
            title: 'Second directory entry',
            content: 'Content.',
            tags: [],
            source: { feature: 'f2', files: [], date: '2026-01-17T11:00:00.000Z' },
          },
        ];
        await extractor.saveKnowledge(entries2);

        // Check first directory has only first entry
        const index1Path = path.join(tempDir, '.engineering', 'knowledge', 'index.yaml');
        const index1Content = await fs.readFile(index1Path, 'utf-8');
        const index1 = parse(index1Content) as { entries: Array<{ id: string }> };
        expect(index1.entries.length).toBe(1);
        expect(index1.entries[0]?.id).toBe('k_dir_1');

        // Check second directory has only second entry
        const index2Path = path.join(tempDir2, '.engineering', 'knowledge', 'index.yaml');
        const index2Content = await fs.readFile(index2Path, 'utf-8');
        const index2 = parse(index2Content) as { entries: Array<{ id: string }> };
        expect(index2.entries.length).toBe(1);
        expect(index2.entries[0]?.id).toBe('k_dir_2');
      } finally {
        await fs.rm(tempDir2, { recursive: true, force: true });
      }
    });
  });

  describe('Legacy Fallback', () => {
    it('should search legacy base.yaml when new index does not exist', async () => {
      // Create legacy base.yaml directly
      const legacyPath = path.join(tempDir, '.engineering', 'knowledge', 'base.yaml');
      const legacyContent = `
version: '1.0'
entries:
  - id: k_legacy_1
    type: solution
    title: Legacy entry
    content: This is a legacy knowledge entry.
    tags:
      - legacy
    source:
      feature: old-feature
      files:
        - src/old.ts
      date: '2025-01-01T10:00:00.000Z'
lastUpdated: '2025-01-01T10:00:00.000Z'
`;
      await fs.writeFile(legacyPath, legacyContent, 'utf-8');

      // Search should find legacy entry
      const results = await extractor.searchKnowledge('legacy');

      expect(results.length).toBe(1);
      expect(results[0]?.title).toBe('Legacy entry');
    });

    it('should return stats from legacy when new index does not exist', async () => {
      // Create legacy base.yaml directly
      const legacyPath = path.join(tempDir, '.engineering', 'knowledge', 'base.yaml');
      const legacyContent = `
version: '1.0'
entries:
  - id: k_legacy_1
    type: decision
    title: Decision 1
    content: Content.
    tags: []
    source:
      feature: f1
      files: []
      date: '2025-01-01T10:00:00.000Z'
  - id: k_legacy_2
    type: tip
    title: Tip 1
    content: Content.
    tags: []
    source:
      feature: f2
      files: []
      date: '2025-01-01T11:00:00.000Z'
lastUpdated: '2025-01-01T11:00:00.000Z'
`;
      await fs.writeFile(legacyPath, legacyContent, 'utf-8');

      const stats = await extractor.getStats();

      expect(stats.total).toBe(2);
      expect(stats.byType['decision']).toBe(1);
      expect(stats.byType['tip']).toBe(1);
    });
  });
});

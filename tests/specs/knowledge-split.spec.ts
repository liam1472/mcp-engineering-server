/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the core behavioral contracts for Knowledge Base storage.
 * If a test fails, FIX THE SOURCE CODE, not the test.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { parse } from 'yaml';
import { KnowledgeExtractor } from '../../src/knowledge/extractor.js';
import type { KnowledgeEntry } from '../../src/types/index.js';

/**
 * SPEC: Knowledge Base Split Storage
 *
 * REQUIREMENT: The knowledge base MUST use split storage with index.yaml
 * for metadata and details/ folder for full content.
 */
describe('[SPEC] Knowledge Base - Split Storage', () => {
  let tempDir: string;
  let extractor: KnowledgeExtractor;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-knowledge-'));
    extractor = new KnowledgeExtractor(tempDir);
    await fs.mkdir(path.join(tempDir, '.engineering', 'knowledge'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: index.yaml MUST be created with metadata
   */
  it('MUST create index.yaml with metadata', async () => {
    const entries: KnowledgeEntry[] = [
      {
        id: 'k_test_1',
        type: 'decision',
        title: 'Use DI',
        content: 'Decided to use DI.',
        tags: ['architecture'],
        source: {
          feature: 'auth',
          files: ['src/auth.ts'],
          date: '2026-01-17T10:00:00.000Z',
        },
      },
    ];

    await extractor.saveKnowledge(entries);

    const indexPath = path.join(tempDir, '.engineering', 'knowledge', 'index.yaml');
    const indexExists = await fs
      .access(indexPath)
      .then(() => true)
      .catch(() => false);

    expect(indexExists).toBe(true);

    const indexContent = await fs.readFile(indexPath, 'utf-8');
    const index = parse(indexContent) as { version: string; entries: unknown[] };

    expect(index.version).toBe('2.0');
    expect(index.entries.length).toBe(1);
  });

  /**
   * GOLDEN TEST: details/ directory MUST be created with markdown files
   */
  it('MUST create detail files in details/ directory', async () => {
    const entries: KnowledgeEntry[] = [
      {
        id: 'k_detail_1',
        type: 'solution',
        title: 'Fix timeout',
        content: 'Added timeout.',
        tags: ['fix'],
        source: {
          feature: 'sensor',
          files: ['src/sensor.c'],
          date: '2026-01-17T10:00:00.000Z',
        },
      },
    ];

    await extractor.saveKnowledge(entries);

    const detailsDir = path.join(tempDir, '.engineering', 'knowledge', 'details');
    const files = await fs.readdir(detailsDir);

    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/fix-timeout.*\.md$/);
  });

  /**
   * GOLDEN TEST: base.yaml MUST be maintained for backwards compatibility
   */
  it('MUST maintain backwards compatible base.yaml', async () => {
    const entries: KnowledgeEntry[] = [
      {
        id: 'k_compat_1',
        type: 'tip',
        title: 'Use early returns',
        content: 'Early returns improve readability.',
        tags: ['style'],
        source: {
          feature: 'style',
          files: [],
          date: '2026-01-17T10:00:00.000Z',
        },
      },
    ];

    await extractor.saveKnowledge(entries);

    const basePath = path.join(tempDir, '.engineering', 'knowledge', 'base.yaml');
    const baseExists = await fs
      .access(basePath)
      .then(() => true)
      .catch(() => false);

    expect(baseExists).toBe(true);

    const baseContent = await fs.readFile(basePath, 'utf-8');
    const base = parse(baseContent) as { version: string; entries: unknown[] };

    expect(base.version).toBe('1.0');
    expect(base.entries.length).toBe(1);
  });

  /**
   * GOLDEN TEST: Duplicate entries MUST NOT be saved twice
   */
  it('MUST NOT duplicate entries with same ID', async () => {
    const entry: KnowledgeEntry = {
      id: 'k_unique_1',
      type: 'decision',
      title: 'Test',
      content: 'Content.',
      tags: [],
      source: { feature: 'test', files: [], date: '2026-01-17T10:00:00.000Z' },
    };

    await extractor.saveKnowledge([entry]);
    await extractor.saveKnowledge([entry]); // Save twice

    const indexPath = path.join(tempDir, '.engineering', 'knowledge', 'index.yaml');
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    const index = parse(indexContent) as { entries: Array<{ id: string }> };

    expect(index.entries.length).toBe(1);
  });

  /**
   * GOLDEN TEST: Keywords MUST be extracted for fuzzy search
   */
  it('MUST extract keywords for fuzzy search', async () => {
    const entries: KnowledgeEntry[] = [
      {
        id: 'k_keywords_1',
        type: 'pattern',
        title: 'Singleton pattern for config',
        content: 'Used singleton.',
        tags: ['design-pattern', 'singleton'],
        source: {
          feature: 'config-service',
          files: [],
          date: '2026-01-17T10:00:00.000Z',
        },
      },
    ];

    await extractor.saveKnowledge(entries);

    const indexPath = path.join(tempDir, '.engineering', 'knowledge', 'index.yaml');
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    const index = parse(indexContent) as { entries: Array<{ keywords: string[] }> };

    const keywords = index.entries[0]!.keywords;
    expect(keywords).toContain('pattern');
    expect(keywords).toContain('singleton');
  });
});

/**
 * SPEC: Knowledge Base Search
 *
 * REQUIREMENT: The search MUST work with the new index structure.
 */
describe('[SPEC] Knowledge Base - Search', () => {
  let tempDir: string;
  let extractor: KnowledgeExtractor;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-search-'));
    extractor = new KnowledgeExtractor(tempDir);
    await fs.mkdir(path.join(tempDir, '.engineering', 'knowledge'), { recursive: true });

    // Pre-populate
    await extractor.saveKnowledge([
      {
        id: 'k_search_1',
        type: 'solution',
        title: 'Redis caching',
        content: 'Implemented Redis.',
        tags: ['redis', 'caching'],
        source: { feature: 'perf', files: [], date: '2026-01-17T10:00:00.000Z' },
      },
      {
        id: 'k_search_2',
        type: 'decision',
        title: 'PostgreSQL database',
        content: 'Chose PostgreSQL.',
        tags: ['database'],
        source: { feature: 'db', files: [], date: '2026-01-17T11:00:00.000Z' },
      },
    ]);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: Search MUST find entries by title
   */
  it('MUST find entries by title', async () => {
    const results = await extractor.searchKnowledge('Redis');

    expect(results.length).toBe(1);
    expect(results[0]!.title).toContain('Redis');
  });

  /**
   * GOLDEN TEST: Search MUST find entries by keywords
   */
  it('MUST find entries by keywords', async () => {
    const results = await extractor.searchKnowledge('caching');

    expect(results.length).toBe(1);
  });

  /**
   * GOLDEN TEST: Search MUST be case-insensitive
   */
  it('MUST be case-insensitive', async () => {
    const results1 = await extractor.searchKnowledge('REDIS');
    const results2 = await extractor.searchKnowledge('redis');

    expect(results1.length).toBe(results2.length);
  });

  /**
   * GOLDEN TEST: Search MUST return empty for no matches
   */
  it('MUST return empty array for no matches', async () => {
    const results = await extractor.searchKnowledge('nonexistent');

    expect(results).toEqual([]);
  });
});

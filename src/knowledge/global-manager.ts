/**
 * Global Knowledge Manager
 * Manages knowledge that is shared across all projects
 * Location: ~/.mcp-engineering/global-knowledge/
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { parse, stringify } from 'yaml';
import type { KnowledgeEntry } from '../types/index.js';

/**
 * Index entry for global knowledge
 */
interface GlobalIndexEntry {
  id: string;
  title: string;
  type: string;
  keywords: string[];
  sourceProject: string;
  promotedAt: string;
  path: string;
}

/**
 * Global knowledge index
 */
interface GlobalIndex {
  entries: GlobalIndexEntry[];
}

/**
 * Result of promoting knowledge
 */
export interface PromoteResult {
  promoted: number;
  skipped: number;
  entries: string[];
}

/**
 * GlobalKnowledgeManager - Manages shared knowledge across projects
 */
export class GlobalKnowledgeManager {
  private globalDir: string;
  private indexPath: string;
  private detailsDir: string;

  constructor() {
    this.globalDir = path.join(os.homedir(), '.mcp-engineering', 'global-knowledge');
    this.indexPath = path.join(this.globalDir, 'index.yaml');
    this.detailsDir = path.join(this.globalDir, 'details');
  }

  /**
   * Initialize global knowledge directory
   */
  async init(): Promise<void> {
    await fs.mkdir(this.globalDir, { recursive: true });
    await fs.mkdir(this.detailsDir, { recursive: true });

    // Create index if it doesn't exist
    try {
      await fs.access(this.indexPath);
    } catch {
      const emptyIndex: GlobalIndex = { entries: [] };
      await fs.writeFile(this.indexPath, stringify(emptyIndex, { indent: 2 }), 'utf-8');
    }
  }

  /**
   * Load global index
   */
  async loadIndex(): Promise<GlobalIndex> {
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      return parse(content) as GlobalIndex;
    } catch {
      return { entries: [] };
    }
  }

  /**
   * Save global index
   */
  async saveIndex(index: GlobalIndex): Promise<void> {
    await fs.writeFile(this.indexPath, stringify(index, { indent: 2 }), 'utf-8');
  }

  /**
   * Promote knowledge entries from a project to global
   */
  async promote(
    entries: KnowledgeEntry[],
    projectName: string
  ): Promise<PromoteResult> {
    await this.init();

    const index = await this.loadIndex();
    const result: PromoteResult = {
      promoted: 0,
      skipped: 0,
      entries: [],
    };

    for (const entry of entries) {
      // Check if already exists (by title similarity)
      const exists = index.entries.some(
        (e) =>
          e.title.toLowerCase() === entry.title.toLowerCase() ||
          e.id === entry.id
      );

      if (exists) {
        result.skipped++;
        continue;
      }

      // Generate global ID
      const globalId = `global-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Extract keywords from title and content
      const keywords = this.extractKeywords(entry.title, entry.content);

      // Create detail file
      const detailPath = `details/${globalId}.md`;
      const detailContent = `# ${entry.title}

**Type:** ${entry.type}
**Source:** ${projectName}
**Original Feature:** ${entry.source.feature}
**Date:** ${entry.source.date}

---

${entry.content}
`;
      await fs.writeFile(path.join(this.globalDir, detailPath), detailContent, 'utf-8');

      // Add to index
      const indexEntry: GlobalIndexEntry = {
        id: globalId,
        title: entry.title,
        type: entry.type,
        keywords,
        sourceProject: projectName,
        promotedAt: new Date().toISOString(),
        path: detailPath,
      };

      index.entries.push(indexEntry);
      result.promoted++;
      result.entries.push(entry.title);
    }

    await this.saveIndex(index);
    return result;
  }

  /**
   * Search global knowledge
   */
  async search(query: string): Promise<GlobalIndexEntry[]> {
    const index = await this.loadIndex();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    return index.entries.filter((entry) => {
      // Match by title
      if (entry.title.toLowerCase().includes(queryLower)) {
        return true;
      }

      // Match by keywords
      for (const word of queryWords) {
        if (entry.keywords.some((k) => k.includes(word) || word.includes(k))) {
          return true;
        }
      }

      // Match by type
      if (entry.type.toLowerCase().includes(queryLower)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Get entry content
   */
  async getEntry(id: string): Promise<{ meta: GlobalIndexEntry; content: string } | null> {
    const index = await this.loadIndex();
    const entry = index.entries.find((e) => e.id === id);

    if (!entry) {
      return null;
    }

    try {
      const content = await fs.readFile(path.join(this.globalDir, entry.path), 'utf-8');
      return { meta: entry, content };
    } catch {
      return null;
    }
  }

  /**
   * Get stats about global knowledge
   */
  async getStats(): Promise<{ total: number; byType: Record<string, number>; byProject: Record<string, number> }> {
    const index = await this.loadIndex();

    const byType: Record<string, number> = {};
    const byProject: Record<string, number> = {};

    for (const entry of index.entries) {
      byType[entry.type] = (byType[entry.type] ?? 0) + 1;
      byProject[entry.sourceProject] = (byProject[entry.sourceProject] ?? 0) + 1;
    }

    return {
      total: index.entries.length,
      byType,
      byProject,
    };
  }

  /**
   * Extract keywords from title and content
   */
  private extractKeywords(title: string, content: string): string[] {
    const text = `${title} ${content}`.toLowerCase();

    // Common programming terms to extract
    const patterns = [
      /\b(api|rest|graphql|grpc)\b/gi,
      /\b(database|sql|nosql|redis|mongo)\b/gi,
      /\b(auth|authentication|authorization|oauth|jwt)\b/gi,
      /\b(cache|caching|redis)\b/gi,
      /\b(error|exception|handling)\b/gi,
      /\b(test|testing|unit|integration)\b/gi,
      /\b(deploy|deployment|ci|cd)\b/gi,
      /\b(security|encryption|hash)\b/gi,
      /\b(async|await|promise|callback)\b/gi,
      /\b(pattern|design|architecture)\b/gi,
      /\b(gpio|i2c|spi|uart|dma)\b/gi,
      /\b(embedded|firmware|hal)\b/gi,
    ];

    const keywords = new Set<string>();

    // Extract from title words
    const titleWords = title.toLowerCase().split(/[\s\-_]+/);
    for (const word of titleWords) {
      if (word.length > 3) {
        keywords.add(word);
      }
    }

    // Extract known patterns
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          keywords.add(match.toLowerCase());
        }
      }
    }

    return [...keywords].slice(0, 10);
  }

  /**
   * Get the global directory path
   */
  getGlobalDir(): string {
    return this.globalDir;
  }
}

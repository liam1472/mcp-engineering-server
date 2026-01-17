/**
 * Knowledge Extractor
 * Extracts patterns, solutions, and learnings from completed features
 *
 * Storage structure (v2):
 * .engineering/knowledge/
 * ├── index.yaml          # Metadata + summary + keywords for search
 * └── details/            # Full content files
 *     ├── 2026-01-17_fix-i2c-timeout.md
 *     └── ...
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parse, stringify } from 'yaml';
import type { KnowledgeEntry, KnowledgeBase } from '../types/index.js';

interface FeatureManifest {
  name: string;
  startedAt: string;
  status: string;
  files: string[];
  decisions: string[];
}

// Index entry for the new split structure
interface KnowledgeIndexEntry {
  id: string;
  type: KnowledgeEntry['type'];
  title: string;
  summary: string;
  keywords: string[];
  path: string; // Relative path to detail file
  date: string;
  source: {
    feature: string;
    files: string[];
  };
}

interface KnowledgeIndex {
  version: string;
  entries: KnowledgeIndexEntry[];
  lastUpdated: string;
}

export class KnowledgeExtractor {
  private workingDir: string;
  private knowledgeDir: string;
  private indexPath: string;
  private detailsDir: string;
  // Legacy path for backwards compatibility
  private legacyPath: string;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
    this.knowledgeDir = path.join(this.workingDir, '.engineering', 'knowledge');
    this.indexPath = path.join(this.knowledgeDir, 'index.yaml');
    this.detailsDir = path.join(this.knowledgeDir, 'details');
    this.legacyPath = path.join(this.knowledgeDir, 'base.yaml');
  }

  async extractFromFeature(featurePath: string): Promise<KnowledgeEntry[]> {
    const entries: KnowledgeEntry[] = [];

    try {
      // Read feature manifest
      const manifestPath = path.join(featurePath, 'manifest.yaml');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = parse(manifestContent) as FeatureManifest;

      // Read decisions file
      const decisionsPath = path.join(featurePath, 'decisions.md');
      const decisionsContent = await this.safeReadFile(decisionsPath);

      // Extract decisions as knowledge entries
      const decisionEntries = this.extractDecisions(
        decisionsContent,
        manifest.name,
        manifest.files
      );
      entries.push(...decisionEntries);

      // Read context for patterns and solutions
      const contextPath = path.join(featurePath, 'context.yaml');
      const contextContent = await this.safeReadFile(contextPath);

      if (contextContent) {
        const context = parse(contextContent) as {
          notes?: string[];
          blockers?: string[];
        };

        // Extract solutions from resolved blockers
        if (context.blockers && context.blockers.length > 0) {
          entries.push({
            id: this.generateId(),
            type: 'solution',
            title: `Blockers resolved in ${manifest.name}`,
            content: context.blockers.join('\n'),
            tags: ['blocker', 'resolved'],
            source: {
              feature: manifest.name,
              files: manifest.files,
              date: new Date().toISOString(),
            },
          });
        }

        // Extract notes as tips
        if (context.notes && context.notes.length > 0) {
          entries.push({
            id: this.generateId(),
            type: 'tip',
            title: `Notes from ${manifest.name}`,
            content: context.notes.join('\n'),
            tags: ['note'],
            source: {
              feature: manifest.name,
              files: manifest.files,
              date: new Date().toISOString(),
            },
          });
        }
      }

      // Analyze code patterns from modified files
      const patternEntries = await this.extractCodePatterns(manifest.name, manifest.files);
      entries.push(...patternEntries);
    } catch (error) {
      // Feature might not have all expected files
      console.error('Knowledge extraction error:', error);
    }

    return entries;
  }

  private extractDecisions(
    content: string,
    featureName: string,
    files: string[]
  ): KnowledgeEntry[] {
    const entries: KnowledgeEntry[] = [];

    if (!content) return entries;

    // Parse markdown decisions (## timestamp sections)
    const sections = content.split(/^## /gm).slice(1);

    for (const section of sections) {
      const lines = section.trim().split('\n');
      const timestamp = lines[0]?.trim();
      const decisionContent = lines.slice(1).join('\n').trim();

      if (decisionContent && decisionContent.length > 10) {
        entries.push({
          id: this.generateId(),
          type: 'decision',
          title: `Decision: ${this.summarize(decisionContent, 50)}`,
          content: decisionContent,
          tags: this.extractTags(decisionContent),
          source: {
            feature: featureName,
            files,
            date: timestamp ?? new Date().toISOString(),
          },
        });
      }
    }

    return entries;
  }

  private async extractCodePatterns(
    featureName: string,
    files: string[]
  ): Promise<KnowledgeEntry[]> {
    const entries: KnowledgeEntry[] = [];

    // Look for common patterns in files
    const patternIndicators = [
      { regex: /\/\/ PATTERN:/gi, type: 'pattern' as const },
      { regex: /\/\/ BUG:/gi, type: 'bug' as const },
      { regex: /\/\/ FIX:/gi, type: 'solution' as const },
      { regex: /# PATTERN:/gi, type: 'pattern' as const },
      { regex: /# BUG:/gi, type: 'bug' as const },
      { regex: /# FIX:/gi, type: 'solution' as const },
      { regex: /\/\*\* @pattern/gi, type: 'pattern' as const },
    ];

    for (const file of files) {
      try {
        const filePath = path.join(this.workingDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;

          for (const indicator of patternIndicators) {
            if (indicator.regex.test(line)) {
              // Extract the comment content
              const commentContent = line.replace(indicator.regex, '').trim();
              entries.push({
                id: this.generateId(),
                type: indicator.type,
                title: this.summarize(commentContent, 60),
                content: commentContent,
                tags: [indicator.type, path.extname(file).slice(1)],
                source: {
                  feature: featureName,
                  files: [`${file}:${i + 1}`],
                  date: new Date().toISOString(),
                },
              });
            }
          }
        }
      } catch {
        // File might not exist or be unreadable
      }
    }

    return entries;
  }

  async saveKnowledge(entries: KnowledgeEntry[]): Promise<number> {
    if (entries.length === 0) return 0;

    // Ensure directories exist
    await fs.mkdir(this.detailsDir, { recursive: true });

    // Load existing index
    let index: KnowledgeIndex;
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      index = parse(content) as KnowledgeIndex;
    } catch {
      index = {
        version: '2.0',
        entries: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    // Also maintain backwards compatible base.yaml
    let legacyBase: KnowledgeBase;
    try {
      const content = await fs.readFile(this.legacyPath, 'utf-8');
      legacyBase = parse(content) as KnowledgeBase;
    } catch {
      legacyBase = {
        version: '1.0',
        entries: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    // Get existing IDs to avoid duplicates
    const existingIds = new Set(index.entries.map(e => e.id));
    const newEntries = entries.filter(e => !existingIds.has(e.id));

    let savedCount = 0;
    for (const entry of newEntries) {
      // Generate file name for detail
      const date = new Date().toISOString().split('T')[0];
      const safeTitle = entry.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);
      const fileName = `${date}_${safeTitle}.md`;
      const detailPath = path.join(this.detailsDir, fileName);

      // Write detail file as markdown
      const detailContent = this.formatDetailMarkdown(entry);
      await fs.writeFile(detailPath, detailContent, 'utf-8');

      // Create index entry
      const indexEntry: KnowledgeIndexEntry = {
        id: entry.id,
        type: entry.type,
        title: entry.title,
        summary: this.summarize(entry.content, 200),
        keywords: this.extractKeywords(entry),
        path: `details/${fileName}`,
        date: entry.source.date,
        source: {
          feature: entry.source.feature,
          files: entry.source.files,
        },
      };

      index.entries.push(indexEntry);

      // Also add to legacy base for backwards compatibility
      legacyBase.entries.push(entry);

      savedCount++;
    }

    index.lastUpdated = new Date().toISOString();
    legacyBase.lastUpdated = new Date().toISOString();

    // Save index
    await fs.writeFile(this.indexPath, stringify(index, { indent: 2 }), 'utf-8');

    // Save legacy base for backwards compatibility
    await fs.writeFile(this.legacyPath, stringify(legacyBase, { indent: 2 }), 'utf-8');

    return savedCount;
  }

  /**
   * Format a knowledge entry as a markdown file
   */
  private formatDetailMarkdown(entry: KnowledgeEntry): string {
    const lines: string[] = [];

    lines.push(`# ${entry.title}`);
    lines.push('');
    lines.push(`**Type:** ${entry.type}`);
    lines.push(`**Date:** ${entry.source.date}`);
    lines.push(`**Feature:** ${entry.source.feature}`);
    lines.push(`**Tags:** ${entry.tags.join(', ')}`);
    lines.push('');
    lines.push('## Content');
    lines.push('');
    lines.push(entry.content);
    lines.push('');
    lines.push('## Source Files');
    lines.push('');
    for (const file of entry.source.files) {
      lines.push(`- ${file}`);
    }
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Extract keywords for fuzzy search
   */
  private extractKeywords(entry: KnowledgeEntry): string[] {
    const keywords = new Set<string>();

    // Add tags
    for (const tag of entry.tags) {
      keywords.add(tag.toLowerCase());
    }

    // Add type
    keywords.add(entry.type);

    // Add feature name words
    const featureWords = entry.source.feature.toLowerCase().split(/[-_\s]+/);
    for (const word of featureWords) {
      if (word.length > 2) {
        keywords.add(word);
      }
    }

    // Extract significant words from title
    const titleWords = entry.title.toLowerCase().split(/\s+/);
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'to',
      'from',
      'in',
      'on',
      'for',
      'with',
      'and',
      'or',
      'of',
    ]);
    for (const word of titleWords) {
      if (word.length > 2 && !stopWords.has(word)) {
        keywords.add(word.replace(/[^a-z0-9]/g, ''));
      }
    }

    return Array.from(keywords).slice(0, 15);
  }

  async searchKnowledge(query: string): Promise<KnowledgeEntry[]> {
    const lowerQuery = query.toLowerCase();

    // Try new index first
    try {
      const indexContent = await fs.readFile(this.indexPath, 'utf-8');
      const index = parse(indexContent) as KnowledgeIndex;

      // Search using keywords and title
      const matchingEntries = index.entries.filter(
        entry =>
          entry.title.toLowerCase().includes(lowerQuery) ||
          entry.summary.toLowerCase().includes(lowerQuery) ||
          entry.keywords.some(k => k.includes(lowerQuery))
      );

      // Load full entries from legacy base for backwards compatibility
      const legacyContent = await fs.readFile(this.legacyPath, 'utf-8');
      const legacyBase = parse(legacyContent) as KnowledgeBase;
      const matchingIds = new Set(matchingEntries.map(e => e.id));

      return legacyBase.entries.filter(e => matchingIds.has(e.id));
    } catch {
      // Fall back to legacy search
      try {
        const content = await fs.readFile(this.legacyPath, 'utf-8');
        const base = parse(content) as KnowledgeBase;

        return base.entries.filter(
          entry =>
            entry.title.toLowerCase().includes(lowerQuery) ||
            entry.content.toLowerCase().includes(lowerQuery) ||
            entry.tags.some(t => t.toLowerCase().includes(lowerQuery))
        );
      } catch {
        return [];
      }
    }
  }

  async getStats(): Promise<{ total: number; byType: Record<string, number> }> {
    // Try new index first
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      const index = parse(content) as KnowledgeIndex;

      const byType: Record<string, number> = {};
      for (const entry of index.entries) {
        byType[entry.type] = (byType[entry.type] ?? 0) + 1;
      }

      return { total: index.entries.length, byType };
    } catch {
      // Fall back to legacy
      try {
        const content = await fs.readFile(this.legacyPath, 'utf-8');
        const base = parse(content) as KnowledgeBase;

        const byType: Record<string, number> = {};
        for (const entry of base.entries) {
          byType[entry.type] = (byType[entry.type] ?? 0) + 1;
        }

        return { total: base.entries.length, byType };
      } catch {
        return { total: 0, byType: {} };
      }
    }
  }

  private generateId(): string {
    return `k_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private summarize(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  private extractTags(text: string): string[] {
    const tags: string[] = [];

    // Common tech terms
    const techTerms = [
      'api',
      'database',
      'auth',
      'security',
      'performance',
      'ui',
      'backend',
      'frontend',
      'testing',
      'deploy',
      'config',
      'cache',
      'error',
      'async',
      'state',
    ];

    const lowerText = text.toLowerCase();
    for (const term of techTerms) {
      if (lowerText.includes(term)) {
        tags.push(term);
      }
    }

    return tags.slice(0, 5); // Max 5 tags
  }

  private async safeReadFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return '';
    }
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
    this.knowledgeDir = path.join(dir, '.engineering', 'knowledge');
    this.indexPath = path.join(this.knowledgeDir, 'index.yaml');
    this.detailsDir = path.join(this.knowledgeDir, 'details');
    this.legacyPath = path.join(this.knowledgeDir, 'base.yaml');
  }
}

/**
 * Knowledge Extractor
 * Extracts patterns, solutions, and learnings from completed features
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

export class KnowledgeExtractor {
  private workingDir: string;
  private knowledgePath: string;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
    this.knowledgePath = path.join(this.workingDir, '.engineering', 'knowledge', 'base.yaml');
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

    // Load existing knowledge base
    let base: KnowledgeBase;
    try {
      const content = await fs.readFile(this.knowledgePath, 'utf-8');
      base = parse(content) as KnowledgeBase;
    } catch {
      base = {
        version: '1.0',
        entries: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    // Add new entries (avoiding duplicates by ID)
    const existingIds = new Set(base.entries.map(e => e.id));
    const newEntries = entries.filter(e => !existingIds.has(e.id));
    base.entries.push(...newEntries);
    base.lastUpdated = new Date().toISOString();

    // Save
    await fs.mkdir(path.dirname(this.knowledgePath), { recursive: true });
    await fs.writeFile(this.knowledgePath, stringify(base, { indent: 2 }), 'utf-8');

    return newEntries.length;
  }

  async searchKnowledge(query: string): Promise<KnowledgeEntry[]> {
    try {
      const content = await fs.readFile(this.knowledgePath, 'utf-8');
      const base = parse(content) as KnowledgeBase;
      const lowerQuery = query.toLowerCase();

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

  async getStats(): Promise<{ total: number; byType: Record<string, number> }> {
    try {
      const content = await fs.readFile(this.knowledgePath, 'utf-8');
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
    this.knowledgePath = path.join(dir, '.engineering', 'knowledge', 'base.yaml');
  }
}

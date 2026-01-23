/**
 * Planning Manager
 * Handles feature planning phase with knowledge and manifesto injection
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from 'yaml';

/**
 * Options for creating a plan
 */
export interface CreatePlanOptions {
  feature: string;
  injectKnowledge?: boolean | undefined;
  injectManifesto?: boolean | undefined;
  description?: string | undefined;
}

/**
 * Result of plan creation
 */
export interface PlanResult {
  feature: string;
  planPath: string;
  knowledgeInjected: string[];
  manifestoInjected: boolean;
  error?: string | undefined;
}

/**
 * Knowledge entry from index
 */
interface KnowledgeIndexEntry {
  id: string;
  title: string;
  keywords: string[];
  path: string;
}

interface KnowledgeIndex {
  entries: KnowledgeIndexEntry[];
}

/**
 * PlanningManager - Creates and manages feature plans
 */
export class PlanningManager {
  private workingDir: string;
  private featuresDir: string;
  private knowledgeDir: string;
  private engineeringDir: string;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
    this.engineeringDir = path.join(this.workingDir, '.engineering');
    this.featuresDir = path.join(this.engineeringDir, 'features');
    this.knowledgeDir = path.join(this.engineeringDir, 'knowledge');
  }

  /**
   * Create a plan for a feature
   */
  async createPlan(options: CreatePlanOptions): Promise<PlanResult> {
    const { feature, injectKnowledge = false, injectManifesto = false, description } = options;

    const featureDir = path.join(this.featuresDir, feature);
    const planPath = path.join(featureDir, 'PLAN.md');

    // Check if feature directory exists
    try {
      await fs.access(featureDir);
    } catch {
      return {
        feature,
        planPath: '',
        knowledgeInjected: [],
        manifestoInjected: false,
        error: `Feature directory "${feature}" not found. Use /eng-start first.`,
      };
    }

    // Build plan content
    const sections: string[] = [];

    // Header
    sections.push(`# ${feature}`);
    sections.push('');
    sections.push(`> Created: ${new Date().toISOString()}`);
    sections.push('');

    // Objective section
    sections.push('## Objective');
    sections.push('');
    if (description) {
      sections.push(description);
    } else {
      sections.push('<!-- Describe the goal of this feature -->');
    }
    sections.push('');

    // Tasks section
    sections.push('## Tasks');
    sections.push('');
    sections.push('- [ ] Task 1');
    sections.push('- [ ] Task 2');
    sections.push('- [ ] Task 3');
    sections.push('');

    // Acceptance Criteria section
    sections.push('## Acceptance Criteria');
    sections.push('');
    sections.push('- [ ] Criteria 1');
    sections.push('- [ ] Criteria 2');
    sections.push('');

    // Knowledge injection
    const knowledgeInjected: string[] = [];
    if (injectKnowledge) {
      const relatedKnowledge = await this.searchKnowledge(feature);
      if (relatedKnowledge.length > 0) {
        sections.push('## Related Knowledge');
        sections.push('');
        for (const entry of relatedKnowledge) {
          sections.push(`### ${entry.title}`);
          sections.push('');
          if (entry.content) {
            sections.push(entry.content);
            sections.push('');
          }
          knowledgeInjected.push(entry.id);
        }
      }
    }

    // Manifesto injection
    let manifestoInjected = false;
    if (injectManifesto) {
      const manifesto = await this.getManifesto();
      if (manifesto) {
        sections.push('## Manifesto Rules');
        sections.push('');
        sections.push('> The following rules from the engineering manifesto apply to this feature:');
        sections.push('');
        sections.push(manifesto);
        sections.push('');
        manifestoInjected = true;
      }
    }

    // Write plan file
    const planContent = sections.join('\n');
    await fs.writeFile(planPath, planContent, 'utf-8');

    return {
      feature,
      planPath,
      knowledgeInjected,
      manifestoInjected,
    };
  }

  /**
   * Search knowledge base for entries related to feature name
   */
  private async searchKnowledge(
    feature: string
  ): Promise<Array<{ id: string; title: string; content?: string | undefined }>> {
    const results: Array<{ id: string; title: string; content?: string | undefined }> = [];

    try {
      const indexPath = path.join(this.knowledgeDir, 'index.yaml');
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = parse(indexContent) as KnowledgeIndex;

      if (!index.entries) {
        return results;
      }

      // Extract keywords from feature name
      const featureKeywords = feature
        .toLowerCase()
        .split(/[-_\s]+/)
        .filter((k) => k.length > 2);

      for (const entry of index.entries) {
        // Check if any feature keyword matches entry keywords or title
        const entryKeywords = entry.keywords.map((k) => k.toLowerCase());
        const titleWords = entry.title.toLowerCase().split(/\s+/);

        const matches = featureKeywords.some(
          (fk) => entryKeywords.some((ek) => ek.includes(fk) || fk.includes(ek)) || titleWords.some((tw) => tw.includes(fk) || fk.includes(tw))
        );

        if (matches) {
          // Load content from detail file
          let content: string | undefined;
          try {
            const detailPath = path.join(this.knowledgeDir, entry.path);
            content = await fs.readFile(detailPath, 'utf-8');
          } catch {
            // Detail file not found, skip content
          }

          results.push({
            id: entry.id,
            title: entry.title,
            content,
          });
        }
      }
    } catch {
      // No knowledge base or error reading it
    }

    return results;
  }

  /**
   * Get manifesto content
   */
  private async getManifesto(): Promise<string | null> {
    try {
      const manifestoPath = path.join(this.engineeringDir, 'manifesto.md');
      const content = await fs.readFile(manifestoPath, 'utf-8');
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Read an existing plan
   */
  async getPlan(feature: string): Promise<{ content: string } | null> {
    try {
      const planPath = path.join(this.featuresDir, feature, 'PLAN.md');
      const content = await fs.readFile(planPath, 'utf-8');
      return { content };
    } catch {
      return null;
    }
  }

  /**
   * Update the working directory
   */
  setWorkingDir(dir: string): void {
    this.workingDir = dir;
    this.engineeringDir = path.join(dir, '.engineering');
    this.featuresDir = path.join(this.engineeringDir, 'features');
    this.knowledgeDir = path.join(this.engineeringDir, 'knowledge');
  }
}

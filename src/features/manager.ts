/**
 * Feature Manager
 * Handles feature lifecycle: start, validate, done
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { stringify, parse } from 'yaml';
import { KnowledgeExtractor } from '../knowledge/extractor.js';
import type { KnowledgeEntry } from '../types/index.js';

interface FeatureManifest {
  name: string;
  startedAt: string;
  status: 'active' | 'completed';
  files: string[];
  decisions: string[];
}

interface FeatureContext {
  currentTask: string | null;
  notes: string[];
  blockers: string[];
}

export class FeatureManager {
  private workingDir: string;
  private featuresDir: string;
  private archiveDir: string;
  private knowledgeExtractor: KnowledgeExtractor;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
    this.featuresDir = path.join(this.workingDir, '.engineering', 'features');
    this.archiveDir = path.join(this.workingDir, '.engineering', 'archive');
    this.knowledgeExtractor = new KnowledgeExtractor(this.workingDir);
  }

  async startFeature(name: string): Promise<FeatureManifest> {
    const featureDir = path.join(this.featuresDir, name);

    // Check if feature already exists
    try {
      await fs.access(featureDir);
      throw new Error(`Feature "${name}" already exists`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    // Create feature directory
    await fs.mkdir(featureDir, { recursive: true });

    const manifest: FeatureManifest = {
      name,
      startedAt: new Date().toISOString(),
      status: 'active',
      files: [],
      decisions: [],
    };

    const context: FeatureContext = {
      currentTask: null,
      notes: [],
      blockers: [],
    };

    // Save manifest and context
    await fs.writeFile(
      path.join(featureDir, 'manifest.yaml'),
      stringify(manifest, { indent: 2 }),
      'utf-8'
    );

    await fs.writeFile(
      path.join(featureDir, 'context.yaml'),
      stringify(context, { indent: 2 }),
      'utf-8'
    );

    await fs.writeFile(path.join(featureDir, 'decisions.md'), `# ${name} - Decisions\n\n`, 'utf-8');

    return manifest;
  }

  async getActiveFeature(): Promise<string | null> {
    try {
      const features = await fs.readdir(this.featuresDir);

      for (const feature of features) {
        const manifestPath = path.join(this.featuresDir, feature, 'manifest.yaml');
        try {
          const content = await fs.readFile(manifestPath, 'utf-8');
          const manifest = parse(content) as FeatureManifest;
          if (manifest.status === 'active') {
            return feature;
          }
        } catch {
          // Skip invalid feature directories
        }
      }
    } catch {
      // Features directory doesn't exist
    }

    return null;
  }

  async completeFeature(
    name: string
  ): Promise<{ archivePath: string; knowledgeExtracted: KnowledgeEntry[] }> {
    const featureDir = path.join(this.featuresDir, name);
    const manifestPath = path.join(featureDir, 'manifest.yaml');

    // Load and update manifest
    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest = parse(content) as FeatureManifest;
    manifest.status = 'completed';

    await fs.writeFile(manifestPath, stringify(manifest, { indent: 2 }), 'utf-8');

    // Extract knowledge before archiving
    const knowledgeExtracted = await this.knowledgeExtractor.extractFromFeature(featureDir);
    await this.knowledgeExtractor.saveKnowledge(knowledgeExtracted);

    // Archive the feature
    const date = new Date().toISOString().split('T')[0];
    const archiveName = `${date}_${name}`;
    const archivePath = path.join(this.archiveDir, archiveName);

    await fs.mkdir(this.archiveDir, { recursive: true });
    await fs.rename(featureDir, archivePath);

    return { archivePath, knowledgeExtracted };
  }

  async listFeatures(): Promise<Array<{ name: string; status: string; startedAt: string }>> {
    const result: Array<{ name: string; status: string; startedAt: string }> = [];

    try {
      const features = await fs.readdir(this.featuresDir);

      for (const feature of features) {
        const manifestPath = path.join(this.featuresDir, feature, 'manifest.yaml');
        try {
          const content = await fs.readFile(manifestPath, 'utf-8');
          const manifest = parse(content) as FeatureManifest;
          result.push({
            name: manifest.name,
            status: manifest.status,
            startedAt: manifest.startedAt,
          });
        } catch {
          // Skip invalid
        }
      }
    } catch {
      // No features
    }

    return result;
  }

  async addDecision(featureName: string, decision: string): Promise<void> {
    const decisionsPath = path.join(this.featuresDir, featureName, 'decisions.md');
    const timestamp = new Date().toISOString();
    await fs.appendFile(decisionsPath, `\n## ${timestamp}\n${decision}\n`, 'utf-8');
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
    this.featuresDir = path.join(dir, '.engineering', 'features');
    this.archiveDir = path.join(dir, '.engineering', 'archive');
    this.knowledgeExtractor.setWorkingDir(dir);
  }

  getKnowledgeExtractor(): KnowledgeExtractor {
    return this.knowledgeExtractor;
  }

  /**
   * Read manifesto content from .engineering/manifesto.md
   * Returns null if no manifesto exists
   */
  async getManifesto(): Promise<string | null> {
    const manifestoPath = path.join(this.workingDir, '.engineering', 'manifesto.md');

    try {
      const content = await fs.readFile(manifestoPath, 'utf-8');
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Read blueprint content from .engineering/blueprint.md
   * Returns null if no blueprint exists
   */
  async getBlueprint(): Promise<string | null> {
    const blueprintPath = path.join(this.workingDir, '.engineering', 'blueprint.md');

    try {
      const content = await fs.readFile(blueprintPath, 'utf-8');
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Read PLAN.md content for a feature
   * Returns null if no plan exists
   */
  async getPlan(featureName: string): Promise<string | null> {
    const planPath = path.join(this.featuresDir, featureName, 'PLAN.md');

    try {
      const content = await fs.readFile(planPath, 'utf-8');
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Get full context for a feature (plan + related knowledge)
   * Used by eng_start for context injection
   */
  async getFeatureContext(featureName: string): Promise<{
    plan: string | null;
    knowledge: KnowledgeEntry[];
    manifesto: string | null;
  }> {
    const plan = await this.getPlan(featureName);
    const manifesto = await this.getManifesto();
    const knowledge = await this.knowledgeExtractor.searchKnowledge(featureName);

    return {
      plan,
      knowledge,
      manifesto,
    };
  }
}

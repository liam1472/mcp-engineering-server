/**
 * Configuration Manager
 * Handles .engineering/config.yaml read/write
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parse, stringify } from 'yaml';
import { EngConfigSchema, type EngConfig, type ProjectType } from '../types/index.js';

const CONFIG_DIR = '.engineering';
const CONFIG_FILE = 'config.yaml';

export class ConfigManager {
  private workingDir: string;
  private config: EngConfig | null = null;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
  }

  get configPath(): string {
    return path.join(this.workingDir, CONFIG_DIR, CONFIG_FILE);
  }

  get engineeringDir(): string {
    return path.join(this.workingDir, CONFIG_DIR);
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  async load(): Promise<EngConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const parsed = parse(content) as unknown;
      this.config = EngConfigSchema.parse(parsed);
      return this.config;
    } catch (error) {
      throw new Error(`Failed to load config: ${String(error)}`);
    }
  }

  async save(config: EngConfig): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(this.engineeringDir, { recursive: true });

    const content = stringify(config, {
      indent: 2,
      lineWidth: 100,
    });

    await fs.writeFile(this.configPath, content, 'utf-8');
    this.config = config;
  }

  async initialize(projectName: string, projectType: ProjectType): Promise<EngConfig> {
    const config: EngConfig = {
      version: '1.0.0',
      projectType,
      projectName,
      autoSaveInterval: 300,
      security: {
        enabled: true,
        customPatterns: [],
        whitelist: [],
      },
      indexes: {
        functions: true,
        errors: true,
        constants: true,
        dependencies: true,
      },
    };

    await this.save(config);
    await this.createDirectoryStructure();

    return config;
  }

  private async createDirectoryStructure(): Promise<void> {
    const directories = [
      'index',
      'knowledge/patterns',
      'knowledge/solutions',
      'knowledge/bugs',
      'sessions',
      'features',
      'security',
      'archive',
    ];

    for (const dir of directories) {
      await fs.mkdir(path.join(this.engineeringDir, dir), { recursive: true });
    }

    // Create initial empty files
    const initialFiles: Array<[string, string]> = [
      [
        'sessions/context.yaml',
        'currentTask: null\ndecisions: []\nfindings: []\nblockers: []\nnextSteps: []\n',
      ],
      ['security/patterns.yaml', '# Custom security patterns\npatterns: []\n'],
      ['security/whitelist.yaml', '# False positive whitelist\nwhitelist: []\n'],
    ];

    for (const [filePath, content] of initialFiles) {
      const fullPath = path.join(this.engineeringDir, filePath);
      try {
        await fs.access(fullPath);
      } catch {
        await fs.writeFile(fullPath, content, 'utf-8');
      }
    }
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
    this.config = null;
  }
}

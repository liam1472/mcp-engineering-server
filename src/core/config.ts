/**
 * Configuration Manager
 * Handles .engineering/config.yaml read/write
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parse, stringify } from 'yaml';
import { glob } from 'glob';
import {
  EngConfigSchema,
  type EngConfig,
  type ProjectType,
  type ProfileType,
  type ArchitecturalGap,
  type ArchitecturalReport,
  getProfileType,
} from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  async initialize(
    projectName: string,
    projectType: ProjectType
  ): Promise<{ config: EngConfig; profile: ProfileType; architecturalReport: ArchitecturalReport }> {
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

    // Get profile type and copy templates
    const profile = getProfileType(projectType);
    await this.copyTemplates(profile);

    // Run architectural scan
    const architecturalReport = await this.runArchitecturalScan(profile);

    return { config, profile, architecturalReport };
  }

  /**
   * Copy manifesto and blueprint templates based on profile type
   */
  private async copyTemplates(profile: ProfileType): Promise<void> {
    if (profile === 'unknown') return;

    const templatesDir = path.join(__dirname, '..', 'templates');

    // Copy manifesto template
    const manifestoSource = path.join(templatesDir, 'manifestos', `${profile}.md`);
    const manifestoDest = path.join(this.engineeringDir, 'manifesto.md');

    try {
      await fs.access(manifestoSource);
      await fs.copyFile(manifestoSource, manifestoDest);
    } catch {
      // Template doesn't exist for this profile, skip silently
    }

    // Copy blueprint template
    const blueprintSource = path.join(templatesDir, 'blueprints', `${profile}-ops.md`);
    const blueprintDest = path.join(this.engineeringDir, 'blueprint.md');

    try {
      await fs.access(blueprintSource);
      await fs.copyFile(blueprintSource, blueprintDest);
    } catch {
      // Template doesn't exist for this profile, skip silently
    }
  }

  /**
   * Run architectural scan to detect missing infrastructure
   */
  private async runArchitecturalScan(profile: ProfileType): Promise<ArchitecturalReport> {
    const gaps: ArchitecturalGap[] = [];
    const recommendations: string[] = [];

    // Common checks for all profiles
    await this.checkCommonInfrastructure(gaps);

    // Profile-specific checks
    switch (profile) {
      case 'web':
        await this.checkWebInfrastructure(gaps);
        break;
      case 'dotnet':
        await this.checkDotnetInfrastructure(gaps);
        break;
      case 'embedded':
        await this.checkEmbeddedInfrastructure(gaps);
        break;
    }

    // Generate recommendations based on gaps
    if (gaps.length > 0) {
      recommendations.push('Run /eng-scan to index your codebase');
      recommendations.push('Review the manifesto.md for coding standards');
      recommendations.push('Review the blueprint.md for deployment standards');
    }

    return { gaps, recommendations };
  }

  private async checkCommonInfrastructure(gaps: ArchitecturalGap[]): Promise<void> {
    // Check for CI/CD
    const cicdPatterns = [
      '.github/workflows/*.yml',
      '.github/workflows/*.yaml',
      '.gitlab-ci.yml',
      'azure-pipelines.yml',
      'Jenkinsfile',
      '.circleci/config.yml',
    ];

    let hasCICD = false;
    for (const pattern of cicdPatterns) {
      const files = await glob(pattern, { cwd: this.workingDir, nodir: true });
      if (files.length > 0) {
        hasCICD = true;
        break;
      }
    }

    if (!hasCICD) {
      gaps.push({
        name: 'CI/CD Pipeline',
        description: 'No CI/CD configuration found',
        severity: 'warning',
        suggestion: 'Add .github/workflows/ or equivalent CI/CD config',
      });
    }

    // Check for .gitignore
    try {
      await fs.access(path.join(this.workingDir, '.gitignore'));
    } catch {
      gaps.push({
        name: '.gitignore',
        description: 'No .gitignore file found',
        severity: 'warning',
        suggestion: 'Create a .gitignore to exclude build artifacts and secrets',
      });
    }
  }

  private async checkWebInfrastructure(gaps: ArchitecturalGap[]): Promise<void> {
    // Check for Dockerfile
    try {
      await fs.access(path.join(this.workingDir, 'Dockerfile'));
    } catch {
      gaps.push({
        name: 'Dockerfile',
        description: 'No Dockerfile found for containerization',
        severity: 'info',
        suggestion: 'Add Dockerfile for consistent deployments',
      });
    }

    // Check for docker-compose
    const composePatterns = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
    let hasCompose = false;
    for (const pattern of composePatterns) {
      try {
        await fs.access(path.join(this.workingDir, pattern));
        hasCompose = true;
        break;
      } catch {
        // Continue checking
      }
    }

    if (!hasCompose) {
      gaps.push({
        name: 'Docker Compose',
        description: 'No docker-compose config found',
        severity: 'info',
        suggestion: 'Add docker-compose.yml for local development environment',
      });
    }

    // Check for health check endpoint (search in common patterns)
    const healthPatterns = await glob('**/*{health,healthcheck}*', {
      cwd: this.workingDir,
      nodir: true,
      ignore: ['node_modules/**', '.git/**'],
      maxDepth: 4,
    });

    if (healthPatterns.length === 0) {
      gaps.push({
        name: 'Health Check',
        description: 'No health check endpoint detected',
        severity: 'warning',
        suggestion: 'Add /health endpoint for load balancer and monitoring',
      });
    }
  }

  private async checkDotnetInfrastructure(gaps: ArchitecturalGap[]): Promise<void> {
    // Check for Dockerfile
    try {
      await fs.access(path.join(this.workingDir, 'Dockerfile'));
    } catch {
      gaps.push({
        name: 'Dockerfile',
        description: 'No Dockerfile found',
        severity: 'info',
        suggestion: 'Add Dockerfile using mcr.microsoft.com/dotnet/aspnet base image',
      });
    }

    // Check for Squirrel or auto-update config (for desktop apps)
    const csprojFiles = await glob('**/*.csproj', {
      cwd: this.workingDir,
      nodir: true,
      ignore: ['node_modules/**', '.git/**'],
      maxDepth: 3,
    });

    for (const csproj of csprojFiles) {
      try {
        const content = await fs.readFile(path.join(this.workingDir, csproj), 'utf-8');
        // Check if it's a desktop app (WPF, WinForms, MAUI)
        if (
          content.includes('UseWPF') ||
          content.includes('UseWindowsForms') ||
          content.includes('UseMaui')
        ) {
          // Check for Squirrel
          if (!content.includes('Squirrel') && !content.includes('Clowd.Squirrel')) {
            gaps.push({
              name: 'Auto-update',
              description: 'Desktop app without auto-update mechanism',
              severity: 'warning',
              suggestion: 'Add Squirrel.Windows or Clowd.Squirrel for auto-updates',
            });
          }
          break;
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Check for appsettings.json
    const appsettings = await glob('**/appsettings*.json', {
      cwd: this.workingDir,
      nodir: true,
      ignore: ['node_modules/**', '.git/**', 'bin/**', 'obj/**'],
      maxDepth: 3,
    });

    if (appsettings.length === 0) {
      gaps.push({
        name: 'Configuration',
        description: 'No appsettings.json found',
        severity: 'info',
        suggestion: 'Add appsettings.json for environment-specific configuration',
      });
    }
  }

  private async checkEmbeddedInfrastructure(gaps: ArchitecturalGap[]): Promise<void> {
    // Check for OTA update configuration
    const otaPatterns = [
      '**/rauc*.conf',
      '**/swupdate*.cfg',
      '**/mender*.yml',
      '**/hawkbit*.properties',
      '**/ota*.yaml',
      '**/ota*.json',
    ];

    let hasOTA = false;
    for (const pattern of otaPatterns) {
      const files = await glob(pattern, {
        cwd: this.workingDir,
        nodir: true,
        ignore: ['node_modules/**', '.git/**'],
        maxDepth: 5,
      });
      if (files.length > 0) {
        hasOTA = true;
        break;
      }
    }

    if (!hasOTA) {
      gaps.push({
        name: 'OTA Update',
        description: 'No OTA update configuration found',
        severity: 'warning',
        suggestion: 'Add RAUC or SWUpdate configuration for secure OTA updates',
      });
    }

    // Check for health/watchdog service
    const servicePatterns = ['**/*health*.service', '**/*watchdog*.service', '**/systemd/**/*.service'];
    let hasHealthService = false;
    for (const pattern of servicePatterns) {
      const files = await glob(pattern, {
        cwd: this.workingDir,
        nodir: true,
        ignore: ['node_modules/**', '.git/**'],
        maxDepth: 5,
      });
      if (files.length > 0) {
        hasHealthService = true;
        break;
      }
    }

    if (!hasHealthService) {
      gaps.push({
        name: 'Health Service',
        description: 'No systemd health service found',
        severity: 'info',
        suggestion: 'Add systemd service with health endpoint for monitoring',
      });
    }

    // Check for partition table or rootfs config
    const partitionPatterns = [
      '**/partition*.csv',
      '**/partitions.csv',
      '**/fstab*',
      '**/rootfs*.yaml',
      '**/*genimage*.cfg',
    ];

    let hasPartition = false;
    for (const pattern of partitionPatterns) {
      const files = await glob(pattern, {
        cwd: this.workingDir,
        nodir: true,
        ignore: ['node_modules/**', '.git/**'],
        maxDepth: 5,
      });
      if (files.length > 0) {
        hasPartition = true;
        break;
      }
    }

    if (!hasPartition) {
      gaps.push({
        name: 'Partition Table',
        description: 'No partition configuration found',
        severity: 'info',
        suggestion: 'Add partition table for A/B rootfs scheme',
      });
    }
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

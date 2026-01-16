/**
 * Universal Project Type Detector
 * Automatically detects project type based on file signatures
 */

import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ProjectType } from '../types/index.js';

interface DetectionRule {
  type: ProjectType;
  priority: number;
  files?: string[];
  patterns?: RegExp[];
  contentCheck?: (content: string) => boolean;
}

const DETECTION_RULES: DetectionRule[] = [
  // Embedded Systems
  {
    type: 'embedded-stm32',
    priority: 100,
    files: ['*.ioc', '.cproject'],
  },
  {
    type: 'embedded-esp32',
    priority: 100,
    files: ['sdkconfig', 'sdkconfig.defaults'],
  },
  {
    type: 'embedded-zephyr',
    priority: 100,
    files: ['prj.conf', 'west.yml'],
  },
  {
    type: 'embedded-arduino',
    priority: 90,
    files: ['*.ino'],
  },

  // .NET Projects
  {
    type: 'dotnet-aspnet',
    priority: 80,
    files: ['*.csproj', 'Program.cs', 'appsettings.json'],
  },
  {
    type: 'dotnet-wpf',
    priority: 85,
    files: ['*.csproj', 'App.xaml'],
  },
  {
    type: 'dotnet-maui',
    priority: 85,
    files: ['*.csproj', 'MauiProgram.cs'],
  },
  {
    type: 'dotnet-blazor',
    priority: 85,
    files: ['*.csproj', '_Imports.razor'],
  },

  // Web Projects
  {
    type: 'web-nextjs',
    priority: 75,
    files: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
  },
  {
    type: 'web-angular',
    priority: 75,
    files: ['angular.json'],
  },
  {
    type: 'web-vue',
    priority: 70,
    files: ['vue.config.js', 'vite.config.ts'],
  },
  {
    type: 'web-react',
    priority: 65,
    files: ['package.json'],
    contentCheck: content => content.includes('"react"'),
  },
  {
    type: 'web-node',
    priority: 50,
    files: ['package.json'],
  },

  // Native Projects
  {
    type: 'native-rust',
    priority: 80,
    files: ['Cargo.toml'],
  },
  {
    type: 'native-go',
    priority: 80,
    files: ['go.mod'],
  },
  {
    type: 'native-cmake',
    priority: 60,
    files: ['CMakeLists.txt'],
  },

  // Python Projects
  {
    type: 'python-django',
    priority: 75,
    files: ['manage.py', 'settings.py'],
  },
  {
    type: 'python-flask',
    priority: 70,
    files: ['requirements.txt', 'app.py'],
  },
  {
    type: 'python-general',
    priority: 50,
    files: ['requirements.txt', 'pyproject.toml', 'setup.py'],
  },
];

export class ProjectDetector {
  private workingDir: string;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
  }

  async detect(): Promise<ProjectType> {
    const matches: Array<{ type: ProjectType; priority: number }> = [];

    for (const rule of DETECTION_RULES) {
      if (await this.matchesRule(rule)) {
        matches.push({ type: rule.type, priority: rule.priority });
      }
    }

    if (matches.length === 0) {
      return 'unknown';
    }

    // Return highest priority match
    matches.sort((a, b) => b.priority - a.priority);
    return matches[0]?.type ?? 'unknown';
  }

  private async matchesRule(rule: DetectionRule): Promise<boolean> {
    if (!rule.files) {
      return false;
    }

    for (const pattern of rule.files) {
      const files = await glob(pattern, {
        cwd: this.workingDir,
        nodir: true,
        maxDepth: 3,
      });

      if (files.length > 0) {
        // If content check is required, validate content
        if (rule.contentCheck) {
          for (const file of files) {
            try {
              const content = await fs.readFile(path.join(this.workingDir, file), 'utf-8');
              if (rule.contentCheck(content)) {
                return true;
              }
            } catch {
              // File read error, skip
            }
          }
          return false;
        }
        return true;
      }
    }

    return false;
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
  }
}

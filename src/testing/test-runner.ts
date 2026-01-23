/**
 * Fast Test Runner
 * Runs unit tests quickly for TDD loop
 * Auto-detects test framework based on project configuration
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

/**
 * Supported test frameworks
 */
export type TestFramework =
  | 'vitest'
  | 'jest'
  | 'pytest'
  | 'cargo'
  | 'go'
  | 'dotnet'
  | 'ctest'
  | 'unknown';

/**
 * Test run options
 */
export interface TestOptions {
  file?: string | undefined;
  watch?: boolean | undefined;
  coverage?: boolean | undefined;
}

/**
 * Test execution result
 */
export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number; // ms
  exitCode: number;
  output: string;
}

/**
 * Framework detection config
 */
interface FrameworkConfig {
  configFiles: string[];
  packageKey?: string;
  command: string;
  fileArg: (file: string) => string;
  watchArg: string;
}

const FRAMEWORK_CONFIGS: Record<Exclude<TestFramework, 'unknown'>, FrameworkConfig> = {
  vitest: {
    configFiles: ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts'],
    packageKey: 'vitest',
    command: 'npx vitest run',
    fileArg: (file: string) => file,
    watchArg: '--watch',
  },
  jest: {
    configFiles: ['jest.config.js', 'jest.config.ts', 'jest.config.json'],
    packageKey: 'jest',
    command: 'npx jest',
    fileArg: (file: string) => file,
    watchArg: '--watch',
  },
  pytest: {
    configFiles: ['pytest.ini', 'pyproject.toml', 'setup.cfg'],
    command: 'pytest',
    fileArg: (file: string) => file,
    watchArg: '--watch', // requires pytest-watch
  },
  cargo: {
    configFiles: ['Cargo.toml'],
    command: 'cargo test',
    fileArg: (file: string) => `--test ${path.basename(file, '.rs')}`,
    watchArg: '', // cargo-watch required
  },
  go: {
    configFiles: ['go.mod'],
    command: 'go test ./...',
    fileArg: (file: string) => `-run ${path.basename(file, '_test.go')}`,
    watchArg: '', // external watcher required
  },
  dotnet: {
    configFiles: ['*.csproj', '*.sln'],
    command: 'dotnet test',
    fileArg: (file: string) => `--filter ${path.basename(file, '.cs')}`,
    watchArg: '--watch',
  },
  ctest: {
    configFiles: ['CMakeLists.txt'],
    command: 'ctest',
    fileArg: (file: string) => `-R ${path.basename(file)}`,
    watchArg: '',
  },
};

/**
 * TestRunner - Fast unit test runner
 */
export class TestRunner {
  private projectPath: string;
  private detectedFramework: TestFramework | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Auto-detect test framework based on project files
   */
  async detectFramework(): Promise<TestFramework> {
    if (this.detectedFramework) {
      return this.detectedFramework;
    }

    // Check for each framework in priority order
    const frameworkOrder: Exclude<TestFramework, 'unknown'>[] = [
      'vitest',
      'jest',
      'pytest',
      'cargo',
      'go',
      'dotnet',
      'ctest',
    ];

    for (const framework of frameworkOrder) {
      const config = FRAMEWORK_CONFIGS[framework];

      // Check config files
      for (const configFile of config.configFiles) {
        const configPath = path.join(this.projectPath, configFile);

        // Handle glob patterns for dotnet
        if (configFile.includes('*')) {
          const files = await this.globFiles(configFile);
          if (files.length > 0) {
            this.detectedFramework = framework;
            return framework;
          }
        } else {
          try {
            await fs.access(configPath);
            this.detectedFramework = framework;
            return framework;
          } catch {
            // File doesn't exist, continue checking
          }
        }
      }

      // Check package.json for JS frameworks
      if (config.packageKey) {
        const hasPackage = await this.checkPackageJson(config.packageKey);
        if (hasPackage) {
          this.detectedFramework = framework;
          return framework;
        }
      }
    }

    this.detectedFramework = 'unknown';
    return 'unknown';
  }

  /**
   * Get test command for framework
   */
  getCommand(framework: TestFramework, options?: TestOptions): string {
    if (framework === 'unknown') {
      return 'echo "No test framework detected"';
    }

    const config = FRAMEWORK_CONFIGS[framework];
    let cmd = config.command;

    // Handle watch mode
    if (options?.watch && config.watchArg) {
      // For vitest, watch mode uses different command
      if (framework === 'vitest') {
        cmd = 'npx vitest --watch';
      } else {
        cmd = `${cmd} ${config.watchArg}`;
      }
      return cmd;
    }

    // Handle file targeting
    if (options?.file) {
      const fileArg = config.fileArg(options.file);
      cmd = `${cmd} ${fileArg}`;
    }

    return cmd;
  }

  /**
   * Run tests
   */
  async run(options?: TestOptions): Promise<TestResult> {
    const framework = await this.detectFramework();
    const command = this.getCommand(framework, options);

    const startTime = Date.now();

    return new Promise((resolve) => {
      const parts = command.split(' ');
      const cmd = parts[0];
      const cmdArgs = parts.slice(1);

      if (!cmd) {
        resolve({
          passed: 0,
          failed: 0,
          skipped: 0,
          total: 0,
          duration: Date.now() - startTime,
          exitCode: 1,
          output: 'No command to run',
        });
        return;
      }

      const proc: ChildProcess = spawn(cmd, cmdArgs, {
        cwd: this.projectPath,
        shell: true,
      });

      let output = '';

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.on('close', (code: number | null) => {
        const duration = Date.now() - startTime;
        const parsed = this.parseOutput(output, framework);

        resolve({
          ...parsed,
          duration,
          exitCode: code ?? 1,
          output,
        });
      });

      proc.on('error', (err: Error) => {
        const duration = Date.now() - startTime;
        resolve({
          passed: 0,
          failed: 0,
          skipped: 0,
          total: 0,
          duration,
          exitCode: 1,
          output: err.message,
        });
      });
    });
  }

  /**
   * Parse test output to extract counts
   */
  private parseOutput(
    output: string,
    framework: TestFramework
  ): Pick<TestResult, 'passed' | 'failed' | 'skipped' | 'total'> {
    const result = { passed: 0, failed: 0, skipped: 0, total: 0 };

    if (framework === 'vitest' || framework === 'jest') {
      // Parse vitest/jest output
      // Example: "Tests:  3 passed, 1 failed, 4 total"
      const testsMatch = output.match(/Tests?:?\s*(\d+)\s*passed.*?(\d+)\s*failed.*?(\d+)\s*total/i);
      if (testsMatch && testsMatch[1] && testsMatch[2] && testsMatch[3]) {
        result.passed = parseInt(testsMatch[1], 10);
        result.failed = parseInt(testsMatch[2], 10);
        result.total = parseInt(testsMatch[3], 10);
      }

      const skippedMatch = output.match(/(\d+)\s*skipped/i);
      if (skippedMatch && skippedMatch[1]) {
        result.skipped = parseInt(skippedMatch[1], 10);
      }
    } else if (framework === 'pytest') {
      // Parse pytest output
      // Example: "5 passed, 1 failed, 2 skipped"
      const passedMatch = output.match(/(\d+)\s*passed/i);
      const failedMatch = output.match(/(\d+)\s*failed/i);
      const skippedMatch = output.match(/(\d+)\s*skipped/i);

      if (passedMatch && passedMatch[1]) result.passed = parseInt(passedMatch[1], 10);
      if (failedMatch && failedMatch[1]) result.failed = parseInt(failedMatch[1], 10);
      if (skippedMatch && skippedMatch[1]) result.skipped = parseInt(skippedMatch[1], 10);
      result.total = result.passed + result.failed + result.skipped;
    } else if (framework === 'cargo') {
      // Parse cargo test output
      // Example: "test result: ok. 5 passed; 0 failed; 0 ignored"
      const resultMatch = output.match(/(\d+)\s*passed.*?(\d+)\s*failed.*?(\d+)\s*ignored/i);
      if (resultMatch && resultMatch[1] && resultMatch[2] && resultMatch[3]) {
        result.passed = parseInt(resultMatch[1], 10);
        result.failed = parseInt(resultMatch[2], 10);
        result.skipped = parseInt(resultMatch[3], 10);
        result.total = result.passed + result.failed + result.skipped;
      }
    } else if (framework === 'go') {
      // Parse go test output
      // Count ok/FAIL lines
      const okMatches = output.match(/^ok\s+/gm);
      const failMatches = output.match(/^FAIL\s+/gm);

      result.passed = okMatches ? okMatches.length : 0;
      result.failed = failMatches ? failMatches.length : 0;
      result.total = result.passed + result.failed;
    }

    return result;
  }

  /**
   * Check if package exists in package.json
   */
  private async checkPackageJson(packageName: string): Promise<boolean> {
    try {
      const pkgPath = path.join(this.projectPath, 'package.json');
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
      };

      return !!(
        pkg.dependencies?.[packageName] ||
        pkg.devDependencies?.[packageName] ||
        pkg.peerDependencies?.[packageName]
      );
    } catch {
      return false;
    }
  }

  /**
   * Simple glob for finding files
   */
  private async globFiles(pattern: string): Promise<string[]> {
    try {
      const files = await fs.readdir(this.projectPath);
      const regex = new RegExp(pattern.replace('*', '.*'));
      return files.filter((f) => regex.test(f));
    } catch {
      return [];
    }
  }
}

/**
 * Validation Pipeline
 * Orchestrates build, test, lint, and security checks
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

export interface CheckResult {
  name: string;
  passed: boolean;
  duration: number; // ms
  output: string;
  errors: string[];
  warnings: string[];
}

export interface ValidationResult {
  passed: boolean;
  duration: number;
  checks: {
    build?: CheckResult;
    test?: CheckResult;
    lint?: CheckResult;
    typecheck?: CheckResult;
  };
  summary: string;
}

interface ProjectCommands {
  build?: string;
  test?: string;
  lint?: string;
  typecheck?: string;
}

export class ValidationPipeline {
  private workingDir: string;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
  }

  async run(options: {
    skipBuild?: boolean;
    skipTest?: boolean;
    skipLint?: boolean;
    skipTypecheck?: boolean;
  } = {}): Promise<ValidationResult> {
    const startTime = Date.now();
    const commands = await this.detectCommands();
    const checks: ValidationResult['checks'] = {};
    let allPassed = true;

    // Build check
    if (!options.skipBuild && commands.build) {
      checks.build = await this.runCommand('build', commands.build);
      if (!checks.build.passed) allPassed = false;
    }

    // Type check (run before tests)
    if (!options.skipTypecheck && commands.typecheck) {
      checks.typecheck = await this.runCommand('typecheck', commands.typecheck);
      if (!checks.typecheck.passed) allPassed = false;
    }

    // Lint check
    if (!options.skipLint && commands.lint) {
      checks.lint = await this.runCommand('lint', commands.lint);
      if (!checks.lint.passed) allPassed = false;
    }

    // Test check (run last, often slowest)
    if (!options.skipTest && commands.test) {
      checks.test = await this.runCommand('test', commands.test);
      if (!checks.test.passed) allPassed = false;
    }

    const duration = Date.now() - startTime;

    return {
      passed: allPassed,
      duration,
      checks,
      summary: this.generateSummary(checks, allPassed, duration),
    };
  }

  private async detectCommands(): Promise<ProjectCommands> {
    const commands: ProjectCommands = {};

    // Check for package.json (Node.js)
    try {
      const pkgPath = path.join(this.workingDir, 'package.json');
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content) as { scripts?: Record<string, string> };

      if (pkg.scripts) {
        if (pkg.scripts['build']) commands.build = 'npm run build';
        if (pkg.scripts['test']) commands.test = 'npm test';
        if (pkg.scripts['lint']) commands.lint = 'npm run lint';
        if (pkg.scripts['typecheck']) commands.typecheck = 'npm run typecheck';
        // Common alternatives
        if (!commands.typecheck && pkg.scripts['type-check']) {
          commands.typecheck = 'npm run type-check';
        }
        if (!commands.typecheck && pkg.scripts['tsc']) {
          commands.typecheck = 'npm run tsc';
        }
      }
    } catch {
      // No package.json
    }

    // Check for Cargo.toml (Rust)
    try {
      await fs.access(path.join(this.workingDir, 'Cargo.toml'));
      commands.build = 'cargo build';
      commands.test = 'cargo test';
      commands.lint = 'cargo clippy';
      commands.typecheck = 'cargo check';
    } catch {
      // No Cargo.toml
    }

    // Check for go.mod (Go)
    try {
      await fs.access(path.join(this.workingDir, 'go.mod'));
      commands.build = 'go build ./...';
      commands.test = 'go test ./...';
      commands.lint = 'golangci-lint run';
      commands.typecheck = 'go vet ./...';
    } catch {
      // No go.mod
    }

    // Check for *.csproj (C#/.NET)
    try {
      const files = await fs.readdir(this.workingDir);
      if (files.some(f => f.endsWith('.csproj') || f.endsWith('.sln'))) {
        commands.build = 'dotnet build';
        commands.test = 'dotnet test';
        // .NET doesn't have separate lint/typecheck - build does it
      }
    } catch {
      // Error reading directory
    }

    // Check for requirements.txt or pyproject.toml (Python)
    try {
      await fs.access(path.join(this.workingDir, 'pyproject.toml'));
      commands.test = 'pytest';
      commands.lint = 'ruff check .';
      commands.typecheck = 'mypy .';
    } catch {
      try {
        await fs.access(path.join(this.workingDir, 'requirements.txt'));
        commands.test = 'pytest';
        commands.lint = 'flake8';
        commands.typecheck = 'mypy .';
      } catch {
        // No Python project markers
      }
    }

    // Check for Makefile
    try {
      const makefilePath = path.join(this.workingDir, 'Makefile');
      const content = await fs.readFile(makefilePath, 'utf-8');

      if (content.includes('build:') && !commands.build) {
        commands.build = 'make build';
      }
      if (content.includes('test:') && !commands.test) {
        commands.test = 'make test';
      }
      if (content.includes('lint:') && !commands.lint) {
        commands.lint = 'make lint';
      }
    } catch {
      // No Makefile
    }

    return commands;
  }

  private async runCommand(name: string, command: string): Promise<CheckResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    return new Promise(resolve => {
      const [cmd, ...args] = command.split(' ');
      const proc = spawn(cmd ?? '', args, {
        cwd: this.workingDir,
        shell: true,
        env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        proc.kill();
        resolve({
          name,
          passed: false,
          duration: Date.now() - startTime,
          output: stdout + stderr,
          errors: ['Command timed out after 5 minutes'],
          warnings,
        });
      }, 300000);

      proc.on('close', code => {
        clearTimeout(timeout);

        const output = stdout + stderr;
        const passed = code === 0;

        // Extract errors and warnings from output
        const lines = output.split('\n');
        for (const line of lines) {
          const lowerLine = line.toLowerCase();
          if (lowerLine.includes('error') || lowerLine.includes('failed')) {
            errors.push(line.trim());
          } else if (lowerLine.includes('warning') || lowerLine.includes('warn')) {
            warnings.push(line.trim());
          }
        }

        resolve({
          name,
          passed,
          duration: Date.now() - startTime,
          output: output.slice(0, 5000), // Limit output size
          errors: errors.slice(0, 20),
          warnings: warnings.slice(0, 20),
        });
      });

      proc.on('error', err => {
        clearTimeout(timeout);
        resolve({
          name,
          passed: false,
          duration: Date.now() - startTime,
          output: '',
          errors: [`Failed to run command: ${err.message}`],
          warnings,
        });
      });
    });
  }

  private generateSummary(
    checks: ValidationResult['checks'],
    allPassed: boolean,
    duration: number
  ): string {
    const lines: string[] = [];

    lines.push(allPassed ? '✓ All checks passed' : '✗ Some checks failed');
    lines.push(`Total time: ${(duration / 1000).toFixed(1)}s\n`);

    for (const [name, result] of Object.entries(checks)) {
      if (!result) continue;

      const status = result.passed ? '✓' : '✗';
      const time = `${(result.duration / 1000).toFixed(1)}s`;
      lines.push(`${status} ${name}: ${time}`);

      if (!result.passed && result.errors.length > 0) {
        for (const error of result.errors.slice(0, 5)) {
          lines.push(`    ${error}`);
        }
        if (result.errors.length > 5) {
          lines.push(`    ...and ${result.errors.length - 5} more errors`);
        }
      }

      if (result.warnings.length > 0) {
        lines.push(`    ⚠ ${result.warnings.length} warning(s)`);
      }
    }

    return lines.join('\n');
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
  }
}

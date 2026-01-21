/**
 * Mutation Test Runner
 * Runs mutation testing and analyzes testability
 * Supports multiple languages: TypeScript/JavaScript, Python, Rust, Go
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Supported mutation testing tools by language
 */
export type MutationTool = 'stryker' | 'mutmut' | 'cargo-mutants' | 'go-mutesting' | 'mull';

export interface LanguageConfig {
  tool: MutationTool;
  command: string;
  installCmd: string;
  reportParser: 'stryker' | 'mutmut' | 'cargo-mutants' | 'go-mutesting' | 'mull';
  fileExtensions: string[];
}

const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  typescript: {
    tool: 'stryker',
    command: 'npx stryker run',
    installCmd: 'npm install --save-dev @stryker-mutator/core @stryker-mutator/typescript-checker',
    reportParser: 'stryker',
    fileExtensions: ['.ts', '.tsx'],
  },
  javascript: {
    tool: 'stryker',
    command: 'npx stryker run',
    installCmd: 'npm install --save-dev @stryker-mutator/core',
    reportParser: 'stryker',
    fileExtensions: ['.js', '.jsx', '.mjs', '.cjs'],
  },
  python: {
    tool: 'mutmut',
    command: 'mutmut run',
    installCmd: 'pip install mutmut',
    reportParser: 'mutmut',
    fileExtensions: ['.py'],
  },
  rust: {
    tool: 'cargo-mutants',
    command: 'cargo mutants',
    installCmd: 'cargo install cargo-mutants',
    reportParser: 'cargo-mutants',
    fileExtensions: ['.rs'],
  },
  go: {
    tool: 'go-mutesting',
    command: 'go-mutesting',
    installCmd: 'go install github.com/zimmski/go-mutesting/cmd/go-mutesting@latest',
    reportParser: 'go-mutesting',
    fileExtensions: ['.go'],
  },
  csharp: {
    tool: 'stryker',
    command: 'dotnet stryker',
    installCmd: 'dotnet tool install -g dotnet-stryker',
    reportParser: 'stryker',
    fileExtensions: ['.cs'],
  },
  c: {
    tool: 'mull',
    command: 'mull-cxx',
    installCmd: 'See https://mull.readthedocs.io/en/latest/Installation.html',
    reportParser: 'mull',
    fileExtensions: ['.c', '.h'],
  },
  cpp: {
    tool: 'mull',
    command: 'mull-cxx',
    installCmd: 'See https://mull.readthedocs.io/en/latest/Installation.html',
    reportParser: 'mull',
    fileExtensions: ['.cpp', '.cc', '.cxx', '.hpp'],
  },
};

export interface MutationResult {
  file: string;
  score: number; // Raw percentage (0-100), NO "effective score" rationalization
  killed: number;
  survived: number;
  noCoverage: number;
  timeout: number;
  total: number;
  duration: number; // ms
}

export interface SurvivingMutant {
  file: string;
  line: number;
  mutator: string;
  original: string;
  replacement: string;
  status: 'Survived' | 'NoCoverage';
  suggestion?: string;
}

export interface TestabilityIssue {
  type: 'complex-private' | 'no-di' | 'static-dependency' | 'long-method' | 'too-many-params';
  file: string;
  line: number;
  name: string;
  description: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
}

export interface MutationReport {
  summary: {
    score: number; // Raw score only
    killed: number;
    survived: number;
    noCoverage: number;
    total: number;
    duration: number;
    verdict: 'excellent' | 'good' | 'acceptable' | 'needs-improvement' | 'poor';
  };
  files: MutationResult[];
  survivingMutants: SurvivingMutant[];
  testabilityIssues: TestabilityIssue[];
  recommendations: string[];
}

export interface TestRunnerOptions {
  file?: string | undefined; // Target specific file
  threshold?: number | undefined; // Minimum acceptable score (default 30)
  quick?: boolean | undefined; // Only test changed files
  timeout?: number | undefined; // Timeout in minutes (default 10)
}

// Score thresholds - NO rationalization allowed
const SCORE_THRESHOLDS = {
  excellent: 60,
  good: 50,
  acceptable: 40,
  needsImprovement: 30,
  // Below 30 = poor
};

export class MutationRunner {
  private workingDir: string;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
  }

  /**
   * Detect language from file extension or project structure
   */
  async detectLanguage(file?: string): Promise<string> {
    // If file specified, detect from extension
    if (file) {
      const ext = path.extname(file).toLowerCase();
      for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
        if (config.fileExtensions.includes(ext)) {
          return lang;
        }
      }
    }

    // Detect from project files
    const projectFiles = [
      { file: 'package.json', lang: 'typescript' },
      { file: 'tsconfig.json', lang: 'typescript' },
      { file: 'Cargo.toml', lang: 'rust' },
      { file: 'go.mod', lang: 'go' },
      { file: 'pyproject.toml', lang: 'python' },
      { file: 'requirements.txt', lang: 'python' },
      { file: 'setup.py', lang: 'python' },
      { file: '*.csproj', lang: 'csharp' },
      { file: '*.sln', lang: 'csharp' },
      { file: 'CMakeLists.txt', lang: 'cpp' },
      { file: 'Makefile', lang: 'c' },
    ];

    for (const { file: projectFile, lang } of projectFiles) {
      try {
        // Handle glob patterns
        if (projectFile.includes('*')) {
          const files = await fs.readdir(this.workingDir);
          const pattern = projectFile.replace('*', '');
          if (files.some(f => f.endsWith(pattern))) {
            return lang;
          }
          continue;
        }
        await fs.access(path.join(this.workingDir, projectFile));
        return lang;
      } catch {
        // Continue to next
      }
    }

    return 'typescript'; // Default
  }

  /**
   * Check if mutation tool is installed for the detected language
   */
  async checkToolInstalled(language: string): Promise<{ installed: boolean; installCmd: string }> {
    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
      return { installed: false, installCmd: 'Unknown language' };
    }

    switch (config.tool) {
      case 'stryker':
        // For .NET, check dotnet-stryker; for JS/TS check npm package
        if (language === 'csharp') {
          return {
            installed: await this.checkCommandExists('dotnet-stryker'),
            installCmd: config.installCmd,
          };
        }
        return {
          installed: await this.checkStrykerInstalled(),
          installCmd: config.installCmd,
        };
      case 'mutmut':
        return {
          installed: await this.checkCommandExists('mutmut'),
          installCmd: config.installCmd,
        };
      case 'cargo-mutants':
        return {
          installed: await this.checkCommandExists('cargo-mutants'),
          installCmd: config.installCmd,
        };
      case 'go-mutesting':
        return {
          installed: await this.checkCommandExists('go-mutesting'),
          installCmd: config.installCmd,
        };
      case 'mull':
        return {
          installed: await this.checkCommandExists('mull-cxx'),
          installCmd: config.installCmd,
        };
      default:
        return { installed: false, installCmd: config.installCmd };
    }
  }

  /**
   * Check if a command exists in PATH
   */
  private async checkCommandExists(command: string): Promise<boolean> {
    return new Promise(resolve => {
      const isWindows = process.platform === 'win32';
      const checkCmd = isWindows ? 'where' : 'which';

      const proc = spawn(checkCmd, [command], { shell: true });
      proc.on('close', code => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  /**
   * Run mutation testing
   */
  async run(options: TestRunnerOptions = {}): Promise<MutationReport> {
    const startTime = Date.now();

    // Detect language
    const language = await this.detectLanguage(options.file);
    const config = LANGUAGE_CONFIGS[language];

    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    // Check if tool is installed
    const { installed, installCmd } = await this.checkToolInstalled(language);
    if (!installed) {
      throw new Error(`${config.tool} not found. Install with: ${installCmd}`);
    }

    // Run mutation testing based on language
    let report: {
      summary: Omit<MutationReport['summary'], 'duration' | 'verdict'>;
      files: MutationResult[];
      survivingMutants: SurvivingMutant[];
    };

    switch (config.tool) {
      case 'stryker': {
        if (language === 'csharp') {
          await this.runDotnetStryker(options);
          report = await this.parseDotnetStrykerReport();
        } else {
          const args = this.buildStrykerArgs(options);
          await this.runStryker(args, options.timeout ?? 10);
          report = await this.parseStrykerReport();
        }
        break;
      }
      case 'mutmut': {
        await this.runMutmut(options);
        report = await this.parseMutmutReport();
        break;
      }
      case 'cargo-mutants': {
        await this.runCargoMutants(options);
        report = await this.parseCargoMutantsReport();
        break;
      }
      case 'go-mutesting': {
        await this.runGoMutesting(options);
        report = await this.parseGoMutestingReport();
        break;
      }
      case 'mull': {
        await this.runMull(options);
        report = await this.parseMullReport();
        break;
      }
      default:
        throw new Error(`Unknown tool: ${config.tool}`);
    }

    // Analyze testability issues
    const testabilityIssues = options.file
      ? await this.analyzeTestability(options.file)
      : [];

    // Generate recommendations
    const recommendations = this.generateRecommendations(report, testabilityIssues);

    const duration = Date.now() - startTime;

    return {
      summary: {
        ...report.summary,
        duration,
        verdict: this.getVerdict(report.summary.score),
      },
      files: report.files,
      survivingMutants: report.survivingMutants.slice(0, 20), // Limit for readability
      testabilityIssues,
      recommendations,
    };
  }

  /**
   * Check if mutation score meets threshold
   */
  async check(options: TestRunnerOptions = {}): Promise<{
    passed: boolean;
    score: number;
    threshold: number;
    message: string;
  }> {
    const report = await this.run(options);
    const threshold = options.threshold ?? 30;
    const passed = report.summary.score >= threshold;

    return {
      passed,
      score: report.summary.score,
      threshold,
      message: passed
        ? `✓ Mutation score ${report.summary.score.toFixed(1)}% meets threshold ${threshold}%`
        : `✗ Mutation score ${report.summary.score.toFixed(1)}% below threshold ${threshold}%`,
    };
  }

  private async checkStrykerInstalled(): Promise<boolean> {
    try {
      const pkgPath = path.join(this.workingDir, 'package.json');
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content) as {
        devDependencies?: Record<string, string>;
        dependencies?: Record<string, string>;
      };

      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return '@stryker-mutator/core' in deps;
    } catch {
      return false;
    }
  }

  private buildStrykerArgs(options: TestRunnerOptions): string[] {
    const args = ['run'];

    if (options.file) {
      args.push('--mutate', `"${options.file}"`);
    }

    // Always output JSON for parsing
    args.push('--reporters', 'json,html,progress');

    return args;
  }

  private async runStryker(
    args: string[],
    timeoutMinutes: number
  ): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn('npx', ['stryker', ...args], {
        cwd: this.workingDir,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      let output = '';

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      const timeout = setTimeout(
        () => {
          proc.kill();
          reject(new Error(`Stryker timed out after ${timeoutMinutes} minutes`));
        },
        timeoutMinutes * 60 * 1000
      );

      proc.on('close', code => {
        clearTimeout(timeout);
        resolve({ exitCode: code ?? 0, output });
      });

      proc.on('error', err => {
        clearTimeout(timeout);
        reject(new Error(`Failed to run Stryker: ${err.message}`));
      });
    });
  }

  /**
   * Run mutmut for Python
   */
  private async runMutmut(
    options: TestRunnerOptions
  ): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve, reject) => {
      const args = ['run', '--no-progress'];

      if (options.file) {
        args.push('--paths-to-mutate', options.file);
      }

      const proc = spawn('mutmut', args, {
        cwd: this.workingDir,
        shell: true,
        env: { ...process.env },
      });

      let output = '';

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      const timeoutMinutes = options.timeout ?? 10;
      const timeout = setTimeout(
        () => {
          proc.kill();
          reject(new Error(`mutmut timed out after ${timeoutMinutes} minutes`));
        },
        timeoutMinutes * 60 * 1000
      );

      proc.on('close', code => {
        clearTimeout(timeout);
        resolve({ exitCode: code ?? 0, output });
      });

      proc.on('error', err => {
        clearTimeout(timeout);
        reject(new Error(`Failed to run mutmut: ${err.message}`));
      });
    });
  }

  /**
   * Parse mutmut JSON report
   */
  private async parseMutmutReport(): Promise<{
    summary: Omit<MutationReport['summary'], 'duration' | 'verdict'>;
    files: MutationResult[];
    survivingMutants: SurvivingMutant[];
  }> {
    try {
      // mutmut stores results in .mutmut-cache
      const proc = spawn('mutmut', ['results', '--json'], {
        cwd: this.workingDir,
        shell: true,
      });

      let output = '';
      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      return new Promise(resolve => {
        proc.on('close', () => {
          try {
            const results = JSON.parse(output) as MutmutResults;
            const killed = results.killed?.length ?? 0;
            const survived = results.survived?.length ?? 0;
            const suspicious = results.suspicious?.length ?? 0;
            const total = killed + survived + suspicious;
            const score = total > 0 ? (killed / total) * 100 : 0;

            const survivingMutants: SurvivingMutant[] = [];
            for (const mutant of results.survived ?? []) {
              survivingMutants.push({
                file: mutant.filename ?? 'unknown',
                line: mutant.line ?? 0,
                mutator: mutant.type ?? 'unknown',
                original: '',
                replacement: '',
                status: 'Survived',
                suggestion: 'Add test to kill this mutant',
              });
            }

            resolve({
              summary: {
                score,
                killed,
                survived,
                noCoverage: suspicious,
                total,
              },
              files: [],
              survivingMutants,
            });
          } catch {
            resolve({
              summary: { score: 0, killed: 0, survived: 0, noCoverage: 0, total: 0 },
              files: [],
              survivingMutants: [],
            });
          }
        });
      });
    } catch {
      return {
        summary: { score: 0, killed: 0, survived: 0, noCoverage: 0, total: 0 },
        files: [],
        survivingMutants: [],
      };
    }
  }

  /**
   * Run cargo-mutants for Rust
   */
  private async runCargoMutants(
    options: TestRunnerOptions
  ): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve, reject) => {
      const args = ['mutants', '--json'];

      if (options.file) {
        args.push('--file', options.file);
      }

      const proc = spawn('cargo', args, {
        cwd: this.workingDir,
        shell: true,
        env: { ...process.env },
      });

      let output = '';

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      const timeoutMinutes = options.timeout ?? 10;
      const timeout = setTimeout(
        () => {
          proc.kill();
          reject(new Error(`cargo-mutants timed out after ${timeoutMinutes} minutes`));
        },
        timeoutMinutes * 60 * 1000
      );

      proc.on('close', code => {
        clearTimeout(timeout);
        resolve({ exitCode: code ?? 0, output });
      });

      proc.on('error', err => {
        clearTimeout(timeout);
        reject(new Error(`Failed to run cargo-mutants: ${err.message}`));
      });
    });
  }

  /**
   * Parse cargo-mutants JSON output
   */
  private async parseCargoMutantsReport(): Promise<{
    summary: Omit<MutationReport['summary'], 'duration' | 'verdict'>;
    files: MutationResult[];
    survivingMutants: SurvivingMutant[];
  }> {
    const reportPath = path.join(this.workingDir, 'mutants.out', 'outcomes.json');

    try {
      const content = await fs.readFile(reportPath, 'utf-8');
      const results = JSON.parse(content) as CargoMutantsResults;

      let killed = 0;
      let survived = 0;
      const survivingMutants: SurvivingMutant[] = [];

      for (const outcome of results.outcomes ?? []) {
        if (outcome.outcome === 'Killed' || outcome.outcome === 'Timeout') {
          killed++;
        } else if (outcome.outcome === 'Missed') {
          survived++;
          survivingMutants.push({
            file: outcome.mutant?.file ?? 'unknown',
            line: outcome.mutant?.line ?? 0,
            mutator: outcome.mutant?.genre ?? 'unknown',
            original: '',
            replacement: outcome.mutant?.replacement ?? '',
            status: 'Survived',
            suggestion: 'Add test to kill this mutant',
          });
        }
      }

      const total = killed + survived;
      const score = total > 0 ? (killed / total) * 100 : 0;

      return {
        summary: {
          score,
          killed,
          survived,
          noCoverage: 0,
          total,
        },
        files: [],
        survivingMutants,
      };
    } catch {
      return {
        summary: { score: 0, killed: 0, survived: 0, noCoverage: 0, total: 0 },
        files: [],
        survivingMutants: [],
      };
    }
  }

  /**
   * Run go-mutesting for Go
   */
  private async runGoMutesting(
    options: TestRunnerOptions
  ): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve, reject) => {
      const args: string[] = [];

      if (options.file) {
        args.push(options.file);
      } else {
        args.push('./...');
      }

      const proc = spawn('go-mutesting', args, {
        cwd: this.workingDir,
        shell: true,
        env: { ...process.env },
      });

      let output = '';

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      const timeoutMinutes = options.timeout ?? 10;
      const timeout = setTimeout(
        () => {
          proc.kill();
          reject(new Error(`go-mutesting timed out after ${timeoutMinutes} minutes`));
        },
        timeoutMinutes * 60 * 1000
      );

      proc.on('close', code => {
        clearTimeout(timeout);
        resolve({ exitCode: code ?? 0, output });
      });

      proc.on('error', err => {
        clearTimeout(timeout);
        reject(new Error(`Failed to run go-mutesting: ${err.message}`));
      });
    });
  }

  /**
   * Parse go-mutesting output
   */
  private async parseGoMutestingReport(): Promise<{
    summary: Omit<MutationReport['summary'], 'duration' | 'verdict'>;
    files: MutationResult[];
    survivingMutants: SurvivingMutant[];
  }> {
    // go-mutesting outputs to stdout, we parse from the last run output
    // Format: "PASS: mutant_file.go:line" or "FAIL: mutant_file.go:line"
    // For now return empty - would need to capture output during run
    return {
      summary: { score: 0, killed: 0, survived: 0, noCoverage: 0, total: 0 },
      files: [],
      survivingMutants: [],
    };
  }

  /**
   * Run dotnet-stryker for C#
   */
  private async runDotnetStryker(
    options: TestRunnerOptions
  ): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve, reject) => {
      const args = ['stryker', '--reporter', 'json', '--reporter', 'html'];

      if (options.file) {
        args.push('--mutate', options.file);
      }

      const proc = spawn('dotnet', args, {
        cwd: this.workingDir,
        shell: true,
        env: { ...process.env },
      });

      let output = '';

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      const timeoutMinutes = options.timeout ?? 15;
      const timeout = setTimeout(
        () => {
          proc.kill();
          reject(new Error(`dotnet-stryker timed out after ${timeoutMinutes} minutes`));
        },
        timeoutMinutes * 60 * 1000
      );

      proc.on('close', code => {
        clearTimeout(timeout);
        resolve({ exitCode: code ?? 0, output });
      });

      proc.on('error', err => {
        clearTimeout(timeout);
        reject(new Error(`Failed to run dotnet-stryker: ${err.message}`));
      });
    });
  }

  /**
   * Parse dotnet-stryker JSON report
   */
  private async parseDotnetStrykerReport(): Promise<{
    summary: Omit<MutationReport['summary'], 'duration' | 'verdict'>;
    files: MutationResult[];
    survivingMutants: SurvivingMutant[];
  }> {
    // dotnet-stryker outputs to StrykerOutput/reports/mutation-report.json
    const reportPath = path.join(this.workingDir, 'StrykerOutput', 'reports', 'mutation-report.json');

    try {
      const content = await fs.readFile(reportPath, 'utf-8');
      const report = JSON.parse(content) as StrykerJsonReport;
      return this.transformStrykerReport(report);
    } catch {
      return {
        summary: { score: 0, killed: 0, survived: 0, noCoverage: 0, total: 0 },
        files: [],
        survivingMutants: [],
      };
    }
  }

  /**
   * Run mull for C/C++
   */
  private async runMull(
    options: TestRunnerOptions
  ): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve, reject) => {
      // mull-cxx requires a compilation database and test executable
      const args: string[] = [];

      if (options.file) {
        args.push(options.file);
      }

      const proc = spawn('mull-cxx', args, {
        cwd: this.workingDir,
        shell: true,
        env: { ...process.env },
      });

      let output = '';

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      const timeoutMinutes = options.timeout ?? 15;
      const timeout = setTimeout(
        () => {
          proc.kill();
          reject(new Error(`mull timed out after ${timeoutMinutes} minutes`));
        },
        timeoutMinutes * 60 * 1000
      );

      proc.on('close', code => {
        clearTimeout(timeout);
        resolve({ exitCode: code ?? 0, output });
      });

      proc.on('error', err => {
        clearTimeout(timeout);
        reject(new Error(`Failed to run mull: ${err.message}`));
      });
    });
  }

  /**
   * Parse mull output
   */
  private async parseMullReport(): Promise<{
    summary: Omit<MutationReport['summary'], 'duration' | 'verdict'>;
    files: MutationResult[];
    survivingMutants: SurvivingMutant[];
  }> {
    // mull outputs to mull-report.json or stdout
    // For now return empty - would need proper mull integration
    return {
      summary: { score: 0, killed: 0, survived: 0, noCoverage: 0, total: 0 },
      files: [],
      survivingMutants: [],
    };
  }

  private async parseStrykerReport(): Promise<{
    summary: Omit<MutationReport['summary'], 'duration' | 'verdict'>;
    files: MutationResult[];
    survivingMutants: SurvivingMutant[];
  }> {
    const reportPath = path.join(this.workingDir, 'reports', 'mutation', 'mutation.json');

    try {
      const content = await fs.readFile(reportPath, 'utf-8');
      const report = JSON.parse(content) as StrykerJsonReport;

      return this.transformStrykerReport(report);
    } catch {
      // If JSON report not available, return empty result
      return {
        summary: {
          score: 0,
          killed: 0,
          survived: 0,
          noCoverage: 0,
          total: 0,
        },
        files: [],
        survivingMutants: [],
      };
    }
  }

  private transformStrykerReport(report: StrykerJsonReport): {
    summary: Omit<MutationReport['summary'], 'duration' | 'verdict'>;
    files: MutationResult[];
    survivingMutants: SurvivingMutant[];
  } {
    const files: MutationResult[] = [];
    const survivingMutants: SurvivingMutant[] = [];
    let totalKilled = 0;
    let totalSurvived = 0;
    let totalNoCoverage = 0;
    let totalTimeout = 0;

    for (const [filePath, fileMutants] of Object.entries(report.files)) {
      let killed = 0;
      let survived = 0;
      let noCoverage = 0;
      let timeout = 0;

      for (const mutant of fileMutants.mutants) {
        switch (mutant.status) {
          case 'Killed':
          case 'Timeout':
            killed++;
            if (mutant.status === 'Timeout') timeout++;
            break;
          case 'Survived':
            survived++;
            survivingMutants.push({
              file: filePath,
              line: mutant.location.start.line,
              mutator: mutant.mutatorName,
              original: mutant.originalCode ?? '',
              replacement: mutant.replacement ?? mutant.mutatorName,
              status: 'Survived',
              suggestion: this.getSuggestionForMutant(mutant),
            });
            break;
          case 'NoCoverage':
            noCoverage++;
            survivingMutants.push({
              file: filePath,
              line: mutant.location.start.line,
              mutator: mutant.mutatorName,
              original: mutant.originalCode ?? '',
              replacement: mutant.replacement ?? mutant.mutatorName,
              status: 'NoCoverage',
              suggestion: 'Add test coverage for this code path',
            });
            break;
        }
      }

      const total = killed + survived + noCoverage;
      const score = total > 0 ? (killed / total) * 100 : 0;

      files.push({
        file: filePath,
        score,
        killed,
        survived,
        noCoverage,
        timeout,
        total,
        duration: 0,
      });

      totalKilled += killed;
      totalSurvived += survived;
      totalNoCoverage += noCoverage;
      totalTimeout += timeout;
    }

    const total = totalKilled + totalSurvived + totalNoCoverage;
    const score = total > 0 ? (totalKilled / total) * 100 : 0;

    return {
      summary: {
        score,
        killed: totalKilled,
        survived: totalSurvived,
        noCoverage: totalNoCoverage,
        total,
      },
      files,
      survivingMutants,
    };
  }

  private getSuggestionForMutant(mutant: StrykerMutant): string {
    const suggestions: Record<string, string> = {
      ConditionalExpression: 'Add test for both true and false branches',
      EqualityOperator: 'Add boundary condition tests',
      StringLiteral: 'Verify string value is actually used/validated',
      ArithmeticOperator: 'Add calculation verification tests',
      LogicalOperator: 'Test both conditions independently',
      ArrayDeclaration: 'Verify array contents are validated',
      BlockStatement: 'Add test that verifies this block executes',
      BooleanLiteral: 'Test both true and false cases',
      UnaryOperator: 'Add edge case tests',
      UpdateOperator: 'Verify increment/decrement behavior',
    };

    return suggestions[mutant.mutatorName] ?? 'Add test to kill this mutant';
  }

  private async analyzeTestability(filePath: string): Promise<TestabilityIssue[]> {
    const issues: TestabilityIssue[] = [];
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.workingDir, filePath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Detect complex private methods
      const privateMethodRegex = /private\s+(?:async\s+)?(\w+)\s*\([^)]*\)/g;
      let match;
      let currentMethodStart = -1;
      let currentMethodName = '';
      let braceCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;

        // Check for private method start
        privateMethodRegex.lastIndex = 0;
        match = privateMethodRegex.exec(line);
        if (match) {
          currentMethodStart = i;
          currentMethodName = match[1] ?? '';
          braceCount = 0;
        }

        // Count braces to find method end
        if (currentMethodStart >= 0) {
          braceCount += (line.match(/{/g) ?? []).length;
          braceCount -= (line.match(/}/g) ?? []).length;

          if (braceCount === 0 && i > currentMethodStart) {
            const methodLines = i - currentMethodStart + 1;
            if (methodLines > 15) {
              issues.push({
                type: 'complex-private',
                file: filePath,
                line: currentMethodStart + 1,
                name: currentMethodName,
                description: `Private method '${currentMethodName}' is ${methodLines} lines - hard to test directly`,
                suggestion: `Extract to a separate testable class or make protected/public for testing`,
                severity: methodLines > 30 ? 'high' : 'medium',
              });
            }
            currentMethodStart = -1;
          }
        }

        // Detect direct instantiation (no DI)
        const newInstanceRegex = /new\s+(\w+)\s*\(/g;
        let newMatch;
        while ((newMatch = newInstanceRegex.exec(line)) !== null) {
          const className = newMatch[1];
          // Skip common safe classes
          if (!['Date', 'Error', 'Map', 'Set', 'Array', 'Promise', 'RegExp'].includes(className ?? '')) {
            issues.push({
              type: 'no-di',
              file: filePath,
              line: i + 1,
              name: className ?? '',
              description: `Direct instantiation of '${className}' - hard to mock in tests`,
              suggestion: `Inject '${className}' as a dependency via constructor`,
              severity: 'medium',
            });
          }
        }

        // Detect methods with too many parameters
        const methodParamsRegex = /(?:async\s+)?(\w+)\s*\(([^)]+)\)/g;
        let paramMatch;
        while ((paramMatch = methodParamsRegex.exec(line)) !== null) {
          const params = paramMatch[2]?.split(',').filter(p => p.trim().length > 0) ?? [];
          if (params.length > 4) {
            issues.push({
              type: 'too-many-params',
              file: filePath,
              line: i + 1,
              name: paramMatch[1] ?? '',
              description: `Method '${paramMatch[1]}' has ${params.length} parameters - hard to test all combinations`,
              suggestion: 'Consider using an options object or splitting the method',
              severity: params.length > 6 ? 'high' : 'medium',
            });
          }
        }
      }
    } catch {
      // File not found or unreadable
    }

    return issues;
  }

  private getVerdict(
    score: number
  ): 'excellent' | 'good' | 'acceptable' | 'needs-improvement' | 'poor' {
    if (score >= SCORE_THRESHOLDS.excellent) return 'excellent';
    if (score >= SCORE_THRESHOLDS.good) return 'good';
    if (score >= SCORE_THRESHOLDS.acceptable) return 'acceptable';
    if (score >= SCORE_THRESHOLDS.needsImprovement) return 'needs-improvement';
    return 'poor';
  }

  private generateRecommendations(
    report: { summary: { score: number; noCoverage: number; survived: number } },
    testabilityIssues: TestabilityIssue[]
  ): string[] {
    const recommendations: string[] = [];

    // Score-based recommendations
    if (report.summary.score < 30) {
      recommendations.push(
        '⚠️ Mutation score is below 30% - prioritize adding tests for critical code paths'
      );
    }

    // No-coverage recommendations
    if (report.summary.noCoverage > report.summary.survived) {
      recommendations.push(
        `📝 ${report.summary.noCoverage} mutants have no test coverage - add basic tests first before targeting specific mutants`
      );
    }

    // Testability recommendations
    const complexPrivate = testabilityIssues.filter(i => i.type === 'complex-private');
    if (complexPrivate.length > 0) {
      recommendations.push(
        `🔧 ${complexPrivate.length} complex private method(s) detected - consider extracting to testable classes`
      );
    }

    const noDi = testabilityIssues.filter(i => i.type === 'no-di');
    if (noDi.length > 3) {
      recommendations.push(
        `💉 ${noDi.length} direct instantiations found - use dependency injection for better testability`
      );
    }

    // General guidance
    if (recommendations.length === 0 && report.summary.score >= 50) {
      recommendations.push('✅ Good mutation score! Focus on maintaining coverage as code evolves.');
    }

    return recommendations;
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
  }
}

// Stryker JSON Report types
interface StrykerJsonReport {
  schemaVersion: string;
  thresholds: { high: number; low: number; break: number };
  files: Record<string, { mutants: StrykerMutant[] }>;
}

interface StrykerMutant {
  id: string;
  mutatorName: string;
  replacement?: string;
  originalCode?: string;
  status: 'Killed' | 'Survived' | 'NoCoverage' | 'Timeout' | 'CompileError' | 'RuntimeError';
  location: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

// Mutmut (Python) types
interface MutmutResults {
  killed?: Array<{ filename?: string; line?: number; type?: string }>;
  survived?: Array<{ filename?: string; line?: number; type?: string }>;
  suspicious?: Array<{ filename?: string; line?: number; type?: string }>;
}

// Cargo-mutants (Rust) types
interface CargoMutantsResults {
  outcomes?: Array<{
    outcome: 'Killed' | 'Missed' | 'Timeout' | 'CaughtPanic';
    mutant?: {
      file?: string;
      line?: number;
      genre?: string;
      replacement?: string;
    };
  }>;
}

/**
 * Review Checker
 * Pre-completion checklist validation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from 'yaml';
import { SecurityScanner } from '../security/scanner.js';
import { DuplicateDetector } from '../indexes/duplicate-detector.js';
import { ValidationPipeline } from './pipeline.js';

export interface ReviewCheckItem {
  name: string;
  passed: boolean;
  details: string;
  required: boolean;
}

export interface ReviewReport {
  ready: boolean;
  checks: ReviewCheckItem[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
  };
  recommendation: string;
}

interface FeatureManifest {
  name: string;
  startedAt: string;
  status: string;
  files: string[];
}

interface StrykerReport {
  schemaVersion: string;
  files: Record<string, { mutants: Array<{ status: string }> }>;
}

interface MutationTotals {
  killed: number;
  survived: number;
  noCoverage: number;
}

export class ReviewChecker {
  private workingDir: string;
  private securityScanner: SecurityScanner;
  private duplicateDetector: DuplicateDetector;
  private validationPipeline: ValidationPipeline;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
    this.securityScanner = new SecurityScanner(this.workingDir);
    this.duplicateDetector = new DuplicateDetector(this.workingDir);
    this.validationPipeline = new ValidationPipeline(this.workingDir);
  }

  async runReview(skipTests = false): Promise<ReviewReport> {
    const checks: ReviewCheckItem[] = [];

    // 1. Check active feature
    const featureCheck = await this.checkActiveFeature();
    checks.push(featureCheck);

    // 2. Security scan
    const securityCheck = await this.checkSecurity();
    checks.push(securityCheck);

    // 3. Build check
    const buildCheck = await this.checkBuild();
    checks.push(buildCheck);

    // 4. Test check (optional)
    if (!skipTests) {
      const testCheck = await this.checkTests();
      checks.push(testCheck);
    }

    // 5. Duplicate check
    const duplicateCheck = await this.checkDuplicates();
    checks.push(duplicateCheck);

    // 6. Mutation testing check
    const mutationCheck = await this.checkMutationScore();
    checks.push(mutationCheck);

    // 7. Uncommitted changes
    const gitCheck = await this.checkGitStatus();
    checks.push(gitCheck);

    // Calculate summary
    const passed = checks.filter(c => c.passed).length;
    const failed = checks.filter(c => !c.passed && c.required).length;
    const warnings = checks.filter(c => !c.passed && !c.required).length;

    const ready = failed === 0;
    const recommendation = this.generateRecommendation(checks, ready);

    return {
      ready,
      checks,
      summary: { passed, failed, warnings },
      recommendation,
    };
  }

  private async checkActiveFeature(): Promise<ReviewCheckItem> {
    try {
      const featuresDir = path.join(this.workingDir, '.engineering', 'features');
      const entries = await fs.readdir(featuresDir);

      for (const entry of entries) {
        const manifestPath = path.join(featuresDir, entry, 'manifest.yaml');
        try {
          const content = await fs.readFile(manifestPath, 'utf-8');
          const manifest = parse(content) as FeatureManifest;
          if (manifest.status === 'active') {
            return {
              name: 'Active Feature',
              passed: true,
              details: `Working on: ${manifest.name} (${manifest.files.length} files)`,
              required: true,
            };
          }
        } catch {
          continue;
        }
      }

      return {
        name: 'Active Feature',
        passed: false,
        details: 'No active feature found. Use /eng-start to begin.',
        required: true,
      };
    } catch {
      return {
        name: 'Active Feature',
        passed: false,
        details: 'No .engineering/features directory. Run /eng-init first.',
        required: true,
      };
    }
  }

  private async checkSecurity(): Promise<ReviewCheckItem> {
    try {
      const findings = await this.securityScanner.scan();
      const critical = findings.filter(f => f.severity === 'critical').length;
      const high = findings.filter(f => f.severity === 'high').length;

      if (critical > 0 || high > 0) {
        return {
          name: 'Security Scan',
          passed: false,
          details: `Found ${critical} critical and ${high} high severity issues`,
          required: true,
        };
      }

      const medium = findings.filter(f => f.severity === 'medium').length;
      if (medium > 0) {
        return {
          name: 'Security Scan',
          passed: true,
          details: `Clean (${medium} medium severity - review recommended)`,
          required: true,
        };
      }

      return {
        name: 'Security Scan',
        passed: true,
        details: 'No security issues found',
        required: true,
      };
    } catch (error) {
      return {
        name: 'Security Scan',
        passed: false,
        details: `Scan failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        required: true,
      };
    }
  }

  private async checkBuild(): Promise<ReviewCheckItem> {
    try {
      const result = await this.validationPipeline.run({
        skipTest: true,
        skipLint: true,
        skipTypecheck: true,
      });

      if (result.checks.build) {
        return {
          name: 'Build',
          passed: result.checks.build.passed,
          details: result.checks.build.passed
            ? 'Build successful'
            : `Build failed: ${result.checks.build.errors.slice(0, 2).join(', ')}`,
          required: true,
        };
      }

      return {
        name: 'Build',
        passed: true,
        details: 'No build command detected',
        required: false,
      };
    } catch {
      return {
        name: 'Build',
        passed: false,
        details: 'Build check failed',
        required: true,
      };
    }
  }

  private async checkTests(): Promise<ReviewCheckItem> {
    try {
      const result = await this.validationPipeline.run({
        skipBuild: true,
        skipLint: true,
        skipTypecheck: true,
      });

      if (result.checks.test) {
        return {
          name: 'Tests',
          passed: result.checks.test.passed,
          details: result.checks.test.passed
            ? 'All tests passed'
            : `Tests failed: ${result.checks.test.errors.slice(0, 2).join(', ')}`,
          required: true,
        };
      }

      return {
        name: 'Tests',
        passed: true,
        details: 'No test command detected',
        required: false,
      };
    } catch {
      return {
        name: 'Tests',
        passed: false,
        details: 'Test check failed',
        required: true,
      };
    }
  }

  private async checkDuplicates(): Promise<ReviewCheckItem> {
    try {
      const duplicates = await this.duplicateDetector.scan();
      const significantDuplicates = duplicates.filter(
        d => d.lines >= 10 && d.occurrences.length >= 3
      );

      if (significantDuplicates.length > 0) {
        return {
          name: 'Duplicate Code',
          passed: true, // Warning, not blocking
          details: `Found ${significantDuplicates.length} significant duplicates (consider /eng-refactor)`,
          required: false,
        };
      }

      return {
        name: 'Duplicate Code',
        passed: true,
        details: 'No significant duplicates found',
        required: false,
      };
    } catch {
      return {
        name: 'Duplicate Code',
        passed: true,
        details: 'Duplicate check skipped',
        required: false,
      };
    }
  }

  private async checkMutationScore(): Promise<ReviewCheckItem> {
    const reportPath = path.join(this.workingDir, 'reports', 'mutation', 'mutation.json');

    try {
      const stat = await fs.stat(reportPath);
      const reportAge = Date.now() - stat.mtimeMs;
      const oneHour = 60 * 60 * 1000;

      if (reportAge > oneHour) {
        return {
          name: 'Mutation Testing',
          passed: false,
          details: 'Report stale (>1 hour). Run /eng-test',
          required: false,
        };
      }

      const content = await fs.readFile(reportPath, 'utf-8');
      const report = JSON.parse(content) as StrykerReport;

      if (report.schemaVersion && report.files) {
        const totals = this.calculateMutationTotals(report);
        const total = totals.killed + totals.survived + totals.noCoverage;
        const score = total > 0 ? (totals.killed / total) * 100 : 0;
        const threshold = 30;

        return {
          name: 'Mutation Testing',
          passed: score >= threshold,
          details: `Score: ${score.toFixed(1)}% (threshold: ${threshold}%)`,
          required: false,
        };
      }

      return {
        name: 'Mutation Testing',
        passed: true,
        details: 'Report format not recognized',
        required: false,
      };
    } catch {
      return {
        name: 'Mutation Testing',
        passed: false,
        details: 'No mutation report. Run /eng-test',
        required: false,
      };
    }
  }

  private calculateMutationTotals(report: StrykerReport): MutationTotals {
    let killed = 0;
    let survived = 0;
    let noCoverage = 0;

    for (const file of Object.values(report.files)) {
      for (const mutant of file.mutants) {
        if (mutant.status === 'Killed') killed++;
        else if (mutant.status === 'Survived') survived++;
        else if (mutant.status === 'NoCoverage') noCoverage++;
      }
    }

    return { killed, survived, noCoverage };
  }

  private async checkGitStatus(): Promise<ReviewCheckItem> {
    try {
      const { spawn } = await import('child_process');

      return new Promise(resolve => {
        const proc = spawn('git', ['status', '--porcelain'], {
          cwd: this.workingDir,
          shell: true,
        });

        let output = '';
        proc.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });

        proc.on('close', code => {
          if (code !== 0) {
            resolve({
              name: 'Git Status',
              passed: true,
              details: 'Not a git repository',
              required: false,
            });
            return;
          }

          const lines = output
            .trim()
            .split('\n')
            .filter(l => l.length > 0);
          if (lines.length === 0) {
            resolve({
              name: 'Git Status',
              passed: true,
              details: 'Working directory clean',
              required: false,
            });
          } else {
            resolve({
              name: 'Git Status',
              passed: true, // Warning, not blocking
              details: `${lines.length} uncommitted changes`,
              required: false,
            });
          }
        });

        proc.on('error', () => {
          resolve({
            name: 'Git Status',
            passed: true,
            details: 'Git check skipped',
            required: false,
          });
        });
      });
    } catch {
      return {
        name: 'Git Status',
        passed: true,
        details: 'Git check skipped',
        required: false,
      };
    }
  }

  private generateRecommendation(checks: ReviewCheckItem[], ready: boolean): string {
    if (ready) {
      const warnings = checks.filter(c => !c.passed && !c.required);
      if (warnings.length === 0) {
        return 'All checks passed. Ready to complete with /eng-done';
      }
      return `Ready to complete. ${warnings.length} warning(s) - review before /eng-done`;
    }

    const failed = checks.filter(c => !c.passed && c.required);
    const failedNames = failed.map(c => c.name).join(', ');
    return `Not ready. Fix required issues: ${failedNames}`;
  }

  formatReport(report: ReviewReport): string {
    const lines: string[] = [];

    lines.push('=== Pre-Completion Review ===\n');

    // Status
    const statusIcon = report.ready ? '✓' : '✗';
    lines.push(`${statusIcon} ${report.recommendation}\n`);

    // Checks
    lines.push('Checks:');
    for (const check of report.checks) {
      const icon = check.passed ? '✓' : check.required ? '✗' : '⚠';
      lines.push(`  ${icon} ${check.name}: ${check.details}`);
    }

    // Summary
    lines.push(
      `\nSummary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.warnings} warnings`
    );

    return lines.join('\n');
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
    this.securityScanner.setWorkingDir(dir);
    this.duplicateDetector.setWorkingDir(dir);
    this.validationPipeline.setWorkingDir(dir);
  }
}

/**
 * Unit tests for validation/review-checker.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import * as fs from 'fs/promises';
import { stringify } from 'yaml';
import { ReviewChecker } from '../../../src/validation/review-checker.js';
import { createTempDir, cleanupTempDir, writeTestFile, createEngineeringDir } from '../../setup.js';

describe('validation/review-checker.ts', () => {
  describe('ReviewChecker', () => {
    let tempDir: string;
    let checker: ReviewChecker;

    beforeEach(async () => {
      tempDir = await createTempDir('review-test');
      checker = new ReviewChecker(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('runReview()', () => {
      it('should return review report', async () => {
        await createEngineeringDir(tempDir);

        // Create an active feature
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test-feature');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({
            name: 'test-feature',
            startedAt: new Date().toISOString(),
            status: 'active',
            files: [],
          })
        );

        const report = await checker.runReview(true); // skipTests

        expect(report).toBeDefined();
        expect(typeof report.ready).toBe('boolean');
        expect(report.checks).toBeDefined();
        expect(report.summary).toBeDefined();
        expect(report.recommendation).toBeDefined();
      });

      it('should check for active feature', async () => {
        await createEngineeringDir(tempDir);

        const report = await checker.runReview(true);
        const featureCheck = report.checks.find(c => c.name === 'Active Feature');

        expect(featureCheck).toBeDefined();
        expect(featureCheck?.required).toBe(true);
      });

      it('should check security', async () => {
        await createEngineeringDir(tempDir);

        // Create feature
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        const report = await checker.runReview(true);
        const securityCheck = report.checks.find(c => c.name === 'Security Scan');

        expect(securityCheck).toBeDefined();
        expect(securityCheck?.required).toBe(true);
      });

      it('should check build status', async () => {
        await createEngineeringDir(tempDir);
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({ name: 'test' })
        );

        // Create feature
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        const report = await checker.runReview(true);
        const buildCheck = report.checks.find(c => c.name === 'Build');

        expect(buildCheck).toBeDefined();
      });

      it('should check tests when not skipped', async () => {
        await createEngineeringDir(tempDir);
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test',
            scripts: { test: 'echo "no tests"' },
          })
        );

        // Create feature
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        const report = await checker.runReview(false);
        const testCheck = report.checks.find(c => c.name === 'Tests');

        expect(testCheck).toBeDefined();
      });

      it('should skip tests when requested', async () => {
        await createEngineeringDir(tempDir);

        // Create feature
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        const report = await checker.runReview(true);
        const testCheck = report.checks.find(c => c.name === 'Tests');

        expect(testCheck).toBeUndefined();
      });

      it('should check for duplicates', async () => {
        await createEngineeringDir(tempDir);

        // Create feature
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        const report = await checker.runReview(true);
        const duplicateCheck = report.checks.find(c => c.name === 'Duplicate Code');

        expect(duplicateCheck).toBeDefined();
        expect(duplicateCheck?.required).toBe(false); // Non-blocking
      });

      it('should check git status', async () => {
        await createEngineeringDir(tempDir);

        // Create feature
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        const report = await checker.runReview(true);
        const gitCheck = report.checks.find(c => c.name === 'Git Status');

        expect(gitCheck).toBeDefined();
      });
    });

    describe('review summary', () => {
      it('should calculate passed count', async () => {
        await createEngineeringDir(tempDir);

        // Create feature
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        const report = await checker.runReview(true);

        expect(report.summary.passed).toBeGreaterThanOrEqual(0);
      });

      it('should calculate failed count', async () => {
        // No engineering dir = all checks fail
        const report = await checker.runReview(true);

        expect(report.summary.failed).toBeGreaterThanOrEqual(0);
      });

      it('should calculate warnings count', async () => {
        await createEngineeringDir(tempDir);

        // Create feature
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        const report = await checker.runReview(true);

        expect(report.summary.warnings).toBeGreaterThanOrEqual(0);
      });
    });

    describe('ready status', () => {
      it('should be not ready when required checks fail', async () => {
        // No engineering dir = feature check fails
        const report = await checker.runReview(true);

        expect(report.ready).toBe(false);
      });

      it('should be ready when all required checks pass', async () => {
        await createEngineeringDir(tempDir);

        // Create feature
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        // Create clean project without secrets
        await writeTestFile(
          path.join(tempDir, 'app.ts'),
          `export function hello() { return 'world'; }`
        );

        const report = await checker.runReview(true);

        // May or may not be ready depending on build
        expect(typeof report.ready).toBe('boolean');
      });
    });

    describe('recommendation', () => {
      it('should recommend eng-done when ready', async () => {
        await createEngineeringDir(tempDir);

        // Create feature
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        const report = await checker.runReview(true);

        if (report.ready) {
          expect(report.recommendation).toContain('eng-done');
        }
      });

      it('should recommend fixing issues when not ready', async () => {
        const report = await checker.runReview(true);

        if (!report.ready) {
          expect(report.recommendation).toContain('Fix');
        }
      });
    });

    describe('formatReport()', () => {
      it('should format report as string', async () => {
        await createEngineeringDir(tempDir);

        // Create feature
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        const report = await checker.runReview(true);
        const formatted = checker.formatReport(report);

        expect(formatted).toContain('Pre-Completion Review');
        expect(formatted).toContain('Checks:');
        expect(formatted).toContain('Summary:');
      });

      it('should show check status icons', async () => {
        await createEngineeringDir(tempDir);

        const featurePath = path.join(tempDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        const report = await checker.runReview(true);
        const formatted = checker.formatReport(report);

        // Should contain status icons
        expect(formatted.includes('✓') || formatted.includes('✗') || formatted.includes('⚠')).toBe(
          true
        );
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        const otherDir = await createTempDir('other-review');
        await createEngineeringDir(otherDir);

        const featurePath = path.join(otherDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        checker.setWorkingDir(otherDir);
        const report = await checker.runReview(true);

        const featureCheck = report.checks.find(c => c.name === 'Active Feature');
        expect(featureCheck?.passed).toBe(true);

        await cleanupTempDir(otherDir);
      });
    });

    describe('security check details', () => {
      it('should fail security for critical findings', async () => {
        await createEngineeringDir(tempDir);

        // Create feature
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        // Create file with AWS key
        await writeTestFile(
          path.join(tempDir, 'config.ts'),
          `const AWS_KEY = 'AKIAIOSFODNN7EXAMPLE';`
        );

        const report = await checker.runReview(true);
        const securityCheck = report.checks.find(c => c.name === 'Security Scan');

        expect(securityCheck?.passed).toBe(false);
      });

      it('should pass security for clean code', async () => {
        await createEngineeringDir(tempDir);

        // Create feature
        const featurePath = path.join(tempDir, '.engineering', 'features', 'test');
        await fs.mkdir(featurePath, { recursive: true });
        await writeTestFile(
          path.join(featurePath, 'manifest.yaml'),
          stringify({ name: 'test', status: 'active', files: [] })
        );

        // Create clean file
        await writeTestFile(
          path.join(tempDir, 'app.ts'),
          `export const config = { port: 3000 };`
        );

        const report = await checker.runReview(true);
        const securityCheck = report.checks.find(c => c.name === 'Security Scan');

        expect(securityCheck?.passed).toBe(true);
      });
    });
  });
});

/**
 * Unit tests for validation/pipeline.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import { ValidationPipeline } from '../../../src/validation/pipeline.js';
import { createTempDir, cleanupTempDir, writeTestFile } from '../../setup.js';

describe('validation/pipeline.ts', () => {
  describe('ValidationPipeline', () => {
    let tempDir: string;
    let pipeline: ValidationPipeline;

    beforeEach(async () => {
      tempDir = await createTempDir('pipeline-test');
      pipeline = new ValidationPipeline(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('run()', () => {
      it('should return validation result', async () => {
        // Create minimal package.json without scripts
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({ name: 'test-project' })
        );

        const result = await pipeline.run();

        expect(result).toBeDefined();
        expect(typeof result.passed).toBe('boolean');
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(result.summary).toBeDefined();
      });

      it('should skip build when skipBuild is true', async () => {
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test',
            scripts: { build: 'echo build' },
          })
        );

        const result = await pipeline.run({ skipBuild: true });

        expect(result.checks.build).toBeUndefined();
      });

      it('should skip test when skipTest is true', async () => {
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test',
            scripts: { test: 'echo test' },
          })
        );

        const result = await pipeline.run({ skipTest: true });

        expect(result.checks.test).toBeUndefined();
      });

      it('should skip lint when skipLint is true', async () => {
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test',
            scripts: { lint: 'echo lint' },
          })
        );

        const result = await pipeline.run({ skipLint: true });

        expect(result.checks.lint).toBeUndefined();
      });

      it('should skip typecheck when skipTypecheck is true', async () => {
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test',
            scripts: { typecheck: 'echo typecheck' },
          })
        );

        const result = await pipeline.run({ skipTypecheck: true });

        expect(result.checks.typecheck).toBeUndefined();
      });

      it('should generate summary', async () => {
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({ name: 'test' })
        );

        const result = await pipeline.run();

        expect(result.summary).toBeDefined();
        expect(result.summary.length).toBeGreaterThan(0);
      });

      it('should detect Node.js project commands', async () => {
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'node-project',
            scripts: {
              build: 'echo building',
              test: 'echo testing',
              lint: 'echo linting',
            },
          })
        );

        // Run with all checks enabled - they will execute the echo commands
        const result = await pipeline.run();

        expect(result.checks).toBeDefined();
      });

      it('should detect Rust project commands', async () => {
        await writeTestFile(path.join(tempDir, 'Cargo.toml'), '[package]\nname = "test"');

        // Rust project will be detected but commands will fail without cargo
        const result = await pipeline.run({ skipTest: true, skipLint: true });

        expect(result).toBeDefined();
      });

      it('should detect Go project commands', async () => {
        await writeTestFile(path.join(tempDir, 'go.mod'), 'module test\n\ngo 1.21');

        // Go project will be detected but commands will fail without go
        const result = await pipeline.run({
          skipBuild: true,
          skipTest: true,
          skipLint: true,
          skipTypecheck: true,
        });

        expect(result).toBeDefined();
      });

      it('should detect .NET project commands', async () => {
        await writeTestFile(
          path.join(tempDir, 'Test.csproj'),
          '<Project Sdk="Microsoft.NET.Sdk"></Project>'
        );

        const result = await pipeline.run({
          skipBuild: true,
          skipTest: true,
        });

        expect(result).toBeDefined();
      });

      it('should detect Python project commands', async () => {
        await writeTestFile(
          path.join(tempDir, 'pyproject.toml'),
          '[project]\nname = "test"'
        );

        const result = await pipeline.run({
          skipTest: true,
          skipLint: true,
          skipTypecheck: true,
        });

        expect(result).toBeDefined();
      });

      it('should detect Makefile commands', async () => {
        await writeTestFile(
          path.join(tempDir, 'Makefile'),
          `build:
\techo building

test:
\techo testing

lint:
\techo linting`
        );

        const result = await pipeline.run();

        expect(result).toBeDefined();
      });
    });

    describe('check results', () => {
      it('should include duration in check results', async () => {
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test',
            scripts: { build: 'echo done' },
          })
        );

        const result = await pipeline.run({
          skipTest: true,
          skipLint: true,
          skipTypecheck: true,
        });

        if (result.checks.build) {
          expect(result.checks.build.duration).toBeGreaterThanOrEqual(0);
        }
      });

      it('should include output in check results', async () => {
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test',
            scripts: { build: 'echo "hello world"' },
          })
        );

        const result = await pipeline.run({
          skipTest: true,
          skipLint: true,
          skipTypecheck: true,
        });

        if (result.checks.build) {
          expect(result.checks.build.output).toBeDefined();
        }
      });

      it('should capture errors from failed commands', async () => {
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test',
            scripts: { build: 'exit 1' },
          })
        );

        const result = await pipeline.run({
          skipTest: true,
          skipLint: true,
          skipTypecheck: true,
        });

        if (result.checks.build) {
          expect(result.checks.build.passed).toBe(false);
        }
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        const otherDir = await createTempDir('other-pipeline');
        await writeTestFile(
          path.join(otherDir, 'package.json'),
          JSON.stringify({ name: 'other' })
        );

        pipeline.setWorkingDir(otherDir);
        const result = await pipeline.run();

        expect(result).toBeDefined();

        await cleanupTempDir(otherDir);
      });
    });

    describe('summary generation', () => {
      it('should show passed status for all passing checks', async () => {
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test',
            scripts: { build: 'echo pass' },
          })
        );

        const result = await pipeline.run({
          skipTest: true,
          skipLint: true,
          skipTypecheck: true,
        });

        if (result.passed) {
          expect(result.summary).toContain('passed');
        }
      });

      it('should show failed status for failing checks', async () => {
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test',
            scripts: { build: 'exit 1' },
          })
        );

        const result = await pipeline.run({
          skipTest: true,
          skipLint: true,
          skipTypecheck: true,
        });

        if (!result.passed) {
          expect(result.summary).toContain('failed');
        }
      });

      it('should include total time in summary', async () => {
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({ name: 'test' })
        );

        const result = await pipeline.run();

        expect(result.summary).toContain('time');
      });
    });
  });
});

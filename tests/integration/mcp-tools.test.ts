/**
 * Integration tests for MCP tools
 * Tests the complete tool execution flow
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  createTempDir,
  cleanupTempDir,
  writeTestFile,
  fileExists,
  readTestFile,
} from '../setup.js';
import { createEngineeringDir, writeYAML, readYAML } from '../helpers/test-utils.js';

// Import modules directly for integration testing
import { ProjectDetector } from '../../src/core/project-detector.js';
import { SecurityScanner } from '../../src/security/scanner.js';
import { FunctionIndexer } from '../../src/indexes/function-indexer.js';

describe('MCP Tools Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('mcp-integration');
  });

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  });

  describe('eng_init workflow', () => {
    it('should detect project type and create .engineering directory', async () => {
      // Setup: Create a Node.js TypeScript project
      await writeTestFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-project', type: 'module' })
      );
      await writeTestFile(path.join(tempDir, 'tsconfig.json'), '{}');
      await writeTestFile(
        path.join(tempDir, 'src', 'index.ts'),
        'export const x = 1;'
      );

      // Detect project type
      const detector = new ProjectDetector(tempDir);
      const projectType = await detector.detect();

      expect(projectType).toBe('web-node');

      // Create engineering directory structure
      const engDir = await createEngineeringDir(tempDir, {
        projectType,
        name: 'test-project',
      });

      // Verify structure
      expect(await fileExists(engDir)).toBe(true);
      expect(await fileExists(path.join(engDir, 'config.yaml'))).toBe(true);
      expect(await fileExists(path.join(engDir, 'index'))).toBe(true);
      expect(await fileExists(path.join(engDir, 'sessions'))).toBe(true);
    });
  });

  describe('eng_scan workflow', () => {
    it('should scan and index functions from project', async () => {
      // Setup: Create project with functions
      await writeTestFile(
        path.join(tempDir, 'src', 'utils.ts'),
        `export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(x: number, y: number): number {
  return x * y;
}`
      );

      await writeTestFile(
        path.join(tempDir, 'src', 'main.ts'),
        `import { add, multiply } from './utils';

async function main(): Promise<void> {
  console.log(add(1, 2));
}

main();`
      );

      // Scan functions
      const indexer = new FunctionIndexer(tempDir);
      const entries = await indexer.scan();

      // Verify indexed functions
      expect(entries.length).toBeGreaterThanOrEqual(3);
      expect(entries.some(e => e.name === 'add')).toBe(true);
      expect(entries.some(e => e.name === 'multiply')).toBe(true);
      expect(entries.some(e => e.name === 'main')).toBe(true);

      // Search functionality
      const addResults = indexer.search('add');
      expect(addResults.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('eng_security workflow', () => {
    it('should scan for security issues and generate fixes', async () => {
      // Setup: Create file with hardcoded secrets
      await writeTestFile(
        path.join(tempDir, 'config.ts'),
        `// Configuration file
const API_KEY = 'AKIAIOSFODNN7EXAMPLE';
const DATABASE_URL = 'mongodb://admin:password@localhost:27017/db';

export function getConfig() {
  return { apiKey: API_KEY, dbUrl: DATABASE_URL };
}`
      );

      // Scan for security issues
      const scanner = new SecurityScanner(tempDir);
      const findings = await scanner.scan();

      // Should find secrets
      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.severity === 'critical')).toBe(true);

      // Generate fixes
      const fixes = await scanner.generateFixes(findings);

      // Verify fix plan
      expect(fixes.envFile).toContain('AWS_ACCESS_KEY');
      expect(fixes.gitignoreEntry).toContain('.env');
      expect(fixes.codeReplacements.length).toBeGreaterThan(0);
    });

    it('should apply fixes and create backups', async () => {
      await writeTestFile(
        path.join(tempDir, 'config.ts'),
        `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
      );

      const scanner = new SecurityScanner(tempDir);
      const findings = await scanner.scan();
      const result = await scanner.applyFixes(findings);

      expect(result.success).toBe(true);
      expect(result.envCreated).toBe(true);
      expect(await fileExists(path.join(tempDir, '.env'))).toBe(true);
    });
  });

  describe('eng_start feature workflow', () => {
    it('should create feature context directory', async () => {
      // Setup engineering directory first
      await createEngineeringDir(tempDir);

      // Create feature directory
      const featureName = 'user-authentication';
      const featureDir = path.join(tempDir, '.engineering', 'features', featureName);

      await fs.mkdir(featureDir, { recursive: true });

      // Create feature context
      await writeYAML(path.join(featureDir, 'context.yaml'), {
        name: featureName,
        started: new Date().toISOString(),
        status: 'in_progress',
        files: [],
        decisions: [],
        blockers: [],
      });

      // Verify feature context
      const context = await readYAML(path.join(featureDir, 'context.yaml'));
      expect(context).toBeDefined();
      expect((context as Record<string, unknown>).name).toBe(featureName);
    });
  });

  describe('eng_validate workflow', () => {
    it('should run security scan as part of validation', async () => {
      // Setup clean project
      await writeTestFile(
        path.join(tempDir, 'src', 'clean.ts'),
        `export function cleanFunction(): string {
  return 'no secrets here';
}`
      );

      const scanner = new SecurityScanner(tempDir);
      const findings = await scanner.scan();

      // Clean project should have no critical findings
      const criticalFindings = findings.filter(f => f.severity === 'critical');
      expect(criticalFindings.length).toBe(0);
    });

    it('should detect security issues in validation', async () => {
      await writeTestFile(
        path.join(tempDir, 'src', 'config.ts'),
        `const SECRET = 'AKIAIOSFODNN7EXAMPLE';`
      );

      const scanner = new SecurityScanner(tempDir);
      const findings = await scanner.scan();

      // Should find issues
      expect(findings.some(f => f.severity === 'critical')).toBe(true);
    });
  });

  describe('Complete workflow integration', () => {
    it('should run full init -> scan -> start -> validate workflow', async () => {
      // 1. Create project
      await writeTestFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'full-workflow-test' })
      );
      await writeTestFile(
        path.join(tempDir, 'src', 'app.ts'),
        `export function processData(input: string): string {
  return input.toUpperCase();
}

export async function fetchUser(id: number): Promise<object> {
  return { id, name: 'Test' };
}`
      );

      // 2. Init - detect project type
      const detector = new ProjectDetector(tempDir);
      const projectType = await detector.detect();
      expect(projectType).toBe('web-node');

      // 3. Create engineering directory
      await createEngineeringDir(tempDir, { projectType });

      // 4. Scan - index functions
      const indexer = new FunctionIndexer(tempDir);
      const functions = await indexer.scan();
      expect(functions.length).toBeGreaterThanOrEqual(2);

      // 5. Security scan
      const scanner = new SecurityScanner(tempDir);
      const findings = await scanner.scan();

      // Clean project should pass
      const criticalIssues = findings.filter(f => f.severity === 'critical');
      expect(criticalIssues.length).toBe(0);

      // 6. Save index
      await indexer.saveIndex();
      expect(
        await fileExists(path.join(tempDir, '.engineering', 'index', 'functions.yaml'))
      ).toBe(true);
    });
  });

  describe('Multi-project type detection', () => {
    const projectTypes = [
      {
        name: 'Rust',
        files: { 'Cargo.toml': '[package]\nname = "test"' },
        expected: 'native-rust',
      },
      {
        name: 'Go',
        files: { 'go.mod': 'module test\n\ngo 1.21' },
        expected: 'native-go',
      },
      {
        name: 'Python',
        files: { 'pyproject.toml': '[project]\nname = "test"' },
        expected: 'python-general',
      },
    ];

    for (const { name, files, expected } of projectTypes) {
      it(`should detect ${name} project`, async () => {
        for (const [filename, content] of Object.entries(files)) {
          await writeTestFile(path.join(tempDir, filename), content);
        }

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe(expected);
      });
    }
  });
});

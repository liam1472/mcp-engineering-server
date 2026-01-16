/**
 * Unit tests for security/scanner.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import { SecurityScanner } from '../../../src/security/scanner.js';
import {
  createTempDir,
  cleanupTempDir,
  writeTestFile,
  copyFixtureToTemp,
  getCodeSamplePath,
  readTestFile,
} from '../../setup.js';

describe('security/scanner.ts', () => {
  describe('SecurityScanner', () => {
    let tempDir: string;
    let scanner: SecurityScanner;

    beforeEach(async () => {
      tempDir = await createTempDir('security-test');
      scanner = new SecurityScanner(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('scan()', () => {
      it('should detect AWS access key', async () => {
        await writeTestFile(
          path.join(tempDir, 'config.ts'),
          `const AWS_KEY = 'AKIAIOSFODNN7EXAMPLE';`
        );

        const findings = await scanner.scan();

        expect(findings.length).toBeGreaterThan(0);
        expect(findings.some(f => f.pattern === 'AWS Access Key')).toBe(true);
      });

      it('should detect OpenAI API key', async () => {
        // Pattern requires exactly 48 chars after sk-
        await writeTestFile(
          path.join(tempDir, 'config.ts'),
          `const OPENAI_KEY = 'sk-abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl';`
        );

        const findings = await scanner.scan();

        expect(findings.length).toBeGreaterThan(0);
        expect(findings.some(f => f.pattern === 'OpenAI API Key')).toBe(true);
      });

      it('should detect MongoDB URI', async () => {
        await writeTestFile(
          path.join(tempDir, 'db.ts'),
          `const MONGO_URI = 'mongodb://user:password@localhost:27017/db';`
        );

        const findings = await scanner.scan();

        expect(findings.some(f => f.pattern === 'MongoDB URI')).toBe(true);
      });

      it('should detect PostgreSQL URI', async () => {
        await writeTestFile(
          path.join(tempDir, 'db.ts'),
          `const PG_URI = 'postgresql://admin:secret@localhost:5432/mydb';`
        );

        const findings = await scanner.scan();

        expect(findings.some(f => f.pattern === 'PostgreSQL URI')).toBe(true);
      });

      it('should detect RSA private key', async () => {
        await writeTestFile(
          path.join(tempDir, 'keys.ts'),
          `const PRIVATE_KEY = \`-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA...
-----END RSA PRIVATE KEY-----\`;`
        );

        const findings = await scanner.scan();

        expect(findings.some(f => f.pattern === 'RSA Private Key')).toBe(true);
      });

      it('should detect hardcoded password', async () => {
        await writeTestFile(
          path.join(tempDir, 'auth.ts'),
          `const password = "supersecretpassword123";`
        );

        const findings = await scanner.scan();

        expect(findings.some(f => f.pattern === 'Hardcoded Password')).toBe(true);
      });

      it('should detect API key in code', async () => {
        await writeTestFile(
          path.join(tempDir, 'api.ts'),
          `const apiKey = "my-api-key-value";`
        );

        const findings = await scanner.scan();

        expect(findings.some(f => f.pattern === 'API Key in Code')).toBe(true);
      });

      it('should not scan ignored extensions', async () => {
        await writeTestFile(
          path.join(tempDir, 'readme.md'),
          `AWS Key: AKIAIOSFODNN7EXAMPLE`
        );

        const findings = await scanner.scan();

        expect(findings.length).toBe(0);
      });

      it('should not scan lock files', async () => {
        await writeTestFile(
          path.join(tempDir, 'package-lock.json'),
          JSON.stringify({ password: 'AKIAIOSFODNN7EXAMPLE' })
        );

        const findings = await scanner.scan();

        expect(findings.length).toBe(0);
      });

      it('should mask secrets in findings', async () => {
        await writeTestFile(
          path.join(tempDir, 'config.ts'),
          `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
        );

        const findings = await scanner.scan();
        const awsFinding = findings.find(f => f.pattern === 'AWS Access Key');

        expect(awsFinding).toBeDefined();
        expect(awsFinding?.match).toContain('...');
        expect(awsFinding?.match).not.toBe('AKIAIOSFODNN7EXAMPLE');
      });

      it('should include file and line info', async () => {
        await writeTestFile(
          path.join(tempDir, 'config.ts'),
          `// Line 1
// Line 2
const KEY = 'AKIAIOSFODNN7EXAMPLE';`
        );

        const findings = await scanner.scan();
        const awsFinding = findings.find(f => f.pattern === 'AWS Access Key');

        expect(awsFinding?.file).toBe('config.ts');
        expect(awsFinding?.line).toBe(3);
      });
    });

    describe('scanFile()', () => {
      it('should scan a single file', async () => {
        await writeTestFile(
          path.join(tempDir, 'test.ts'),
          `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
        );

        const findings = await scanner.scanFile('test.ts');

        expect(findings.length).toBeGreaterThan(0);
      });

      it('should return empty for clean file', async () => {
        await writeTestFile(
          path.join(tempDir, 'clean.ts'),
          `const config = { port: 3000, host: 'localhost' };`
        );

        const findings = await scanner.scanFile('clean.ts');

        expect(findings.length).toBe(0);
      });
    });

    describe('whitelist', () => {
      it('should ignore whitelisted matches', async () => {
        await writeTestFile(
          path.join(tempDir, 'config.ts'),
          `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
        );

        scanner.addToWhitelist('config.ts', 'AKIAIOSFODNN7EXAMPLE');
        const findings = await scanner.scan();

        expect(findings.filter(f => f.pattern === 'AWS Access Key').length).toBe(0);
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        const otherDir = await createTempDir('other-dir');
        await writeTestFile(
          path.join(otherDir, 'config.ts'),
          `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
        );

        scanner.setWorkingDir(otherDir);
        const findings = await scanner.scan();

        expect(findings.length).toBeGreaterThan(0);

        await cleanupTempDir(otherDir);
      });
    });

    describe('generateFixes()', () => {
      it('should generate environment variable names', async () => {
        await writeTestFile(
          path.join(tempDir, 'config.ts'),
          `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
        );

        const findings = await scanner.scan();
        const fix = await scanner.generateFixes(findings);

        expect(fix.envFile).toContain('AWS_ACCESS_KEY');
      });

      it('should generate .env content', async () => {
        await writeTestFile(
          path.join(tempDir, 'config.ts'),
          `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
        );

        const findings = await scanner.scan();
        const fix = await scanner.generateFixes(findings);

        expect(fix.envFile).toContain('# Environment Variables');
        expect(fix.envFile).toContain('=');
      });

      it('should generate .gitignore entry', async () => {
        await writeTestFile(
          path.join(tempDir, 'config.ts'),
          `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
        );

        const findings = await scanner.scan();
        const fix = await scanner.generateFixes(findings);

        expect(fix.gitignoreEntry).toContain('.env');
      });

      it('should generate code replacements for TypeScript', async () => {
        await writeTestFile(
          path.join(tempDir, 'config.ts'),
          `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
        );

        const findings = await scanner.scan();
        const fix = await scanner.generateFixes(findings);

        const tsReplacement = fix.codeReplacements.find(r => r.file === 'config.ts');
        expect(tsReplacement?.replacement).toContain('process.env.');
      });

      it('should generate code replacements for Python', async () => {
        await writeTestFile(
          path.join(tempDir, 'config.py'),
          `KEY = 'AKIAIOSFODNN7EXAMPLE'`
        );

        const findings = await scanner.scan();
        const fix = await scanner.generateFixes(findings);

        const pyReplacement = fix.codeReplacements.find(r => r.file === 'config.py');
        expect(pyReplacement?.replacement).toContain('os.environ.get');
      });
    });

    describe('with fixtures', () => {
      it('should detect multiple secrets in fixture', async () => {
        // Copy the secrets fixture
        const fixturePath = getCodeSamplePath('secrets', 'hardcoded-secrets.ts');
        const content = await readTestFile(fixturePath);
        await writeTestFile(path.join(tempDir, 'secrets.ts'), content);

        const findings = await scanner.scan();

        // Should detect multiple types of secrets
        expect(findings.length).toBeGreaterThan(5);
        expect(findings.some(f => f.severity === 'critical')).toBe(true);
      });
    });

    describe('applyFixes()', () => {
      it('should create .env file', async () => {
        await writeTestFile(
          path.join(tempDir, 'config.ts'),
          `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
        );

        const findings = await scanner.scan();
        const result = await scanner.applyFixes(findings);

        expect(result.envCreated).toBe(true);
      });

      it('should update .gitignore', async () => {
        await writeTestFile(
          path.join(tempDir, 'config.ts'),
          `const KEY = 'AKIAIOSFODNN7EXAMPLE';`
        );

        const findings = await scanner.scan();
        await scanner.applyFixes(findings);

        const gitignore = await readTestFile(path.join(tempDir, '.gitignore'));
        expect(gitignore).toContain('.env');
      });

      it('should require force for many files', async () => {
        // Create 6 files with secrets
        for (let i = 0; i < 6; i++) {
          await writeTestFile(
            path.join(tempDir, `config${i}.ts`),
            `const KEY${i} = 'AKIAIOSFODNN7EXAMPL${i}';`
          );
        }

        const findings = await scanner.scan();
        const result = await scanner.applyFixes(findings);

        expect(result.requiresForce).toBe(true);
        expect(result.success).toBe(false);
      });

      it('should apply with force flag', async () => {
        // Create 6 files with secrets
        for (let i = 0; i < 6; i++) {
          await writeTestFile(
            path.join(tempDir, `config${i}.ts`),
            `const KEY${i} = 'AKIAIOSFODNN7EXAMPL${i}';`
          );
        }

        const findings = await scanner.scan();
        const result = await scanner.applyFixes(findings, { force: true });

        expect(result.requiresForce).toBe(false);
        expect(result.success).toBe(true);
      });

      it('should return success with no findings', async () => {
        const result = await scanner.applyFixes([]);

        expect(result.success).toBe(true);
        expect(result.summary).toContain('No security issues');
      });
    });
  });
});

/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the core behavioral contracts of the MCP Engineering Server.
 * If a test fails, FIX THE SOURCE CODE, not the test.
 *
 * @see UPGRADE.md for the original requirements
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SecurityScanner } from '../../src/security/scanner.js';

/**
 * SPEC: Embedded Profile Security Patterns
 *
 * REQUIREMENT: The security scanner MUST detect and flag dangerous
 * patterns in embedded code according to the embedded manifesto rules.
 */
describe('[SPEC] Embedded Security - Dynamic Memory Detection', () => {
  let tempDir: string;
  let scanner: SecurityScanner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-embedded-'));
    scanner = new SecurityScanner(tempDir);
    await scanner.setProfile('embedded');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: malloc() MUST be flagged as CRITICAL
   * This is a non-negotiable rule for embedded systems.
   */
  it('MUST flag malloc() as CRITICAL severity', async () => {
    await fs.writeFile(
      path.join(tempDir, 'firmware.c'),
      'void* buffer = malloc(1024);',
      'utf-8'
    );

    const findings = await scanner.scan();
    const mallocFinding = findings.find(
      f => f.pattern.includes('Dynamic Memory') && f.match.includes('malloc')
    );

    expect(mallocFinding).toBeDefined();
    expect(mallocFinding!.severity).toBe('critical');
  });

  /**
   * GOLDEN TEST: free() MUST be flagged as CRITICAL
   */
  it('MUST flag free() as CRITICAL severity', async () => {
    await fs.writeFile(path.join(tempDir, 'cleanup.c'), 'free(ptr);', 'utf-8');

    const findings = await scanner.scan();
    const freeFinding = findings.find(
      f => f.pattern.includes('Dynamic Memory') && f.match.includes('free')
    );

    expect(freeFinding).toBeDefined();
    expect(freeFinding!.severity).toBe('critical');
  });

  /**
   * GOLDEN TEST: C++ new operator MUST be flagged as CRITICAL
   */
  it('MUST flag new operator as CRITICAL severity', async () => {
    await fs.writeFile(path.join(tempDir, 'alloc.cpp'), 'int* arr = new int[100];', 'utf-8');

    const findings = await scanner.scan();
    const newFinding = findings.find(
      f => f.pattern.includes('Dynamic Memory') && f.match.includes('new')
    );

    expect(newFinding).toBeDefined();
    expect(newFinding!.severity).toBe('critical');
  });

  /**
   * GOLDEN TEST: C++ delete operator MUST be flagged as CRITICAL
   */
  it('MUST flag delete operator as CRITICAL severity', async () => {
    await fs.writeFile(path.join(tempDir, 'dealloc.cpp'), 'delete[] arr;', 'utf-8');

    const findings = await scanner.scan();
    const deleteFinding = findings.find(
      f => f.pattern.includes('Dynamic Memory') && f.match.includes('delete')
    );

    expect(deleteFinding).toBeDefined();
    expect(deleteFinding!.severity).toBe('critical');
  });
});

describe('[SPEC] Embedded Security - Blocking Delay Detection', () => {
  let tempDir: string;
  let scanner: SecurityScanner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-delay-'));
    scanner = new SecurityScanner(tempDir);
    await scanner.setProfile('embedded');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: delay() with large values MUST be flagged
   */
  it('MUST flag delay(1000) as blocking delay', async () => {
    await fs.writeFile(
      path.join(tempDir, 'blink.ino'),
      `
void loop() {
    digitalWrite(LED, HIGH);
    delay(1000);
    digitalWrite(LED, LOW);
}
`,
      'utf-8'
    );

    const findings = await scanner.scan();
    const delayFinding = findings.find(f => f.pattern.includes('Blocking Delay'));

    expect(delayFinding).toBeDefined();
    // Warning maps to 'high' in SecurityFinding
    expect(['high', 'critical']).toContain(delayFinding!.severity);
  });
});

describe('[SPEC] Web Security - Critical Patterns', () => {
  let tempDir: string;
  let scanner: SecurityScanner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-web-'));
    scanner = new SecurityScanner(tempDir);
    await scanner.setProfile('web');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: eval() MUST be flagged as CRITICAL
   * This is a non-negotiable security rule.
   */
  it('MUST flag eval() as CRITICAL severity', async () => {
    await fs.writeFile(path.join(tempDir, 'unsafe.js'), 'const result = eval(userInput);', 'utf-8');

    const findings = await scanner.scan();
    const evalFinding = findings.find(f => f.pattern.toLowerCase().includes('eval'));

    expect(evalFinding).toBeDefined();
    expect(evalFinding!.severity).toBe('critical');
  });
});

describe('[SPEC] .NET Security - Async Void Detection', () => {
  let tempDir: string;
  let scanner: SecurityScanner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-dotnet-'));
    scanner = new SecurityScanner(tempDir);
    await scanner.setProfile('dotnet');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: async void MUST be flagged as CRITICAL
   * Async void methods cannot be awaited and exceptions crash the app.
   */
  it('MUST flag async void as CRITICAL severity', async () => {
    await fs.writeFile(
      path.join(tempDir, 'Handler.cs'),
      `
public class Handler
{
    public async void ProcessData()
    {
        await Task.Delay(100);
    }
}
`,
      'utf-8'
    );

    const findings = await scanner.scan();
    const asyncVoidFinding = findings.find(f => f.pattern.includes('Async Void'));

    expect(asyncVoidFinding).toBeDefined();
    expect(asyncVoidFinding!.severity).toBe('critical');
  });

  /**
   * GOLDEN TEST: SQL string concatenation MUST be flagged as CRITICAL
   * This is a SQL injection vulnerability.
   */
  it('MUST flag SQL concatenation as CRITICAL severity', async () => {
    await fs.writeFile(
      path.join(tempDir, 'UserRepo.cs'),
      `
public User Find(string name)
{
    var sql = "SELECT * FROM Users WHERE Name = '" + name + "'";
    return Execute(sql);
}
`,
      'utf-8'
    );

    const findings = await scanner.scan();
    const sqlFinding = findings.find(
      f =>
        f.pattern.toLowerCase().includes('sql') ||
        f.pattern.toLowerCase().includes('injection') ||
        f.pattern.toLowerCase().includes('concatenation')
    );

    expect(sqlFinding).toBeDefined();
    expect(sqlFinding!.severity).toBe('critical');
  });
});

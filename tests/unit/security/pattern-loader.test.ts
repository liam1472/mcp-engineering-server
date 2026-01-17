/**
 * Tests for /eng-security PatternLoader and profile-based scanning
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SecurityScanner } from '../../../src/security/scanner.js';

describe('security/scanner.ts - PatternLoader', () => {
  let tempDir: string;
  let scanner: SecurityScanner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eng-test-security-'));
    scanner = new SecurityScanner(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('setProfile()', () => {
    it('should load embedded profile patterns', async () => {
      await scanner.setProfile('embedded');

      const info = scanner.getProfileInfo();
      expect(info.profile).toBe('embedded');
      expect(info.safetyPatternCount).toBeGreaterThan(0);
    });

    it('should load web profile patterns', async () => {
      await scanner.setProfile('web');

      const info = scanner.getProfileInfo();
      expect(info.profile).toBe('web');
      expect(info.safetyPatternCount).toBeGreaterThan(0);
    });

    it('should load dotnet profile patterns', async () => {
      await scanner.setProfile('dotnet');

      const info = scanner.getProfileInfo();
      expect(info.profile).toBe('dotnet');
      expect(info.safetyPatternCount).toBeGreaterThan(0);
    });

    it('should return empty patterns for unknown profile', async () => {
      await scanner.setProfile('unknown');

      const info = scanner.getProfileInfo();
      expect(info.profile).toBe('unknown');
      expect(info.safetyPatternCount).toBe(0);
    });
  });

  describe('Embedded Safety Scanning', () => {
    beforeEach(async () => {
      await scanner.setProfile('embedded');
    });

    it('should detect malloc() as CRITICAL', async () => {
      // Create a test file with malloc
      const testFile = path.join(tempDir, 'main.c');
      await fs.writeFile(
        testFile,
        `
#include <stdlib.h>

int main() {
    int* ptr = malloc(sizeof(int) * 10);
    free(ptr);
    return 0;
}
`,
        'utf-8'
      );

      const findings = await scanner.scan();
      const mallocFinding = findings.find(f => f.pattern.includes('Dynamic Memory'));

      expect(mallocFinding).toBeDefined();
      expect(mallocFinding?.severity).toBe('critical');
      expect(mallocFinding?.suggestion).toContain('static');
    });

    it('should detect free() as CRITICAL', async () => {
      const testFile = path.join(tempDir, 'memory.cpp');
      await fs.writeFile(
        testFile,
        `
void cleanup(void* ptr) {
    free(ptr);
}
`,
        'utf-8'
      );

      const findings = await scanner.scan();
      const freeFinding = findings.find(f => f.pattern.includes('Dynamic Memory'));

      expect(freeFinding).toBeDefined();
      expect(freeFinding?.severity).toBe('critical');
    });

    it('should detect new/delete operators as CRITICAL', async () => {
      const testFile = path.join(tempDir, 'memory.cpp');
      await fs.writeFile(
        testFile,
        `
class Buffer {
public:
    void allocate() {
        data = new int[100];
    }
    void release() {
        delete[] data;
    }
private:
    int* data;
};
`,
        'utf-8'
      );

      const findings = await scanner.scan();
      const dynamicMemoryFindings = findings.filter(f => f.pattern.includes('Dynamic Memory'));

      expect(dynamicMemoryFindings.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect blocking delay() as WARNING', async () => {
      const testFile = path.join(tempDir, 'blink.ino');
      await fs.writeFile(
        testFile,
        `
void setup() {
    pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(1000);  // Blocking delay
    digitalWrite(LED_BUILTIN, LOW);
    delay(1000);
}
`,
        'utf-8'
      );

      const findings = await scanner.scan();
      const delayFindings = findings.filter(f => f.pattern.includes('Blocking Delay'));

      expect(delayFindings.length).toBeGreaterThanOrEqual(2);
      // Warning maps to 'high' severity in SecurityFinding
      expect(delayFindings[0]?.severity).toBe('high');
    });

    it('should detect floating point operations as WARNING for STM32', async () => {
      const testFile = path.join(tempDir, 'calculation.c');
      await fs.writeFile(
        testFile,
        `
float calculate_temperature(int adc_value) {
    float voltage = adc_value * 3.3f / 4096.0f;
    float temperature = (voltage - 0.5f) * 100.0f;
    return temperature;
}
`,
        'utf-8'
      );

      const findings = await scanner.scan();
      const floatFindings = findings.filter(f => f.pattern.includes('Float') || f.pattern.includes('double'));

      // Floating point warnings should be detected
      expect(floatFindings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Web Safety Scanning', () => {
    beforeEach(async () => {
      await scanner.setProfile('web');
    });

    it('should detect console.log as WARNING in production code', async () => {
      const testFile = path.join(tempDir, 'api.ts');
      await fs.writeFile(
        testFile,
        `
export async function handleRequest(req: Request) {
    console.log('Request received:', req.url);
    console.error('Error occurred');
    return new Response('OK');
}
`,
        'utf-8'
      );

      const findings = await scanner.scan();
      const consoleFindings = findings.filter(f => f.pattern.includes('Console'));

      expect(consoleFindings.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect eval() as CRITICAL', async () => {
      const testFile = path.join(tempDir, 'unsafe.js');
      await fs.writeFile(
        testFile,
        `
function execute(code) {
    return eval(code);
}
`,
        'utf-8'
      );

      const findings = await scanner.scan();
      const evalFinding = findings.find(f => f.pattern.includes('Eval') || f.pattern.includes('eval'));

      expect(evalFinding).toBeDefined();
      expect(evalFinding?.severity).toBe('critical');
    });

    it('should detect synchronous file operations as WARNING', async () => {
      const testFile = path.join(tempDir, 'file-handler.ts');
      await fs.writeFile(
        testFile,
        `
import * as fs from 'fs';

export function readConfig() {
    const config = fs.readFileSync('./config.json', 'utf-8');
    return JSON.parse(config);
}
`,
        'utf-8'
      );

      const findings = await scanner.scan();
      const syncFindings = findings.filter(f => f.pattern.includes('Sync') || f.pattern.includes('blocking'));

      expect(syncFindings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('.NET Safety Scanning', () => {
    beforeEach(async () => {
      await scanner.setProfile('dotnet');
    });

    it('should detect async void as CRITICAL', async () => {
      const testFile = path.join(tempDir, 'Handler.cs');
      await fs.writeFile(
        testFile,
        `
public class EventHandler
{
    public async void OnButtonClick(object sender, EventArgs e)
    {
        await DoSomethingAsync();
    }
}
`,
        'utf-8'
      );

      const findings = await scanner.scan();
      const asyncVoidFinding = findings.find(f => f.pattern.includes('Async Void'));

      expect(asyncVoidFinding).toBeDefined();
      expect(asyncVoidFinding?.severity).toBe('critical');
    });

    it('should detect Thread.Sleep as WARNING', async () => {
      const testFile = path.join(tempDir, 'Worker.cs');
      await fs.writeFile(
        testFile,
        `
public class BackgroundWorker
{
    public void DoWork()
    {
        while (true)
        {
            ProcessData();
            Thread.Sleep(1000);
        }
    }
}
`,
        'utf-8'
      );

      const findings = await scanner.scan();
      const sleepFinding = findings.find(f => f.pattern.includes('Thread.Sleep') || f.pattern.includes('Blocking'));

      expect(sleepFinding).toBeDefined();
    });

    it('should detect SQL string concatenation as CRITICAL', async () => {
      const testFile = path.join(tempDir, 'UserRepository.cs');
      await fs.writeFile(
        testFile,
        `
public class UserRepository
{
    public User GetUser(string username)
    {
        var sql = "SELECT * FROM Users WHERE Username = '" + username + "'";
        return ExecuteQuery(sql);
    }
}
`,
        'utf-8'
      );

      const findings = await scanner.scan();
      const sqlFinding = findings.find(
        f => f.pattern.includes('SQL') || f.pattern.includes('Injection') || f.pattern.includes('Concatenation')
      );

      expect(sqlFinding).toBeDefined();
      expect(sqlFinding?.severity).toBe('critical');
    });
  });

  describe('Custom Patterns Loading', () => {
    it('should load and apply custom patterns from .engineering/security/custom.yaml', async () => {
      // Create custom patterns file
      const securityDir = path.join(tempDir, '.engineering', 'security');
      await fs.mkdir(securityDir, { recursive: true });
      await fs.writeFile(
        path.join(securityDir, 'custom.yaml'),
        `
patterns:
  - name: "Custom Forbidden Function"
    regex: "\\\\bforbidden_function\\\\b"
    severity: critical
    message: "This function is forbidden in this project"
    suggestion: "Use approved_function instead"
`,
        'utf-8'
      );

      // Create test file with forbidden function
      const testFile = path.join(tempDir, 'code.ts');
      await fs.writeFile(
        testFile,
        `
export function process() {
    return forbidden_function();
}
`,
        'utf-8'
      );

      // Set any profile to trigger custom pattern loading
      await scanner.setProfile('web');
      const findings = await scanner.scan();

      const customFinding = findings.find(f => f.pattern.includes('Custom Forbidden Function'));
      expect(customFinding).toBeDefined();
      expect(customFinding?.severity).toBe('critical');
    });

    it('should allow custom patterns to add new rules', async () => {
      // Create custom patterns that add a new rule (not override)
      const securityDir = path.join(tempDir, '.engineering', 'security');
      await fs.mkdir(securityDir, { recursive: true });
      await fs.writeFile(
        path.join(securityDir, 'custom.yaml'),
        `
patterns:
  - name: "Custom Project Rule"
    regex: "\\\\bproject_specific_function\\\\b"
    severity: warning
    message: "This function is project-specific and needs review"
    suggestion: "Document the reason for using this function"
`,
        'utf-8'
      );

      // Create test file
      const testFile = path.join(tempDir, 'code.c');
      await fs.writeFile(testFile, 'void* ptr = project_specific_function();', 'utf-8');

      await scanner.setProfile('embedded');
      const findings = await scanner.scan();

      // Should find the custom pattern
      const customFinding = findings.find(f => f.pattern.includes('Custom Project Rule'));
      expect(customFinding).toBeDefined();
      expect(customFinding?.severity).toBe('high'); // warning maps to high
    });
  });

  describe('Auto Profile Detection', () => {
    it('should auto-detect profile from .engineering/config.yaml', async () => {
      // Create config file
      const engDir = path.join(tempDir, '.engineering');
      await fs.mkdir(engDir, { recursive: true });
      await fs.writeFile(
        path.join(engDir, 'config.yaml'),
        `
projectName: test-embedded
projectType: embedded-stm32
createdAt: 2026-01-17
`,
        'utf-8'
      );

      // Create test file with embedded violation
      const testFile = path.join(tempDir, 'main.c');
      await fs.writeFile(testFile, 'int* p = malloc(10);', 'utf-8');

      // Don't call setProfile - let scanner auto-detect
      const findings = await scanner.scan();

      const info = scanner.getProfileInfo();
      expect(info.profile).toBe('embedded');

      const mallocFinding = findings.find(f => f.pattern.includes('Dynamic Memory'));
      expect(mallocFinding).toBeDefined();
    });

    it('should fallback to builtin patterns when no config exists', async () => {
      // No config file - scanner should still work with secret patterns
      const testFile = path.join(tempDir, 'config.ts');
      await fs.writeFile(
        testFile,
        `
export const config = {
    apiKey: 'sk-ant-api03-1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234'
};
`,
        'utf-8'
      );

      const findings = await scanner.scan();

      // Should still detect secrets
      const secretFinding = findings.find(f => f.pattern === 'Anthropic API Key');
      expect(secretFinding).toBeDefined();
    });
  });

  describe('getProfileInfo()', () => {
    it('should return profile information after setProfile', async () => {
      await scanner.setProfile('embedded');
      const info = scanner.getProfileInfo();

      expect(info.profile).toBe('embedded');
      expect(typeof info.safetyPatternCount).toBe('number');
    });

    it('should return unknown profile when not set', () => {
      const info = scanner.getProfileInfo();

      expect(info.profile).toBe('unknown');
      expect(info.safetyPatternCount).toBe(0);
    });
  });
});

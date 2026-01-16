/**
 * Security Scanner
 * Detects secrets, credentials, and sensitive data in code
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import type { SecurityFinding } from '../types/index.js';

interface SecretPattern {
  name: string;
  type: SecurityFinding['type'];
  severity: SecurityFinding['severity'];
  pattern: RegExp;
  suggestion: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  // Cloud Providers
  {
    name: 'AWS Access Key',
    type: 'key',
    severity: 'critical',
    pattern: /AKIA[0-9A-Z]{16}/g,
    suggestion: 'Use environment variables or AWS Secrets Manager',
  },
  {
    name: 'AWS Secret Key',
    type: 'secret',
    severity: 'critical',
    pattern: /[0-9a-zA-Z/+]{40}/g,
    suggestion: 'Use environment variables or AWS Secrets Manager',
  },
  {
    name: 'GCP API Key',
    type: 'key',
    severity: 'critical',
    pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    suggestion: 'Use environment variables or Secret Manager',
  },
  {
    name: 'Azure Storage Key',
    type: 'key',
    severity: 'critical',
    pattern: /[a-zA-Z0-9+/]{86}==/g,
    suggestion: 'Use Azure Key Vault',
  },

  // AI/ML APIs
  {
    name: 'OpenAI API Key',
    type: 'key',
    severity: 'critical',
    pattern: /sk-[a-zA-Z0-9]{48}/g,
    suggestion: 'Use environment variables',
  },
  {
    name: 'Anthropic API Key',
    type: 'key',
    severity: 'critical',
    pattern: /sk-ant-[a-zA-Z0-9\-_]{95}/g,
    suggestion: 'Use environment variables',
  },
  {
    name: 'HuggingFace Token',
    type: 'token',
    severity: 'high',
    pattern: /hf_[a-zA-Z0-9]{34}/g,
    suggestion: 'Use environment variables',
  },

  // Authentication
  {
    name: 'JWT Token',
    type: 'token',
    severity: 'high',
    pattern: /eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/g,
    suggestion: 'JWT tokens should not be hardcoded',
  },
  {
    name: 'Bearer Token',
    type: 'token',
    severity: 'high',
    pattern: /Bearer [a-zA-Z0-9\-_.]+/g,
    suggestion: 'Use secure token storage',
  },

  // Database
  {
    name: 'MongoDB URI',
    type: 'credential',
    severity: 'critical',
    pattern: /mongodb(\+srv)?:\/\/[^\s'"]+/g,
    suggestion: 'Use environment variables for connection strings',
  },
  {
    name: 'PostgreSQL URI',
    type: 'credential',
    severity: 'critical',
    pattern: /postgres(ql)?:\/\/[^\s'"]+/g,
    suggestion: 'Use environment variables for connection strings',
  },
  {
    name: 'MySQL URI',
    type: 'credential',
    severity: 'critical',
    pattern: /mysql:\/\/[^\s'"]+/g,
    suggestion: 'Use environment variables for connection strings',
  },

  // Private Keys
  {
    name: 'RSA Private Key',
    type: 'key',
    severity: 'critical',
    pattern: /-----BEGIN RSA PRIVATE KEY-----/g,
    suggestion: 'Private keys should never be in source code',
  },
  {
    name: 'OpenSSH Private Key',
    type: 'key',
    severity: 'critical',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
    suggestion: 'Private keys should never be in source code',
  },

  // Common Secrets
  {
    name: 'Hardcoded Password',
    type: 'password',
    severity: 'high',
    pattern: /(password|passwd|pwd)\s*[=:]\s*['"][^'"]{8,}['"]/gi,
    suggestion: 'Use environment variables or secret manager',
  },
  {
    name: 'API Key in Code',
    type: 'key',
    severity: 'high',
    pattern: /(api_key|apikey|api-key)\s*[=:]\s*['"][^'"]+['"]/gi,
    suggestion: 'Use environment variables',
  },
  {
    name: 'Secret in Code',
    type: 'secret',
    severity: 'high',
    pattern: /(secret|token)\s*[=:]\s*['"][^'"]{16,}['"]/gi,
    suggestion: 'Use environment variables or secret manager',
  },
];

const IGNORED_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.lock',
  '.sum',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
]);

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', '__pycache__']);

export class SecurityScanner {
  private workingDir: string;
  private whitelist: Set<string> = new Set();

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
  }

  async scan(): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    const files = await glob('**/*', {
      cwd: this.workingDir,
      nodir: true,
      ignore: [...IGNORED_DIRS].map(d => `**/${d}/**`),
    });

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (IGNORED_EXTENSIONS.has(ext)) {
        continue;
      }

      const fileFindings = await this.scanFile(file);
      findings.push(...fileFindings);
    }

    return findings;
  }

  async scanFile(filePath: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const fullPath = path.join(this.workingDir, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      for (const pattern of SECRET_PATTERNS) {
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum];
          if (!line) continue;

          const matches = line.matchAll(pattern.pattern);
          for (const match of matches) {
            const matchStr = match[0];

            // Skip if whitelisted
            if (this.isWhitelisted(filePath, matchStr)) {
              continue;
            }

            findings.push({
              type: pattern.type,
              severity: pattern.severity,
              file: filePath,
              line: lineNum + 1,
              pattern: pattern.name,
              match: this.maskSecret(matchStr),
              suggestion: pattern.suggestion,
            });
          }
        }
      }
    } catch {
      // Skip files that can't be read
    }

    return findings;
  }

  private maskSecret(secret: string): string {
    if (secret.length <= 8) {
      return '***';
    }
    return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
  }

  private isWhitelisted(file: string, match: string): boolean {
    return this.whitelist.has(`${file}:${match}`);
  }

  addToWhitelist(file: string, match: string): void {
    this.whitelist.add(`${file}:${match}`);
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
  }
}

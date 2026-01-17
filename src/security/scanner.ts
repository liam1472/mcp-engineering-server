/**
 * Security Scanner
 * Detects secrets, credentials, and sensitive data in code
 * Supports loading patterns from YAML profiles (embedded, web, dotnet)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { parse } from 'yaml';
import type { SecurityFinding, ProfileType, SecurityPatternProfile } from '../types/index.js';
import {
  filterSafeFiles,
  requiresForceFlag,
  AtomicFileWriter,
  MAX_FILES_WITHOUT_FORCE,
} from '../core/safety.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface SecurityFix {
  envFile: string; // Content for .env file
  envExampleFile: string; // Content for .env.example
  gitignoreEntry: string; // Line to add to .gitignore
  codeReplacements: Array<{
    file: string;
    line: number;
    original: string;
    replacement: string;
    envVar: string;
  }>;
  instructions: string;
}

export interface ApplyFixResult {
  success: boolean;
  filesModified: string[];
  filesBackedUp: string[];
  filesBlocked: Array<{ file: string; reason: string }>;
  envCreated: boolean;
  gitignoreUpdated: boolean;
  requiresForce: boolean;
  errors: string[];
  summary: string;
}

interface SecretPattern {
  name: string;
  type: SecurityFinding['type'];
  severity: SecurityFinding['severity'];
  pattern: RegExp;
  suggestion: string;
}

// Extended pattern for safety rules loaded from YAML
interface SafetyPattern {
  name: string;
  type: 'safety';
  severity: 'critical' | 'warning' | 'info';
  pattern: RegExp;
  message: string;
  suggestion: string | undefined;
  rationale: string | undefined;
  tags: string[] | undefined;
}

// Union type for all patterns
type ScanPattern = SecretPattern | SafetyPattern;

/**
 * PatternLoader: Loads security patterns from YAML files
 * Supports builtin patterns, profile patterns, and custom patterns
 */
class PatternLoader {
  private profilePatterns: Map<string, SafetyPattern[]> = new Map();
  private customPatterns: SafetyPattern[] = [];
  private loaded = false;

  /**
   * Load patterns for a specific profile
   */
  async loadProfile(profile: ProfileType): Promise<SafetyPattern[]> {
    if (profile === 'unknown') return [];

    // Check cache
    if (this.profilePatterns.has(profile)) {
      return this.profilePatterns.get(profile) ?? [];
    }

    const patterns: SafetyPattern[] = [];
    const patternsDir = path.join(__dirname, '..', 'config', 'patterns');
    const patternFile = path.join(patternsDir, `${profile}.yaml`);

    try {
      await fs.access(patternFile);
      const content = await fs.readFile(patternFile, 'utf-8');
      const parsed = parse(content) as SecurityPatternProfile;

      for (const p of parsed.patterns) {
        try {
          patterns.push({
            name: p.name,
            type: 'safety',
            severity: p.severity,
            pattern: new RegExp(p.regex, 'g'),
            message: p.message,
            suggestion: p.suggestion,
            rationale: p.rationale,
            tags: p.tags,
          });
        } catch (regexError) {
          // Skip invalid regex patterns
          console.error(`Invalid regex in ${profile}.yaml for pattern "${p.name}": ${regexError}`);
        }
      }

      this.profilePatterns.set(profile, patterns);
    } catch {
      // Pattern file doesn't exist, return empty array
      this.profilePatterns.set(profile, []);
    }

    return patterns;
  }

  /**
   * Load custom patterns from .engineering/security/custom.yaml
   */
  async loadCustomPatterns(workingDir: string): Promise<SafetyPattern[]> {
    const customFile = path.join(workingDir, '.engineering', 'security', 'custom.yaml');

    try {
      await fs.access(customFile);
      const content = await fs.readFile(customFile, 'utf-8');
      const parsed = parse(content) as { patterns?: SecurityPatternProfile['patterns'] };

      if (!parsed.patterns) return [];

      const patterns: SafetyPattern[] = [];
      for (const p of parsed.patterns) {
        try {
          patterns.push({
            name: p.name,
            type: 'safety',
            severity: p.severity,
            pattern: new RegExp(p.regex, 'g'),
            message: p.message,
            suggestion: p.suggestion,
            rationale: p.rationale,
            tags: p.tags,
          });
        } catch {
          // Skip invalid regex
        }
      }

      this.customPatterns = patterns;
      return patterns;
    } catch {
      // No custom patterns file
      return [];
    }
  }

  /**
   * Get all patterns merged: builtin secrets + profile safety + custom
   */
  async getAllPatterns(
    profile: ProfileType,
    workingDir: string
  ): Promise<{ secrets: SecretPattern[]; safety: SafetyPattern[] }> {
    const profilePatterns = await this.loadProfile(profile);
    const customPatterns = await this.loadCustomPatterns(workingDir);

    // Merge safety patterns (custom can override profile)
    const safetyMap = new Map<string, SafetyPattern>();
    for (const p of profilePatterns) {
      safetyMap.set(p.name, p);
    }
    for (const p of customPatterns) {
      safetyMap.set(p.name, p); // Override with custom
    }

    return {
      secrets: SECRET_PATTERNS,
      safety: Array.from(safetyMap.values()),
    };
  }
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

const IGNORED_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'go.sum',
  'poetry.lock',
  'Gemfile.lock',
  'composer.lock',
]);

// Singleton pattern loader
const patternLoader = new PatternLoader();

export class SecurityScanner {
  private workingDir: string;
  private whitelist: Set<string> = new Set();
  private currentProfile: ProfileType = 'unknown';
  private safetyPatterns: SafetyPattern[] = [];
  private profileLoaded = false;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
  }

  /**
   * Set the profile for safety pattern scanning
   */
  async setProfile(profile: ProfileType): Promise<void> {
    this.currentProfile = profile;
    const { safety } = await patternLoader.getAllPatterns(profile, this.workingDir);
    this.safetyPatterns = safety;
    this.profileLoaded = true;
  }

  /**
   * Auto-detect profile from .engineering/config.yaml
   */
  private async autoDetectProfile(): Promise<void> {
    if (this.profileLoaded) return;

    try {
      const configPath = path.join(this.workingDir, '.engineering', 'config.yaml');
      const content = await fs.readFile(configPath, 'utf-8');
      const config = parse(content) as { projectType?: string };

      if (config.projectType) {
        // Import getProfileType dynamically to avoid circular deps
        const { getProfileType } = await import('../types/index.js');
        const profile = getProfileType(config.projectType as any);
        await this.setProfile(profile);
      }
    } catch {
      // No config file, use builtin patterns only
      this.profileLoaded = true;
    }
  }

  async scan(): Promise<SecurityFinding[]> {
    // Auto-detect profile if not set
    await this.autoDetectProfile();

    const findings: SecurityFinding[] = [];

    const files = await glob('**/*', {
      cwd: this.workingDir,
      nodir: true,
      ignore: [...IGNORED_DIRS].map(d => `**/${d}/**`),
    });

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const basename = path.basename(file);

      if (IGNORED_EXTENSIONS.has(ext) || IGNORED_FILES.has(basename)) {
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

      // Scan for secrets (builtin patterns)
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

      // Scan for safety issues (profile-based patterns)
      for (const pattern of this.safetyPatterns) {
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum];
          if (!line) continue;

          // Reset lastIndex for global regex
          pattern.pattern.lastIndex = 0;

          const matches = line.matchAll(pattern.pattern);
          for (const match of matches) {
            const matchStr = match[0];

            // Skip if whitelisted
            if (this.isWhitelisted(filePath, matchStr)) {
              continue;
            }

            // Map safety severity to SecurityFinding severity
            const severity: SecurityFinding['severity'] =
              pattern.severity === 'critical'
                ? 'critical'
                : pattern.severity === 'warning'
                  ? 'high'
                  : 'medium';

            findings.push({
              type: 'secret', // Use 'secret' type for compatibility (TODO: extend type)
              severity,
              file: filePath,
              line: lineNum + 1,
              pattern: `[SAFETY] ${pattern.name}`,
              match: matchStr.length > 50 ? `${matchStr.slice(0, 50)}...` : matchStr,
              suggestion: pattern.suggestion ?? pattern.message,
            });
          }
        }
      }
    } catch {
      // Skip files that can't be read
    }

    return findings;
  }

  /**
   * Get current profile and loaded safety pattern count
   */
  getProfileInfo(): { profile: ProfileType; safetyPatternCount: number } {
    return {
      profile: this.currentProfile,
      safetyPatternCount: this.safetyPatterns.length,
    };
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

  /**
   * Apply security fixes - actually modify files
   * Creates backups before modifying, with atomic rollback on failure
   *
   * Safety features:
   * - Protected paths (node_modules, .git, own src/) are blocked
   * - Requires --force flag for >5 files
   * - Atomic rollback on any failure
   */
  async applyFixes(
    findings: SecurityFinding[],
    options: { force?: boolean } = {}
  ): Promise<ApplyFixResult> {
    const result: ApplyFixResult = {
      success: false,
      filesModified: [],
      filesBackedUp: [],
      filesBlocked: [],
      envCreated: false,
      gitignoreUpdated: false,
      requiresForce: false,
      errors: [],
      summary: '',
    };

    if (findings.length === 0) {
      result.success = true;
      result.summary = 'No security issues to fix.';
      return result;
    }

    // Initialize atomic file writer for rollback capability
    const atomicWriter = new AtomicFileWriter(this.workingDir);

    try {
      // Generate the fix plan
      const fix = await this.generateFixes(findings);

      // Get unique files from replacements
      const filesToModify = [...new Set(fix.codeReplacements.map(r => r.file))];

      // Safety check: filter out protected paths
      const { safeFiles, blockedFiles } = await filterSafeFiles(filesToModify, this.workingDir);
      result.filesBlocked = blockedFiles;

      if (blockedFiles.length > 0) {
        result.errors.push(
          `Blocked ${blockedFiles.length} file(s) in protected paths:\n` +
            blockedFiles.map(b => `  - ${b.file}: ${b.reason}`).join('\n')
        );
      }

      // Safety check: require --force for large changes
      if (requiresForceFlag(safeFiles.length) && !options.force) {
        result.requiresForce = true;
        result.summary =
          `⚠ Operation requires --force flag.\n` +
          `Would modify ${safeFiles.length} files (limit: ${MAX_FILES_WITHOUT_FORCE}).\n` +
          `Run with --force to proceed, or review files first:\n` +
          safeFiles.map(f => `  - ${f}`).join('\n');
        return result;
      }

      // Filter replacements to only include safe files
      const safeFileSet = new Set(safeFiles);
      const safeReplacements = fix.codeReplacements.filter(r => safeFileSet.has(r.file));

      // 1. Create/update .env file
      const envPath = path.join(this.workingDir, '.env');
      try {
        let existingEnv = '';
        try {
          existingEnv = await fs.readFile(envPath, 'utf-8');
        } catch {
          // File doesn't exist, that's fine
        }

        // Parse existing env vars to avoid duplicates
        const existingVars = new Set<string>();
        for (const line of existingEnv.split('\n')) {
          const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
          if (match?.[1]) {
            existingVars.add(match[1]);
          }
        }

        // Add new vars that don't exist yet
        const newEnvLines: string[] = [];
        for (const line of fix.envFile.split('\n')) {
          const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
          if (match?.[1] && !existingVars.has(match[1])) {
            newEnvLines.push(line);
          }
        }

        if (newEnvLines.length > 0) {
          const newContent = existingEnv
            ? existingEnv.trimEnd() +
              '\n\n# Added by eng_security --fix\n' +
              newEnvLines.join('\n') +
              '\n'
            : fix.envFile + '\n';
          await atomicWriter.write('.env', newContent, !existingEnv);
          result.envCreated = true;
        }
      } catch (error) {
        result.errors.push(`Failed to create .env: ${String(error)}`);
        await atomicWriter.rollback();
        result.summary = `✗ Security fix failed (rolled back): ${String(error)}`;
        return result;
      }

      // 2. Create .env.example if doesn't exist
      const envExamplePath = path.join(this.workingDir, '.env.example');
      try {
        let exists = true;
        try {
          await fs.access(envExamplePath);
        } catch {
          exists = false;
        }

        if (!exists) {
          await atomicWriter.write('.env.example', fix.envExampleFile + '\n', true);
        }
      } catch (error) {
        result.errors.push(`Failed to create .env.example: ${String(error)}`);
        await atomicWriter.rollback();
        result.summary = `✗ Security fix failed (rolled back): ${String(error)}`;
        return result;
      }

      // 3. Update .gitignore
      const gitignorePath = path.join(this.workingDir, '.gitignore');
      try {
        let gitignoreContent = '';
        let gitignoreExists = true;
        try {
          gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
        } catch {
          gitignoreExists = false;
        }

        const entriesToAdd = fix.gitignoreEntry.split('\n').filter(e => e.trim());
        const newEntries: string[] = [];
        for (const entry of entriesToAdd) {
          if (!gitignoreContent.includes(entry)) {
            newEntries.push(entry);
          }
        }

        if (newEntries.length > 0) {
          const newContent = gitignoreContent
            ? gitignoreContent.trimEnd() +
              '\n\n# Secrets (added by eng_security)\n' +
              newEntries.join('\n') +
              '\n'
            : '# Secrets\n' + newEntries.join('\n') + '\n';
          await atomicWriter.write('.gitignore', newContent, !gitignoreExists);
          result.gitignoreUpdated = true;
        }
      } catch (error) {
        result.errors.push(`Failed to update .gitignore: ${String(error)}`);
        await atomicWriter.rollback();
        result.summary = `✗ Security fix failed (rolled back): ${String(error)}`;
        return result;
      }

      // 4. Apply code replacements (with backups) - only safe files
      // Group replacements by file
      const byFile = new Map<string, typeof safeReplacements>();
      for (const r of safeReplacements) {
        const existing = byFile.get(r.file) ?? [];
        existing.push(r);
        byFile.set(r.file, existing);
      }

      for (const [file, replacements] of byFile) {
        const fullPath = path.join(this.workingDir, file);

        try {
          // Read original file
          const content = await fs.readFile(fullPath, 'utf-8');

          // Create backup using atomic writer
          await atomicWriter.backup(file);
          result.filesBackedUp.push(file + '.bak');

          // Apply replacements (sort by line number descending to preserve line numbers)
          const lines = content.split('\n');
          const sortedReplacements = [...replacements].sort((a, b) => b.line - a.line);

          for (const r of sortedReplacements) {
            const lineIndex = r.line - 1;
            if (lineIndex >= 0 && lineIndex < lines.length) {
              const line = lines[lineIndex];
              if (line && line.includes(r.original)) {
                lines[lineIndex] = line.replace(r.original, r.replacement);
              }
            }
          }

          // Write modified file
          await fs.writeFile(fullPath, lines.join('\n'), 'utf-8');
          result.filesModified.push(file);
        } catch (error) {
          result.errors.push(`Failed to modify ${file}: ${String(error)}`);
          // Rollback all changes on any failure
          try {
            await atomicWriter.rollback();
            result.summary = `✗ Security fix failed (rolled back): ${String(error)}`;
          } catch (rollbackError) {
            result.summary = `✗ Security fix failed AND rollback failed: ${String(rollbackError)}`;
          }
          return result;
        }
      }

      // Commit changes (keep backups for user reference)
      atomicWriter.commit();

      // Generate summary
      result.success =
        result.errors.length === 0 ||
        (result.errors.length === result.filesBlocked.length && result.filesModified.length > 0);
      const parts: string[] = [];

      if (result.filesModified.length > 0) {
        parts.push(`Modified ${result.filesModified.length} file(s)`);
      }
      if (result.filesBackedUp.length > 0) {
        parts.push(`Created ${result.filesBackedUp.length} backup(s)`);
      }
      if (result.envCreated) {
        parts.push('Created/updated .env');
      }
      if (result.gitignoreUpdated) {
        parts.push('Updated .gitignore');
      }
      if (result.filesBlocked.length > 0) {
        parts.push(`Blocked ${result.filesBlocked.length} protected file(s)`);
      }

      result.summary = `✓ Security fix applied:\n  ${parts.join('\n  ')}`;

      if (result.filesBackedUp.length > 0) {
        result.summary += `\n\nBackups created:\n  ${result.filesBackedUp.join('\n  ')}`;
      }

      if (result.filesModified.length > 0) {
        result.summary += `\n\nFiles modified:\n  ${result.filesModified.join('\n  ')}`;
      }

      if (result.filesBlocked.length > 0) {
        result.summary += `\n\nBlocked files (protected paths):\n  ${result.filesBlocked.map(b => `${b.file}: ${b.reason}`).join('\n  ')}`;
      }

      result.summary += `\n\nNext steps:\n  1. Review the changes\n  2. Update .env with actual secret values\n  3. Ensure required env imports are added (import dotenv if needed)`;

      return result;
    } catch (error) {
      // Attempt rollback on any unexpected error
      try {
        await atomicWriter.rollback();
        result.errors.push(`Fix failed (rolled back): ${String(error)}`);
        result.summary = `✗ Security fix failed (rolled back): ${String(error)}`;
      } catch (rollbackError) {
        result.errors.push(`Fix failed: ${String(error)}`);
        result.errors.push(`Rollback also failed: ${String(rollbackError)}`);
        result.summary = `✗ Security fix failed AND rollback failed. Manual cleanup may be needed.`;
      }
      return result;
    }
  }

  /**
   * Generate auto-fix preview for security findings (dry-run mode)
   */
  async generateFixes(findings: SecurityFinding[]): Promise<SecurityFix> {
    const envVars = new Map<string, string>(); // envVar -> placeholder
    const codeReplacements: SecurityFix['codeReplacements'] = [];

    // Deduplicate findings by file:line to avoid overlapping replacements
    const seen = new Set<string>();

    for (const finding of findings) {
      const key = `${finding.file}:${finding.line}`;

      // Skip if we already have a replacement for this line
      // (first match wins - typically the more specific pattern)
      if (seen.has(key)) continue;
      seen.add(key);

      // Generate env variable name from pattern name
      const envVar = this.generateEnvVarName(finding.pattern);

      // Get the actual secret (we need to re-read the file to get the full match)
      const secretInfo = await this.getActualSecret(finding);
      if (!secretInfo) continue;

      // Store env var with placeholder
      if (!envVars.has(envVar)) {
        envVars.set(envVar, this.generatePlaceholder(finding.pattern));
      }

      // Use the quoted string if available, otherwise fall back to raw secret
      const original = secretInfo.quoted ?? secretInfo.raw;

      // Generate code replacement
      const replacement = this.generateCodeReplacement(finding, envVar);
      if (replacement) {
        codeReplacements.push({
          file: finding.file,
          line: finding.line,
          original: original,
          replacement: replacement,
          envVar: envVar,
        });
      }
    }

    // Generate .env content
    const envLines: string[] = ['# Environment Variables', '# Generated by eng_security --fix', ''];
    for (const [key, value] of envVars) {
      envLines.push(`${key}=${value}`);
    }
    const envFile = envLines.join('\n');

    // Generate .env.example content (no actual values)
    const exampleLines: string[] = [
      '# Environment Variables Template',
      '# Copy to .env and fill in values',
      '',
    ];
    for (const key of envVars.keys()) {
      exampleLines.push(`${key}=`);
    }
    const envExampleFile = exampleLines.join('\n');

    // Generate instructions
    const instructions = this.generateInstructions(findings, codeReplacements, envVars);

    return {
      envFile,
      envExampleFile,
      gitignoreEntry: '.env\n.env.local\n.env.*.local',
      codeReplacements,
      instructions,
    };
  }

  private generateEnvVarName(patternName: string): string {
    // Convert pattern name to ENV_VAR format
    // "AWS Access Key" -> "AWS_ACCESS_KEY"
    // "OpenAI API Key" -> "OPENAI_API_KEY"
    return patternName
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private generatePlaceholder(patternName: string): string {
    // Generate a placeholder based on the type
    const lower = patternName.toLowerCase();
    if (lower.includes('key')) return 'your-api-key-here';
    if (lower.includes('token')) return 'your-token-here';
    if (lower.includes('password')) return 'your-password-here';
    if (lower.includes('uri') || lower.includes('url')) return 'your-connection-string-here';
    if (lower.includes('secret')) return 'your-secret-here';
    return 'your-value-here';
  }

  private async getActualSecret(
    finding: SecurityFinding
  ): Promise<{ raw: string; quoted: string | null } | null> {
    try {
      const fullPath = path.join(this.workingDir, finding.file);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      const line = lines[finding.line - 1];
      if (!line) return null;

      // Find the pattern that matches
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.name === finding.pattern) {
          const matches = line.matchAll(pattern.pattern);
          for (const match of matches) {
            const rawSecret = match[0];
            const matchIndex = match.index ?? 0;

            // Try to find the full quoted string containing this secret
            // Look backwards for opening quote, forwards for closing quote
            let quoted: string | null = null;

            // Find all quoted strings in the line
            const quotedStrings = line.matchAll(/(['"`])([^'"`]*)\1/g);
            for (const qs of quotedStrings) {
              const fullMatch = qs[0];
              const qsIndex = qs.index ?? 0;
              // Check if our secret is contained within this quoted string
              if (
                qsIndex <= matchIndex &&
                qsIndex + fullMatch.length >= matchIndex + rawSecret.length
              ) {
                quoted = fullMatch;
                break;
              }
            }

            return { raw: rawSecret, quoted };
          }
        }
      }
    } catch {
      // Skip
    }
    return null;
  }

  private generateCodeReplacement(finding: SecurityFinding, envVar: string): string | null {
    const ext = path.extname(finding.file).toLowerCase();

    // Different syntax based on language
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      return `process.env.${envVar}`;
    } else if (ext === '.py') {
      return `os.environ.get('${envVar}')`;
    } else if (ext === '.go') {
      return `os.Getenv("${envVar}")`;
    } else if (ext === '.cs') {
      return `Environment.GetEnvironmentVariable("${envVar}")`;
    } else if (ext === '.rs') {
      return `std::env::var("${envVar}").unwrap()`;
    } else if (['.c', '.cpp', '.h', '.hpp'].includes(ext)) {
      return `getenv("${envVar}")`;
    } else if (ext === '.rb') {
      return `ENV['${envVar}']`;
    } else if (ext === '.php') {
      return `$_ENV['${envVar}']`;
    } else if (ext === '.java') {
      return `System.getenv("${envVar}")`;
    }

    // Default fallback
    return `process.env.${envVar}`;
  }

  private generateInstructions(
    findings: SecurityFinding[],
    replacements: SecurityFix['codeReplacements'],
    envVars: Map<string, string>
  ): string {
    const lines: string[] = [];

    lines.push('=== Security Auto-Fix Instructions ===\n');

    // Step 1: Create .env file
    lines.push('1. Create .env file with the following content:');
    lines.push('');
    for (const [key, placeholder] of envVars) {
      lines.push(`   ${key}=${placeholder}`);
    }
    lines.push('');

    // Step 2: Update .gitignore
    lines.push('2. Add to .gitignore (if not already present):');
    lines.push('   .env');
    lines.push('   .env.local');
    lines.push('   .env.*.local');
    lines.push('');

    // Step 3: Code replacements
    if (replacements.length > 0) {
      lines.push('3. Replace hardcoded secrets in code:');
      lines.push('');

      // Group by file
      const byFile = new Map<string, typeof replacements>();
      for (const r of replacements) {
        const existing = byFile.get(r.file) ?? [];
        existing.push(r);
        byFile.set(r.file, existing);
      }

      for (const [file, fileReplacements] of byFile) {
        lines.push(`   ${file}:`);
        for (const r of fileReplacements) {
          const masked =
            r.original.length > 20
              ? `${r.original.slice(0, 10)}...${r.original.slice(-10)}`
              : r.original;
          lines.push(`     Line ${r.line}: "${masked}" → ${r.replacement}`);
        }
        lines.push('');
      }
    }

    // Step 4: Additional imports if needed
    const hasNonJsFiles = replacements.some(r => {
      const ext = path.extname(r.file).toLowerCase();
      return !['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext);
    });

    if (hasNonJsFiles) {
      lines.push('4. Add necessary imports for environment variable access:');
      lines.push('   Python: import os');
      lines.push('   Go: import "os"');
      lines.push('   C#: using System;');
      lines.push('');
    }

    lines.push(
      `\nTotal: ${findings.length} secret(s) to fix in ${replacements.length} location(s)`
    );

    return lines.join('\n');
  }
}

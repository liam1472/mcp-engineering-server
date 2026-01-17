/**
 * SafetyPatternMatcher - Pure pattern matching logic
 *
 * Responsibilities:
 * - Load safety patterns from YAML files
 * - Match patterns against code files
 * - Return findings without side effects
 *
 * This class is designed to be easily testable:
 * - No file I/O in matching logic
 * - No state mutations
 * - Pure functions for pattern matching
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';
import type { ProfileType, SecurityPatternProfile } from '../../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Internal SafetyPattern type with compiled RegExp
export interface SafetyPattern {
  name: string;
  type: 'safety';
  severity: 'critical' | 'warning' | 'info';
  pattern: RegExp;
  message: string;
  suggestion: string | undefined;
  rationale: string | undefined;
  tags: string[] | undefined;
}

export interface SecurityFinding {
  type: 'secret' | 'credential' | 'key' | 'token' | 'password' | 'pii';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line: number;
  pattern: string;
  match: string;
  suggestion: string;
}

export class SafetyPatternMatcher {
  private profilePatterns: Map<string, SafetyPattern[]> = new Map();
  private customPatterns: SafetyPattern[] = [];
  private whitelist: Set<string> = new Set();

  /**
   * Load patterns for a specific profile
   * @param profile - The profile type to load patterns for
   */
  async loadPatterns(profile: ProfileType): Promise<SafetyPattern[]> {
    if (profile === 'unknown') return [];

    // Check cache
    if (this.profilePatterns.has(profile)) {
      return this.profilePatterns.get(profile) ?? [];
    }

    const patterns: SafetyPattern[] = [];
    const patternsDir = path.join(__dirname, '..', '..', 'config', 'patterns');
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
   * @param workingDir - Working directory containing .engineering/
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
   * Match patterns against file content
   * @param content - File content to scan
   * @param patterns - Patterns to match against
   * @param filePath - Path to the file being scanned
   * @returns Array of findings
   */
  matchPatterns(
    content: string,
    patterns: SafetyPattern[],
    filePath: string
  ): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const lines = content.split('\n');

    // Scan for safety issues (profile-based patterns)
    for (const pattern of patterns) {
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

    return findings;
  }

  /**
   * Check if a match should be whitelisted
   * @param filePath - Path to file
   * @param match - The matched string
   */
  isWhitelisted(filePath: string, match: string): boolean {
    return this.whitelist.has(`${filePath}:${match}`);
  }

  /**
   * Add a file:match combination to the whitelist
   * @param filePath - Path to file
   * @param match - The matched string to whitelist
   */
  addToWhitelist(filePath: string, match: string): void {
    this.whitelist.add(`${filePath}:${match}`);
  }

  /**
   * Get cached patterns for a profile (for testing)
   */
  getCachedPatterns(profile: ProfileType): SafetyPattern[] | undefined {
    return this.profilePatterns.get(profile);
  }

  /**
   * Clear all cached patterns (for testing)
   */
  clearCache(): void {
    this.profilePatterns.clear();
    this.customPatterns = [];
    this.whitelist.clear();
  }
}

/**
 * Refactor Analyzer
 * Analyzes code for refactoring opportunities using duplicate detection
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { DuplicateDetector } from './duplicate-detector.js';
import type { DuplicateBlock } from '../types/index.js';
import {
  filterSafeFiles,
  requiresForceFlag,
  AtomicFileWriter,
  MAX_FILES_WITHOUT_FORCE,
} from '../core/safety.js';

export interface RefactorSuggestion {
  type: 'extract-function' | 'extract-constant' | 'reduce-complexity' | 'remove-duplicate';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  files: string[];
  lines?: number;
  estimatedImpact: string;
  fix?: RefactorFix;
}

export interface RefactorFix {
  id: string;
  type: 'extract-function' | 'extract-constant';
  newCode: string;
  replacements: Array<{
    file: string;
    startLine: number;
    endLine: number;
    oldCode: string;
    newCode: string;
  }>;
  instructions: string;
}

export interface RefactorReport {
  duplicates: DuplicateBlock[];
  suggestions: RefactorSuggestion[];
  stats: {
    filesScanned: number;
    duplicateBlocks: number;
    totalDuplicateLines: number;
    magicNumbers: number;
    longFunctions: number;
  };
  summary: string;
}

export interface LearnedRule {
  rule: string;
  source: string;
  type: 'anti-pattern' | 'best-practice';
  addedAt: string;
}

export interface ApplyRefactorResult {
  success: boolean;
  filesModified: string[];
  filesBackedUp: string[];
  filesBlocked: Array<{ file: string; reason: string }>;
  constantsAdded: number;
  duplicatesFixed: number;
  requiresForce: boolean;
  errors: string[];
  manualInstructions: string[];
  summary: string;
}

export interface GarbageResult {
  files: string[];
  totalSize: number;
  summary: string;
}

export interface CleanResult {
  found: string[];
  deleted: string[];
  wouldDelete: string[];
  errors: string[];
  summary: string;
}

interface MagicNumber {
  file: string;
  line: number;
  value: string;
  context: string;
}

interface LongFunction {
  file: string;
  name: string;
  startLine: number;
  lines: number;
}

const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.cs', '.go', '.rs', '.c', '.cpp'];
const MAGIC_NUMBER_PATTERN = /(?<![a-zA-Z_])(\d{2,}|0x[0-9a-fA-F]{3,})(?![a-zA-Z_\d])/g;
const ALLOWED_NUMBERS = new Set([
  '0',
  '1',
  '2',
  '10',
  '100',
  '1000',
  '60',
  '24',
  '365',
  '1024',
  '2048',
  '4096',
]);
const LONG_FUNCTION_THRESHOLD = 50;

// Garbage file patterns (AI debug scripts, temp files, etc.)
const GARBAGE_PATTERNS = [
  'analyze-*.cjs',
  'debug-*.cjs',
  '*.log',
  '*.tmp',
  'PHASE-*.md',
  '*-ANALYSIS.md',
  'mutation-*.txt',
  'nul',
];

// Patterns that should NOT be extracted as functions
const NON_EXTRACTABLE_PATTERNS = [
  /^#!\//, // Shebang lines
  /^import\s/, // ES imports
  /^export\s/, // ES exports
  /^from\s+\S+\s+import/, // Python imports
  /^require\s*\(/, // CommonJS require
  /^using\s/, // C# using
  /^#include/, // C/C++ includes
  /^package\s/, // Go/Java package
  /^\s*\/\*\*/, // JSDoc/block comment start
  /^\s*\*/, // Comment continuation
  /^\s*\/\//, // Line comments
  /^\s*#(?!!)/, // Python/shell comments (not shebang)
  /^type\s+\w+\s*=/, // TypeScript type aliases
  /^interface\s/, // TypeScript interfaces
  /^declare\s/, // TypeScript declarations
  /^namespace\s/, // Namespaces
  /^module\s/, // Module declarations
];

export class RefactorAnalyzer {
  private workingDir: string;
  private duplicateDetector: DuplicateDetector;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
    this.duplicateDetector = new DuplicateDetector(this.workingDir);
  }

  /**
   * Check if code block should be extracted as a function
   * Returns false for imports, comments, type definitions, etc.
   */
  private shouldExtract(code: string): boolean {
    const lines = code
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    if (lines.length === 0) return false;

    // Check if ALL lines are non-extractable (imports, comments, etc.)
    const nonExtractableLines = lines.filter(line =>
      NON_EXTRACTABLE_PATTERNS.some(pattern => pattern.test(line))
    );

    // If more than 70% of lines are non-extractable, skip this block
    if (nonExtractableLines.length / lines.length > 0.7) {
      return false;
    }

    // Check first line specifically - if it starts with import/export/shebang, skip
    const firstLine = lines[0] ?? '';
    if (/^(import|export|#!|require|using|#include|package|from\s+\S+\s+import)/.test(firstLine)) {
      return false;
    }

    return true;
  }

  async analyze(options: { generateFixes?: boolean } = {}): Promise<RefactorReport> {
    // Run duplicate detection
    const allDuplicates = await this.duplicateDetector.scan();

    // Filter out non-extractable duplicates (imports, comments, etc.)
    const duplicates = allDuplicates.filter(dup => this.shouldExtract(dup.preview));

    // Find magic numbers
    const magicNumbers = await this.findMagicNumbers();

    // Find long functions
    const longFunctions = await this.findLongFunctions();

    // Generate suggestions
    let suggestions = this.generateSuggestions(duplicates, magicNumbers, longFunctions);

    // Generate fixes if requested
    if (options.generateFixes) {
      suggestions = await this.addFixes(suggestions, duplicates, magicNumbers);
    }

    // Calculate stats
    const files = await glob(
      FILE_EXTENSIONS.map(ext => `**/*${ext}`),
      {
        cwd: this.workingDir,
        nodir: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
      }
    );

    const totalDuplicateLines = duplicates.reduce(
      (sum, d) => sum + d.lines * d.occurrences.length,
      0
    );

    const stats = {
      filesScanned: files.length,
      duplicateBlocks: duplicates.length,
      totalDuplicateLines,
      magicNumbers: magicNumbers.length,
      longFunctions: longFunctions.length,
    };

    return {
      duplicates,
      suggestions,
      stats,
      summary: this.generateSummary(stats, suggestions),
    };
  }

  private async findMagicNumbers(): Promise<MagicNumber[]> {
    const magicNumbers: MagicNumber[] = [];
    const files = await glob(
      FILE_EXTENSIONS.map(ext => `**/*${ext}`),
      {
        cwd: this.workingDir,
        nodir: true,
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
          '**/*.test.*',
          '**/*.spec.*',
        ],
      }
    );

    for (const file of files.slice(0, 100)) {
      // Limit for performance
      try {
        const fullPath = path.join(this.workingDir, file);
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;

          // Skip comments and imports
          const trimmedLine = line.trim();
          if (
            trimmedLine.startsWith('//') ||
            trimmedLine.startsWith('#') ||
            trimmedLine.startsWith('import') ||
            trimmedLine.startsWith('const ')
          )
            continue;

          let match;
          while ((match = MAGIC_NUMBER_PATTERN.exec(line)) !== null) {
            const value = match[1];
            if (value && !ALLOWED_NUMBERS.has(value)) {
              magicNumbers.push({
                file,
                line: i + 1,
                value,
                context: trimmedLine.slice(0, 80),
              });
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return magicNumbers.slice(0, 50); // Limit results
  }

  private async findLongFunctions(): Promise<LongFunction[]> {
    const longFunctions: LongFunction[] = [];
    const files = await glob(['**/*.ts', '**/*.js', '**/*.py', '**/*.go'], {
      cwd: this.workingDir,
      nodir: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    });

    // Function detection patterns
    const patterns = [
      // TypeScript/JavaScript
      /(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/,
      // Python
      /def\s+(\w+)\s*\(/,
      // Go
      /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/,
    ];

    for (const file of files.slice(0, 100)) {
      try {
        const fullPath = path.join(this.workingDir, file);
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');

        let currentFunction: { name: string; startLine: number } | null = null;
        let braceDepth = 0;
        let indentLevel = -1;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? '';

          // Check for function start
          for (const pattern of patterns) {
            const match = pattern.exec(line);
            if (match) {
              if (currentFunction && i - currentFunction.startLine > LONG_FUNCTION_THRESHOLD) {
                longFunctions.push({
                  file,
                  name: currentFunction.name,
                  startLine: currentFunction.startLine,
                  lines: i - currentFunction.startLine,
                });
              }
              currentFunction = {
                name: match[1] ?? match[2] ?? 'anonymous',
                startLine: i + 1,
              };
              braceDepth = 0;
              indentLevel = line.search(/\S/);
              break;
            }
          }

          // Track brace depth for function end
          braceDepth += (line.match(/{/g) ?? []).length;
          braceDepth -= (line.match(/}/g) ?? []).length;

          // Python-style: track by indentation
          if (file.endsWith('.py') && currentFunction) {
            const currentIndent = line.search(/\S/);
            if (
              currentIndent !== -1 &&
              currentIndent <= indentLevel &&
              i > currentFunction.startLine
            ) {
              if (i - currentFunction.startLine > LONG_FUNCTION_THRESHOLD) {
                longFunctions.push({
                  file,
                  name: currentFunction.name,
                  startLine: currentFunction.startLine,
                  lines: i - currentFunction.startLine,
                });
              }
              currentFunction = null;
            }
          }
        }

        // Handle last function
        if (currentFunction && lines.length - currentFunction.startLine > LONG_FUNCTION_THRESHOLD) {
          longFunctions.push({
            file,
            name: currentFunction.name,
            startLine: currentFunction.startLine,
            lines: lines.length - currentFunction.startLine,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return longFunctions.sort((a, b) => b.lines - a.lines).slice(0, 20);
  }

  private generateSuggestions(
    duplicates: DuplicateBlock[],
    magicNumbers: MagicNumber[],
    longFunctions: LongFunction[]
  ): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = [];
    const seenHashes = new Set<string>();

    // Suggestions from duplicates - deduplicate by hash
    for (const dup of duplicates.slice(0, 20)) {
      // Skip if we've already seen this hash
      if (seenHashes.has(dup.hash)) continue;
      seenHashes.add(dup.hash);

      const files = [...new Set(dup.occurrences.map(o => o.file))];
      const funcName = this.generateFunctionName(dup.preview);

      suggestions.push({
        type: 'remove-duplicate',
        priority: dup.occurrences.length >= 3 ? 'high' : 'medium',
        title: `Extract to ${funcName}() - ${dup.lines} lines, ${dup.occurrences.length} occurrences`,
        description: `Found ${dup.occurrences.length} occurrences of similar code.\nPreview: ${dup.preview}`,
        files,
        lines: dup.lines * dup.occurrences.length,
        estimatedImpact: `Remove ~${dup.lines * (dup.occurrences.length - 1)} duplicate lines`,
      });

      // Limit to 10 duplicate suggestions
      if (suggestions.filter(s => s.type === 'remove-duplicate').length >= 10) break;
    }

    // Suggestions from magic numbers (group by file)
    const magicByFile = new Map<string, MagicNumber[]>();
    for (const mn of magicNumbers) {
      const existing = magicByFile.get(mn.file) ?? [];
      existing.push(mn);
      magicByFile.set(mn.file, existing);
    }

    for (const [file, numbers] of magicByFile) {
      // Create suggestion for each file with magic numbers (no threshold)
      // Priority: high for 5+, medium for 2-4, low for 1
      const priority = numbers.length >= 5 ? 'high' : numbers.length >= 2 ? 'medium' : 'low';
      suggestions.push({
        type: 'extract-constant',
        priority,
        title: `Extract magic numbers in ${path.basename(file)}`,
        description: `Found ${numbers.length} magic number(s). Consider defining as named constants:\n${numbers
          .slice(0, 5)
          .map(n => `  Line ${n.line}: ${n.value}`)
          .join('\n')}`,
        files: [file],
        estimatedImpact: 'Improved code readability and maintainability',
      });
    }

    // Suggestions from long functions
    for (const fn of longFunctions.slice(0, 5)) {
      suggestions.push({
        type: 'reduce-complexity',
        priority: fn.lines > 100 ? 'high' : 'medium',
        title: `Split long function: ${fn.name}`,
        description: `Function "${fn.name}" is ${fn.lines} lines. Consider breaking into smaller, focused functions.`,
        files: [fn.file],
        lines: fn.lines,
        estimatedImpact: 'Improved testability and maintainability',
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  private async addFixes(
    suggestions: RefactorSuggestion[],
    duplicates: DuplicateBlock[],
    magicNumbers: MagicNumber[]
  ): Promise<RefactorSuggestion[]> {
    const result: RefactorSuggestion[] = [];
    const usedDupHashes = new Set<string>();

    for (const suggestion of suggestions) {
      if (suggestion.type === 'remove-duplicate') {
        // Find the corresponding duplicate block by matching lines count and occurrences
        // Extract info from title format: "Extract to funcName() - X lines, Y occurrences"
        const titleMatch = suggestion.title.match(/(\d+)\s+lines,\s+(\d+)\s+occurrences/);
        const lines = titleMatch ? parseInt(titleMatch[1] ?? '0', 10) : 0;
        const occurrences = titleMatch ? parseInt(titleMatch[2] ?? '0', 10) : 0;

        const dup = duplicates.find(
          d =>
            d.lines === lines && d.occurrences.length === occurrences && !usedDupHashes.has(d.hash)
        );

        if (dup && dup.occurrences.length > 0) {
          usedDupHashes.add(dup.hash);
          const fix = await this.generateDuplicateFix(dup);
          result.push({ ...suggestion, fix });
        } else {
          result.push(suggestion);
        }
      } else if (suggestion.type === 'extract-constant') {
        // Generate constant extraction fix
        const file = suggestion.files[0];
        if (file) {
          const fileNumbers = magicNumbers.filter(n => n.file === file);
          const fix = this.generateConstantFix(file, fileNumbers);
          result.push({ ...suggestion, fix });
        } else {
          result.push(suggestion);
        }
      } else {
        result.push(suggestion);
      }
    }

    return result;
  }

  private async generateDuplicateFix(dup: DuplicateBlock): Promise<RefactorFix> {
    const firstOccurrence = dup.occurrences[0];
    if (!firstOccurrence) {
      return this.createEmptyFix('duplicate');
    }

    // Read the actual code from the first occurrence
    let originalCode = '';
    try {
      const fullPath = path.join(this.workingDir, firstOccurrence.file);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      originalCode = lines.slice(firstOccurrence.startLine - 1, firstOccurrence.endLine).join('\n');
    } catch {
      originalCode = dup.preview;
    }

    // Generate function name from the code
    const funcName = this.generateFunctionName(originalCode);

    // Detect language from first file
    const ext = path.extname(firstOccurrence.file);
    const isTypeScript = ext === '.ts' || ext === '.tsx';
    const isPython = ext === '.py';
    const isGo = ext === '.go';

    // Generate the extracted function
    let extractedFunction = '';
    let callSyntax = '';

    if (isPython) {
      extractedFunction = `def ${funcName}():\n${this.indent(originalCode, '    ')}\n`;
      callSyntax = `${funcName}()`;
    } else if (isGo) {
      extractedFunction = `func ${funcName}() {\n${this.indent(originalCode, '\t')}\n}\n`;
      callSyntax = `${funcName}()`;
    } else {
      // TypeScript/JavaScript
      extractedFunction = `function ${funcName}(): void {\n${this.indent(originalCode, '  ')}\n}\n`;
      callSyntax = `${funcName}();`;
    }

    // Generate replacements for each occurrence
    const replacements = dup.occurrences.map(occ => ({
      file: occ.file,
      startLine: occ.startLine,
      endLine: occ.endLine,
      oldCode: `Lines ${occ.startLine}-${occ.endLine}`,
      newCode: callSyntax,
    }));

    return {
      id: `fix_dup_${dup.hash}`,
      type: 'extract-function',
      newCode: extractedFunction,
      replacements,
      instructions: `1. Add this function to a shared module:\n\n${extractedFunction}\n\n2. Replace ${dup.occurrences.length} occurrences with: ${callSyntax}\n\nFiles to update:\n${dup.occurrences.map(o => `  - ${o.file}:${o.startLine}`).join('\n')}`,
    };
  }

  private generateConstantFix(file: string, numbers: MagicNumber[]): RefactorFix {
    const ext = path.extname(file);
    const isPython = ext === '.py';
    const isGo = ext === '.go';

    // Generate constant definitions
    const constants: string[] = [];
    const replacements: RefactorFix['replacements'] = [];

    // Track used constant names to avoid duplicates
    const usedNames = new Set<string>();

    for (const num of numbers.slice(0, 10)) {
      let constName = this.generateConstantName(num.value, num.context);

      // Ensure unique name by adding suffix if needed
      let uniqueName = constName;
      let counter = 1;
      while (usedNames.has(uniqueName)) {
        uniqueName = `${constName}_${counter}`;
        counter++;
      }
      usedNames.add(uniqueName);
      constName = uniqueName;

      if (isPython) {
        constants.push(`${constName} = ${num.value}`);
      } else if (isGo) {
        constants.push(`const ${constName} = ${num.value}`);
      } else {
        constants.push(`const ${constName} = ${num.value};`);
      }

      replacements.push({
        file: num.file,
        startLine: num.line,
        endLine: num.line,
        oldCode: num.value,
        newCode: constName,
      });
    }

    const newCode = constants.join('\n');

    return {
      id: `fix_const_${path.basename(file)}`,
      type: 'extract-constant',
      newCode,
      replacements,
      instructions: `1. Add these constants at the top of the file:\n\n${newCode}\n\n2. Replace magic numbers:\n${replacements.map(r => `  Line ${r.startLine}: ${r.oldCode} → ${r.newCode}`).join('\n')}`,
    };
  }

  private generateFunctionName(code: string): string {
    const lowerCode = code.toLowerCase();

    // Pattern-based name generation - analyze what the code does
    const patterns: Array<{ pattern: RegExp; name: string }> = [
      // File operations
      { pattern: /fs\.readfile|readfile/i, name: 'readFileContent' },
      { pattern: /fs\.writefile|writefile/i, name: 'writeFileContent' },
      { pattern: /fs\.mkdir|mkdir/i, name: 'createDirectory' },
      { pattern: /fs\.readdir|readdir/i, name: 'listDirectory' },

      // Constructor patterns
      { pattern: /constructor\s*\(\s*workingdir/i, name: 'initializeWorkingDir' },
      { pattern: /constructor/i, name: 'initialize' },

      // Return patterns
      { pattern: /return\s*\{\s*content\s*:\s*\[/i, name: 'createMcpResponse' },
      { pattern: /return\s*\{/i, name: 'createResponse' },

      // Path operations
      { pattern: /path\.join/i, name: 'buildPath' },
      { pattern: /path\.resolve/i, name: 'resolvePath' },

      // Async/await patterns
      { pattern: /await\s+fs\./i, name: 'performFileOperation' },
      { pattern: /await\s+fetch/i, name: 'fetchData' },

      // Error handling
      { pattern: /try\s*\{[\s\S]*catch/i, name: 'handleWithErrorCatch' },
      { pattern: /throw\s+new\s+error/i, name: 'throwError' },

      // Array/object operations
      { pattern: /\.map\s*\(/i, name: 'transformItems' },
      { pattern: /\.filter\s*\(/i, name: 'filterItems' },
      { pattern: /\.reduce\s*\(/i, name: 'aggregateItems' },
      { pattern: /\.foreach\s*\(/i, name: 'processItems' },

      // Loop patterns
      { pattern: /for\s*\(\s*(?:let|const|var)\s+\w+\s+of/i, name: 'iterateCollection' },
      { pattern: /for\s*\(\s*(?:let|const|var)\s+\w+\s*=/i, name: 'iterateWithIndex' },

      // Conditional patterns
      { pattern: /if\s*\(\s*!\s*\w+/i, name: 'checkNegativeCondition' },
      { pattern: /if\s*\(/i, name: 'checkCondition' },

      // Glob/scan patterns
      { pattern: /glob\s*\(/i, name: 'scanFiles' },
      { pattern: /\.scan\s*\(/i, name: 'performScan' },

      // Content split
      { pattern: /\.split\s*\(\s*['"`]\\n['"`]\s*\)/i, name: 'splitIntoLines' },
    ];

    for (const { pattern, name } of patterns) {
      if (pattern.test(code)) {
        return name;
      }
    }

    // Fallback: extract verbs and nouns from code
    const verbMatches = code.match(
      /\b(get|set|create|build|parse|format|validate|process|handle|init|load|save|read|write|find|search|check|update|delete|remove|add|insert)\w*/gi
    );
    if (verbMatches && verbMatches.length > 0) {
      const verb = verbMatches[0] ?? 'process';
      // Clean up and format
      const cleanVerb = verb.charAt(0).toLowerCase() + verb.slice(1);
      return cleanVerb.length > 20 ? cleanVerb.slice(0, 20) : cleanVerb;
    }

    // Last resort: use generic name with counter suffix
    return 'extractedBlock';
  }

  private generateConstantName(value: string, context: string): string {
    // Try to infer name from context
    const contextWords = context
      .replace(/[^a-zA-Z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .slice(0, 2);

    if (contextWords.length > 0) {
      return contextWords.map(w => w.toUpperCase()).join('_') + '_VALUE';
    }
    return `MAGIC_${value}`;
  }

  private indent(code: string, prefix: string): string {
    return code
      .split('\n')
      .map(line => prefix + line)
      .join('\n');
  }

  private createEmptyFix(type: string): RefactorFix {
    return {
      id: `fix_${type}_empty`,
      type: 'extract-function',
      newCode: '',
      replacements: [],
      instructions: 'Unable to generate fix automatically.',
    };
  }

  private generateSummary(
    stats: RefactorReport['stats'],
    suggestions: RefactorSuggestion[]
  ): string {
    const lines: string[] = [];

    lines.push('=== Refactor Analysis Summary ===\n');
    lines.push(`Scanned: ${stats.filesScanned} files`);
    lines.push(
      `Duplicate blocks: ${stats.duplicateBlocks} (${stats.totalDuplicateLines} total lines)`
    );
    lines.push(`Magic numbers: ${stats.magicNumbers}`);
    lines.push(`Long functions: ${stats.longFunctions}\n`);

    if (suggestions.length === 0) {
      lines.push('No significant refactoring opportunities found.');
    } else {
      const highPriority = suggestions.filter(s => s.priority === 'high').length;
      const mediumPriority = suggestions.filter(s => s.priority === 'medium').length;

      lines.push(`Found ${suggestions.length} suggestions:`);
      if (highPriority > 0) lines.push(`  - ${highPriority} high priority`);
      if (mediumPriority > 0) lines.push(`  - ${mediumPriority} medium priority`);

      lines.push('\nTop suggestions:');
      for (const suggestion of suggestions.slice(0, 5)) {
        const icon =
          suggestion.priority === 'high' ? '!' : suggestion.priority === 'medium' ? '*' : '-';
        lines.push(`  ${icon} [${suggestion.priority.toUpperCase()}] ${suggestion.title}`);
        lines.push(`    Impact: ${suggestion.estimatedImpact}`);
      }
    }

    return lines.join('\n');
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
    this.duplicateDetector.setWorkingDir(dir);
  }

  /**
   * Apply refactor fixes - actually modify files
   * Creates backups before modifying, with atomic rollback on failure
   * Only applies safe fixes (constants); duplicates get manual instructions
   *
   * Safety features:
   * - Protected paths (node_modules, .git, own src/) are blocked
   * - Requires --force flag for >5 files
   * - Atomic rollback on any failure
   */
  async applyFixes(
    report: RefactorReport,
    options: { force?: boolean } = {}
  ): Promise<ApplyRefactorResult> {
    const result: ApplyRefactorResult = {
      success: false,
      filesModified: [],
      filesBackedUp: [],
      filesBlocked: [],
      constantsAdded: 0,
      duplicatesFixed: 0,
      requiresForce: false,
      errors: [],
      manualInstructions: [],
      summary: '',
    };

    if (report.suggestions.length === 0) {
      result.success = true;
      result.summary = 'No refactoring suggestions to apply.';
      return result;
    }

    // Initialize atomic file writer for rollback capability
    const atomicWriter = new AtomicFileWriter(this.workingDir);

    try {
      // Group fixes by type
      const constantFixes = report.suggestions.filter(s => s.type === 'extract-constant' && s.fix);
      const duplicateFixes = report.suggestions.filter(s => s.type === 'remove-duplicate' && s.fix);

      // Get all files that would be modified
      const filesToModify = constantFixes
        .map(s => s.files[0])
        .filter((f): f is string => f !== undefined);

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

      // Create a set of safe files for quick lookup
      const safeFileSet = new Set(safeFiles);

      // Apply constant fixes (safe to auto-apply) - only to safe files
      for (const suggestion of constantFixes) {
        if (!suggestion.fix) continue;

        const file = suggestion.files[0];
        if (!file || !safeFileSet.has(file)) continue;

        try {
          await this.applyConstantFix(file, suggestion.fix, result, atomicWriter);
        } catch (error) {
          result.errors.push(`Failed to apply constant fix to ${file}: ${String(error)}`);
          // Rollback all changes on any failure
          try {
            await atomicWriter.rollback();
            result.summary = `✗ Refactor fix failed (rolled back): ${String(error)}`;
          } catch (rollbackError) {
            result.summary = `✗ Refactor fix failed AND rollback failed: ${String(rollbackError)}`;
          }
          return result;
        }
      }

      // For duplicate fixes, generate manual instructions (too risky for auto-apply)
      for (const suggestion of duplicateFixes) {
        if (!suggestion.fix) continue;

        result.manualInstructions.push(`\n=== ${suggestion.title} ===`);
        result.manualInstructions.push(suggestion.fix.instructions);
        result.duplicatesFixed++;
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
      if (result.constantsAdded > 0) {
        parts.push(`Added ${result.constantsAdded} constant(s)`);
      }
      if (result.duplicatesFixed > 0) {
        parts.push(`${result.duplicatesFixed} duplicate fix(es) require manual review`);
      }
      if (result.filesBlocked.length > 0) {
        parts.push(`Blocked ${result.filesBlocked.length} protected file(s)`);
      }

      result.summary = `✓ Refactor fix applied:\n  ${parts.join('\n  ')}`;

      if (result.filesBackedUp.length > 0) {
        result.summary += `\n\nBackups created:\n  ${result.filesBackedUp.join('\n  ')}`;
      }

      if (result.filesModified.length > 0) {
        result.summary += `\n\nFiles modified:\n  ${result.filesModified.join('\n  ')}`;
      }

      if (result.filesBlocked.length > 0) {
        result.summary += `\n\nBlocked files (protected paths):\n  ${result.filesBlocked.map(b => `${b.file}: ${b.reason}`).join('\n  ')}`;
      }

      if (result.manualInstructions.length > 0) {
        result.summary += `\n\n=== Manual Instructions for Duplicates ===`;
        result.summary += result.manualInstructions.join('\n');
      }

      return result;
    } catch (error) {
      // Attempt rollback on any unexpected error
      try {
        await atomicWriter.rollback();
        result.errors.push(`Apply failed (rolled back): ${String(error)}`);
        result.summary = `✗ Refactor fix failed (rolled back): ${String(error)}`;
      } catch (rollbackError) {
        result.errors.push(`Apply failed: ${String(error)}`);
        result.errors.push(`Rollback also failed: ${String(rollbackError)}`);
        result.summary = `✗ Refactor fix failed AND rollback failed. Manual cleanup may be needed.`;
      }
      return result;
    }
  }

  private async applyConstantFix(
    file: string,
    fix: RefactorFix,
    result: ApplyRefactorResult,
    atomicWriter: AtomicFileWriter
  ): Promise<void> {
    const fullPath = path.join(this.workingDir, file);

    // Read original file
    const content = await fs.readFile(fullPath, 'utf-8');

    // Create backup using atomic writer
    await atomicWriter.backup(file);
    result.filesBackedUp.push(file + '.bak');

    const lines = content.split('\n');

    // Find the best place to insert constants (after imports, before code)
    let insertLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? '';
      // Skip past imports, empty lines, and comments at the top
      if (
        line.startsWith('import ') ||
        line.startsWith('from ') ||
        line.startsWith('//') ||
        line.startsWith('/*') ||
        line.startsWith('*') ||
        line.startsWith('#') ||
        line.startsWith('using ') ||
        line === '' ||
        line.startsWith('"use ')
      ) {
        insertLine = i + 1;
      } else if (line.length > 0 && !line.startsWith('export ')) {
        // Found first non-import line that's not an export
        break;
      }
    }

    // Insert constants
    const constantLines = fix.newCode.split('\n');
    lines.splice(insertLine, 0, '', ...constantLines, '');

    // Apply replacements (adjust line numbers for inserted constants)
    const lineOffset = constantLines.length + 2; // +2 for empty lines

    // Sort replacements by line number descending to preserve line numbers
    const sortedReplacements = [...fix.replacements].sort((a, b) => b.startLine - a.startLine);

    for (const r of sortedReplacements) {
      // Only process replacements for this file
      if (r.file !== file) continue;

      const adjustedLine = r.startLine + lineOffset - 1; // -1 for 0-based index
      if (adjustedLine >= 0 && adjustedLine < lines.length) {
        const line = lines[adjustedLine];
        if (line && line.includes(r.oldCode)) {
          lines[adjustedLine] = line.replace(r.oldCode, r.newCode);
          result.constantsAdded++;
        }
      }
    }

    // Write modified file
    await fs.writeFile(fullPath, lines.join('\n'), 'utf-8');
    result.filesModified.push(file);
  }

  /**
   * Learn rules from refactoring suggestions and append to manifesto
   *
   * The --learn flag extracts anti-patterns from refactor suggestions
   * and appends them to .engineering/manifesto.md as rules.
   *
   * Safety: Only appends TEXT rules, never auto-generates regex patterns.
   */
  async learnFromRefactor(report: RefactorReport): Promise<LearnedRule[]> {
    const learnedRules: LearnedRule[] = [];

    // Extract rules from high-priority suggestions
    for (const suggestion of report.suggestions.filter(s => s.priority === 'high')) {
      const rule = this.extractRuleFromSuggestion(suggestion);
      if (rule) {
        learnedRules.push(rule);
      }
    }

    // Extract rules from duplicate patterns
    for (const dup of report.duplicates.slice(0, 5)) {
      const rule = this.extractRuleFromDuplicate(dup);
      if (rule) {
        learnedRules.push(rule);
      }
    }

    // Append rules to manifesto (limit to avoid bloat)
    if (learnedRules.length > 0) {
      await this.appendToManifesto(learnedRules.slice(0, 5));
    }

    return learnedRules;
  }

  /**
   * Extract a rule from a refactor suggestion
   */
  private extractRuleFromSuggestion(suggestion: RefactorSuggestion): LearnedRule | null {
    let rule = '';
    const source = suggestion.files.join(', ');

    switch (suggestion.type) {
      case 'remove-duplicate':
        rule = `Avoid duplicating code blocks across multiple files. Extract shared logic into reusable functions.`;
        break;
      case 'extract-constant':
        rule = `Replace magic numbers with named constants for better maintainability.`;
        break;
      case 'reduce-complexity':
        rule = `Keep functions under 50 lines. Break large functions into smaller, focused ones.`;
        break;
      default:
        return null;
    }

    return {
      rule,
      source,
      type: 'anti-pattern',
      addedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract a rule from a duplicate code block
   */
  private extractRuleFromDuplicate(dup: DuplicateBlock): LearnedRule | null {
    // Only create rule if we have 3+ occurrences (strong signal)
    if (dup.occurrences.length < 3) return null;

    // Analyze the duplicate code to generate a meaningful rule
    const preview = dup.preview.toLowerCase();
    let rule = '';

    if (preview.includes('console.log') || preview.includes('print(')) {
      rule = 'Remove debug logging statements before production. Use a proper logging framework.';
    } else if (preview.includes('try') && preview.includes('catch')) {
      rule = 'Extract common error handling patterns into a shared utility function.';
    } else if (preview.includes('await') && preview.includes('readfile')) {
      rule = 'Create a shared file utility for common file operations.';
    } else if (preview.includes('path.join')) {
      rule = 'Create path helper functions for commonly used directory patterns.';
    } else {
      // Generic rule
      rule = `Extract this repeated pattern (${dup.lines} lines, ${dup.occurrences.length}x) into a reusable function.`;
    }

    return {
      rule,
      source: dup.occurrences.map(o => `${o.file}:${o.startLine}`).slice(0, 3).join(', '),
      type: 'anti-pattern',
      addedAt: new Date().toISOString(),
    };
  }

  /**
   * Append learned rules to .engineering/manifesto.md
   */
  private async appendToManifesto(rules: LearnedRule[]): Promise<void> {
    const manifestoPath = path.join(this.workingDir, '.engineering', 'manifesto.md');

    try {
      let content = '';
      try {
        content = await fs.readFile(manifestoPath, 'utf-8');
      } catch {
        // Manifesto doesn't exist, create with header
        content = '# Project Manifesto\n\n';
      }

      // Check if we already have a "Learned Rules" section
      const learnedSectionHeader = '## 📚 LEARNED RULES (Auto-generated)';
      let learnedSection = content.includes(learnedSectionHeader)
        ? ''
        : `\n\n${learnedSectionHeader}\n`;

      // Add new rules
      learnedSection += `\n### ${new Date().toISOString().split('T')[0]}\n`;
      for (const rule of rules) {
        learnedSection += `- **[${rule.type}]** ${rule.rule}\n`;
        learnedSection += `  - Source: \`${rule.source}\`\n`;
      }

      // Append to manifesto
      const newContent = content + learnedSection;
      await fs.writeFile(manifestoPath, newContent, 'utf-8');
    } catch (error) {
      // Silently fail if we can't write to manifesto
      console.error('Failed to append to manifesto:', error);
    }
  }

  /**
   * Detect garbage files (AI debug scripts, temp files, etc.)
   */
  async detectGarbage(): Promise<GarbageResult> {
    const files: string[] = [];
    let totalSize = 0;

    for (const pattern of GARBAGE_PATTERNS) {
      try {
        const matches = await glob(pattern, {
          cwd: this.workingDir,
          nodir: true,
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
        });

        for (const file of matches) {
          files.push(file);
          try {
            const fullPath = path.join(this.workingDir, file);
            const stat = await fs.stat(fullPath);
            totalSize += stat.size;
          } catch {
            // File might be deleted between glob and stat
          }
        }
      } catch {
        // Glob might fail for some patterns on some systems
      }
    }

    // Remove duplicates
    const uniqueFiles = [...new Set(files)];

    const summary = uniqueFiles.length > 0
      ? `Found ${uniqueFiles.length} garbage file(s) (${this.formatSize(totalSize)})`
      : 'No garbage files found';

    return {
      files: uniqueFiles,
      totalSize,
      summary,
    };
  }

  /**
   * Clean garbage files
   */
  async cleanGarbage(options: {
    fix?: boolean;
    dryRun?: boolean;
  } = {}): Promise<CleanResult> {
    const { fix = false, dryRun = false } = options;

    const detection = await this.detectGarbage();
    const found = detection.files;
    const deleted: string[] = [];
    const wouldDelete: string[] = [];
    const errors: string[] = [];

    if (!fix) {
      // Just return the list
      return {
        found,
        deleted: [],
        wouldDelete: [],
        errors: [],
        summary: detection.summary,
      };
    }

    for (const file of found) {
      const fullPath = path.join(this.workingDir, file);

      if (dryRun) {
        wouldDelete.push(file);
      } else {
        try {
          await fs.unlink(fullPath);
          deleted.push(file);
        } catch (err) {
          errors.push(`Failed to delete ${file}: ${String(err)}`);
        }
      }
    }

    let summary: string;
    if (dryRun) {
      summary = `Would delete ${wouldDelete.length} file(s)`;
    } else if (deleted.length > 0) {
      summary = `Deleted ${deleted.length} garbage file(s)`;
    } else {
      summary = 'No files deleted';
    }

    if (errors.length > 0) {
      summary += ` (${errors.length} error(s))`;
    }

    return {
      found,
      deleted,
      wouldDelete,
      errors,
      summary,
    };
  }

  /**
   * Format file size for display
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

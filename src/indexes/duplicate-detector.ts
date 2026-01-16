/**
 * Duplicate Code Detector
 * Finds similar/duplicate code blocks using text hashing
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { glob } from 'glob';
import { stringify } from 'yaml';
import type { DuplicateBlock } from '../types/index.js';

interface CodeBlock {
  file: string;
  startLine: number;
  endLine: number;
  content: string;
  hash: string;
}

const FILE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.cs',
  '.go',
  '.rs',
  '.c',
  '.cpp',
  '.h',
];

// Minimum lines to consider as a duplicate block
const MIN_BLOCK_SIZE = 5;
// Maximum lines for a single block
const MAX_BLOCK_SIZE = 50;
// Minimum occurrences to report
const MIN_OCCURRENCES = 2;

export class DuplicateDetector {
  private workingDir: string;
  private blocks: CodeBlock[] = [];
  private duplicates: DuplicateBlock[] = [];

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
  }

  async scan(): Promise<DuplicateBlock[]> {
    this.blocks = [];
    this.duplicates = [];

    // Find all source files
    const patterns = FILE_EXTENSIONS.map(ext => `**/*${ext}`);
    const files = await glob(patterns, {
      cwd: this.workingDir,
      nodir: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**'],
    });

    // Extract blocks from each file
    for (const file of files) {
      await this.extractBlocks(file);
    }

    // Find duplicates by hash
    this.findDuplicates();

    return this.duplicates;
  }

  private async extractBlocks(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.workingDir, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Sliding window approach
      for (
        let blockSize = MIN_BLOCK_SIZE;
        blockSize <= Math.min(MAX_BLOCK_SIZE, lines.length);
        blockSize++
      ) {
        for (let startLine = 0; startLine <= lines.length - blockSize; startLine++) {
          const blockLines = lines.slice(startLine, startLine + blockSize);
          const blockContent = this.normalizeBlock(blockLines.join('\n'));

          // Skip blocks that are mostly whitespace or comments
          if (!this.isSignificantBlock(blockContent)) {
            continue;
          }

          const hash = this.hashBlock(blockContent);

          this.blocks.push({
            file: filePath,
            startLine: startLine + 1,
            endLine: startLine + blockSize,
            content: blockContent,
            hash,
          });
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  private normalizeBlock(content: string): string {
    // Remove:
    // - Leading/trailing whitespace per line
    // - Empty lines
    // - Single-line comments
    // - Variable names (replace with placeholder)

    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.startsWith('//') && !line.startsWith('#') && !line.startsWith('*'))
      .join('\n')
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  private isSignificantBlock(content: string): boolean {
    // Skip blocks that are:
    // - Too short (after normalization)
    // - Mostly punctuation/braces
    // - Import statements only

    if (content.length < 50) return false;

    const alphaCount = (content.match(/[a-zA-Z]/g) ?? []).length;
    const totalCount = content.length;

    // At least 30% should be alphabetic
    if (alphaCount / totalCount < 0.3) return false;

    // Skip import-only blocks
    if (/^(import|from|require|using|include)\s/i.test(content)) return false;

    return true;
  }

  private hashBlock(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 12);
  }

  private findDuplicates(): void {
    // Group blocks by hash
    const hashGroups = new Map<string, CodeBlock[]>();

    for (const block of this.blocks) {
      const existing = hashGroups.get(block.hash) ?? [];
      existing.push(block);
      hashGroups.set(block.hash, existing);
    }

    // Find hashes with multiple occurrences
    for (const [hash, blocks] of hashGroups) {
      if (blocks.length < MIN_OCCURRENCES) continue;

      // Remove overlapping blocks from same file
      const uniqueBlocks = this.removeOverlaps(blocks);
      if (uniqueBlocks.length < MIN_OCCURRENCES) continue;

      // Get the largest block for this hash
      const maxLines = Math.max(...uniqueBlocks.map(b => b.endLine - b.startLine + 1));
      const representativeBlock = uniqueBlocks.find(b => b.endLine - b.startLine + 1 === maxLines);

      if (!representativeBlock) continue;

      this.duplicates.push({
        hash,
        lines: maxLines,
        occurrences: uniqueBlocks.map(b => ({
          file: b.file,
          startLine: b.startLine,
          endLine: b.endLine,
        })),
        preview: this.createPreview(representativeBlock.content),
      });
    }

    // Sort by number of occurrences (desc), then by lines (desc)
    this.duplicates.sort((a, b) => {
      const occDiff = b.occurrences.length - a.occurrences.length;
      if (occDiff !== 0) return occDiff;
      return b.lines - a.lines;
    });

    // Limit to top duplicates
    this.duplicates = this.duplicates.slice(0, 50);
  }

  private removeOverlaps(blocks: CodeBlock[]): CodeBlock[] {
    const result: CodeBlock[] = [];

    // Group by file
    const byFile = new Map<string, CodeBlock[]>();
    for (const block of blocks) {
      const existing = byFile.get(block.file) ?? [];
      existing.push(block);
      byFile.set(block.file, existing);
    }

    // For each file, keep only non-overlapping blocks
    for (const [, fileBlocks] of byFile) {
      // Sort by start line
      fileBlocks.sort((a, b) => a.startLine - b.startLine);

      let lastEnd = -1;
      for (const block of fileBlocks) {
        if (block.startLine > lastEnd) {
          result.push(block);
          lastEnd = block.endLine;
        }
      }
    }

    return result;
  }

  private createPreview(content: string): string {
    const maxLength = 100;
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  }

  async saveReport(): Promise<string> {
    const reportPath = path.join(this.workingDir, '.engineering', 'index', 'duplicates.yaml');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });

    const report = {
      scannedAt: new Date().toISOString(),
      totalDuplicates: this.duplicates.length,
      duplicates: this.duplicates,
    };

    await fs.writeFile(reportPath, stringify(report, { indent: 2 }), 'utf-8');
    return reportPath;
  }

  getDuplicates(): DuplicateBlock[] {
    return this.duplicates;
  }

  getSummary(): string {
    if (this.duplicates.length === 0) {
      return 'No significant duplicate code blocks found.';
    }

    const totalOccurrences = this.duplicates.reduce((sum, d) => sum + d.occurrences.length, 0);
    const avgLines = Math.round(
      this.duplicates.reduce((sum, d) => sum + d.lines, 0) / this.duplicates.length
    );

    let summary = `Found ${this.duplicates.length} duplicate block(s) with ${totalOccurrences} total occurrences.\n`;
    summary += `Average block size: ${avgLines} lines\n\n`;
    summary += 'Top duplicates:\n';

    for (const dup of this.duplicates.slice(0, 5)) {
      summary += `  • ${dup.lines} lines, ${dup.occurrences.length} occurrences: ${dup.preview}\n`;
      for (const occ of dup.occurrences.slice(0, 3)) {
        summary += `      ${occ.file}:${occ.startLine}-${occ.endLine}\n`;
      }
      if (dup.occurrences.length > 3) {
        summary += `      ...and ${dup.occurrences.length - 3} more\n`;
      }
    }

    return summary;
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
    this.blocks = [];
    this.duplicates = [];
  }
}

/**
 * Code Similarity Analyzer
 * Finds similar code snippets in the codebase
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { glob } from 'glob';

export interface SimilarityMatch {
  file: string;
  startLine: number;
  endLine: number;
  similarity: number; // 0-100
  preview: string;
}

export interface SimilarityResult {
  query: string;
  matches: SimilarityMatch[];
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

export class SimilarityAnalyzer {
  private workingDir: string;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
  }

  async findSimilar(codeSnippet: string, minSimilarity = 60): Promise<SimilarityResult> {
    const normalizedQuery = this.normalizeCode(codeSnippet);
    const queryTokens = this.tokenize(normalizedQuery);
    const matches: SimilarityMatch[] = [];

    const files = await glob(
      FILE_EXTENSIONS.map(ext => `**/*${ext}`),
      {
        cwd: this.workingDir,
        nodir: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**'],
      }
    );

    for (const file of files.slice(0, 200)) {
      // Limit for performance
      try {
        const fullPath = path.join(this.workingDir, file);
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');

        // Sliding window to find similar blocks
        const queryLineCount = codeSnippet.split('\n').length;
        const windowSize = Math.max(queryLineCount, 3);

        for (let i = 0; i <= lines.length - windowSize; i++) {
          const block = lines.slice(i, i + windowSize).join('\n');
          const normalizedBlock = this.normalizeCode(block);
          const blockTokens = this.tokenize(normalizedBlock);

          const similarity = this.calculateSimilarity(queryTokens, blockTokens);

          if (similarity >= minSimilarity) {
            matches.push({
              file,
              startLine: i + 1,
              endLine: i + windowSize,
              similarity: Math.round(similarity),
              preview: this.createPreview(block),
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Sort by similarity descending, remove overlaps
    matches.sort((a, b) => b.similarity - a.similarity);
    const uniqueMatches = this.removeOverlaps(matches);

    return {
      query: this.createPreview(codeSnippet),
      matches: uniqueMatches.slice(0, 20),
    };
  }

  private normalizeCode(code: string): string {
    return code
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.startsWith('//') && !line.startsWith('#') && !line.startsWith('*'))
      .join(' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  private tokenize(code: string): Set<string> {
    // Extract tokens (words, operators, etc.)
    const tokens = code.match(/[a-z_][a-z0-9_]*|[{}()\[\];,=<>!+\-*/&|^%]/g) ?? [];

    // Also create n-grams for better matching
    const ngrams = new Set<string>();
    for (const token of tokens) {
      ngrams.add(token);
    }

    // Add 2-grams
    for (let i = 0; i < tokens.length - 1; i++) {
      ngrams.add(`${tokens[i]} ${tokens[i + 1]}`);
    }

    // Add 3-grams
    for (let i = 0; i < tokens.length - 2; i++) {
      ngrams.add(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
    }

    return ngrams;
  }

  private calculateSimilarity(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 || set2.size === 0) return 0;

    let intersection = 0;
    for (const item of set1) {
      if (set2.has(item)) {
        intersection++;
      }
    }

    // Jaccard similarity
    const union = set1.size + set2.size - intersection;
    return (intersection / union) * 100;
  }

  private removeOverlaps(matches: SimilarityMatch[]): SimilarityMatch[] {
    const result: SimilarityMatch[] = [];
    const usedRanges = new Map<string, Array<[number, number]>>();

    for (const match of matches) {
      const fileRanges = usedRanges.get(match.file) ?? [];
      let overlaps = false;

      for (const [start, end] of fileRanges) {
        if (!(match.endLine < start || match.startLine > end)) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        result.push(match);
        fileRanges.push([match.startLine, match.endLine]);
        usedRanges.set(match.file, fileRanges);
      }
    }

    return result;
  }

  private createPreview(code: string): string {
    const firstLine = code.split('\n')[0]?.trim() ?? '';
    if (firstLine.length <= 80) return firstLine;
    return firstLine.slice(0, 77) + '...';
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
  }

  formatResult(result: SimilarityResult): string {
    if (result.matches.length === 0) {
      return 'No similar code found.';
    }

    let output = `Found ${result.matches.length} similar code block(s):\n\n`;

    for (const match of result.matches.slice(0, 10)) {
      output += `${match.file}:${match.startLine}-${match.endLine} (${match.similarity}% similar)\n`;
      output += `  ${match.preview}\n\n`;
    }

    if (result.matches.length > 10) {
      output += `...and ${result.matches.length - 10} more matches`;
    }

    return output;
  }
}

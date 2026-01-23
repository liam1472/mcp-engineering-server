/**
 * Log Analyzer
 * Streaming log file analysis for debugging
 * Handles large files without loading entirely into memory
 */

import * as fs from 'fs';
import * as readline from 'readline';

/**
 * Options for log analysis
 */
export interface AnalyzeOptions {
  file: string;
  pattern?: string | undefined;
  tail?: number | undefined;
  ignoreCase?: boolean | undefined;
}

/**
 * Result of log analysis
 */
export interface LogResult {
  file: string;
  lines: string[];
  totalLines: number;
  matchedLines: number;
  truncated: boolean;
  error?: string | undefined;
}

/**
 * LogAnalyzer - Streaming log file analyzer
 */
export class LogAnalyzer {
  private defaultTail = 100;

  /**
   * Analyze a log file
   */
  async analyze(options: AnalyzeOptions): Promise<LogResult> {
    const { file, pattern, tail = this.defaultTail, ignoreCase = false } = options;

    // Check if file exists
    try {
      await fs.promises.access(file, fs.constants.R_OK);
    } catch {
      return {
        file,
        lines: [],
        totalLines: 0,
        matchedLines: 0,
        truncated: false,
        error: `File not found or not readable: ${file}`,
      };
    }

    // Use streaming to read the file
    return this.streamAnalyze(file, pattern, tail, ignoreCase);
  }

  /**
   * Stream-based file analysis
   */
  private async streamAnalyze(
    file: string,
    pattern: string | undefined,
    tail: number,
    ignoreCase: boolean
  ): Promise<LogResult> {
    return new Promise((resolve) => {
      const matchedLines: string[] = [];
      let totalLines = 0;
      let matchedCount = 0; // Track total matches separately (ring buffer only keeps tail)
      let regex: RegExp | null = null;

      // Compile pattern if provided
      if (pattern) {
        try {
          regex = new RegExp(pattern, ignoreCase ? 'i' : undefined);
        } catch {
          // Invalid regex, use string matching
          regex = null;
        }
      }

      const fileStream = fs.createReadStream(file, { encoding: 'utf-8' });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      rl.on('line', (line: string) => {
        totalLines++;

        // Check pattern match
        let matches = true;
        if (pattern) {
          if (regex) {
            matches = regex.test(line);
          } else {
            // Simple string matching
            const searchIn = ignoreCase ? line.toLowerCase() : line;
            const searchFor = ignoreCase ? pattern.toLowerCase() : pattern;
            matches = searchIn.includes(searchFor);
          }
        }

        if (matches) {
          matchedCount++;
          // Ring buffer: only keep last 'tail' lines in memory
          // This prevents memory bomb on large files
          if (tail > 0) {
            if (matchedLines.length >= tail) {
              matchedLines.shift(); // Remove oldest
            }
            matchedLines.push(line); // Add newest
          }
          // If tail=0, don't store any lines (just count)
        }
      });

      rl.on('close', () => {
        // With ring buffer, matchedLines already contains only the last 'tail' lines
        // No need to slice - the buffer is already the right size
        const truncated = matchedCount > tail || totalLines > matchedCount;

        resolve({
          file,
          lines: matchedLines,
          totalLines,
          matchedLines: matchedCount,
          truncated,
        });
      });

      rl.on('error', (err: Error) => {
        resolve({
          file,
          lines: [],
          totalLines: 0,
          matchedLines: 0,
          truncated: false,
          error: err.message,
        });
      });

      fileStream.on('error', (err: Error) => {
        rl.close();
        resolve({
          file,
          lines: [],
          totalLines: 0,
          matchedLines: 0,
          truncated: false,
          error: err.message,
        });
      });
    });
  }

  /**
   * Format result for display
   */
  formatResult(result: LogResult): string {
    if (result.error) {
      return `Error: ${result.error}`;
    }

    let output = `# Log Analysis: ${result.file}\n\n`;
    output += `Total lines: ${result.totalLines}\n`;
    output += `Matched lines: ${result.matchedLines}\n`;
    output += `Showing: ${result.lines.length}${result.truncated ? ' (truncated)' : ''}\n\n`;

    if (result.lines.length > 0) {
      output += '```\n';
      output += result.lines.join('\n');
      output += '\n```';
    } else {
      output += 'No matching lines found.';
    }

    return output;
  }
}

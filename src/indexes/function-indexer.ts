/**
 * Function Indexer
 * Scans codebase and indexes all functions/methods
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { stringify } from 'yaml';
import type { FunctionIndexEntry } from '../types/index.js';

// Language-specific function patterns
const FUNCTION_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    // Function declarations
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+))?/g,
    // Arrow functions with const/let
    /(?:export\s+)?(?:const|let)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*([^=]+))?\s*=>/g,
    // Method declarations in class
    /(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?/g,
  ],
  python: [
    // Function definitions
    /def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?:/g,
    // Async function definitions
    /async\s+def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?:/g,
  ],
  csharp: [
    // Method declarations
    /(?:public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)/g,
  ],
  go: [
    // Function declarations
    /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(([^)]*)\)\s*(?:\(([^)]*)\)|(\w+))?/g,
  ],
  rust: [
    // Function declarations
    /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?:->\s*([^{]+))?/g,
  ],
  c: [
    // Function declarations
    /(\w+(?:\s*\*)?)\s+(\w+)\s*\(([^)]*)\)\s*(?:;|{)/g,
  ],
};

const FILE_EXTENSIONS: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'typescript',
  '.jsx': 'typescript',
  '.py': 'python',
  '.cs': 'csharp',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'c',
  '.hpp': 'c',
};

export class FunctionIndexer {
  private workingDir: string;
  private index: FunctionIndexEntry[] = [];

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
  }

  async scan(): Promise<FunctionIndexEntry[]> {
    this.index = [];

    const extensions = Object.keys(FILE_EXTENSIONS).map(ext => `**/*${ext}`);
    const files = await glob(extensions, {
      cwd: this.workingDir,
      nodir: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    });

    for (const file of files) {
      const entries = await this.scanFile(file);
      this.index.push(...entries);
    }

    return this.index;
  }

  async scanFile(filePath: string): Promise<FunctionIndexEntry[]> {
    const entries: FunctionIndexEntry[] = [];
    const ext = path.extname(filePath).toLowerCase();
    const language = FILE_EXTENSIONS[ext];

    if (!language) {
      return entries;
    }

    const patterns = FUNCTION_PATTERNS[language];
    if (!patterns) {
      return entries;
    }

    try {
      const fullPath = path.join(this.workingDir, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        if (!line) continue;

        for (const pattern of patterns) {
          // Reset regex state
          pattern.lastIndex = 0;

          const match = pattern.exec(line);
          if (match) {
            const entry = this.parseMatch(match, filePath, lineNum + 1, language);
            if (entry) {
              entries.push(entry);
            }
          }
        }
      }
    } catch {
      // Skip files that can't be read
    }

    return entries;
  }

  private parseMatch(
    match: RegExpExecArray,
    file: string,
    line: number,
    language: string
  ): FunctionIndexEntry | null {
    // Extract function name based on language
    let name: string;
    let params = '';
    let returnType: string | undefined;

    switch (language) {
      case 'typescript':
      case 'python':
        name = match[1] ?? '';
        params = match[2] ?? match[3] ?? '';
        returnType = match[3] ?? match[4];
        break;
      case 'csharp':
        returnType = match[1];
        name = match[2] ?? '';
        params = match[3] ?? '';
        break;
      case 'go':
        name = match[1] ?? '';
        params = match[2] ?? '';
        returnType = match[3] ?? match[4];
        break;
      case 'rust':
        name = match[1] ?? '';
        params = match[2] ?? '';
        returnType = match[3];
        break;
      case 'c':
        returnType = match[1];
        name = match[2] ?? '';
        params = match[3] ?? '';
        break;
      default:
        return null;
    }

    if (!name) {
      return null;
    }

    const parameters = this.parseParameters(params);

    return {
      name,
      file,
      line,
      signature: match[0].trim(),
      returnType: returnType?.trim(),
      parameters,
    };
  }

  private parseParameters(params: string): Array<{ name: string; type?: string }> {
    if (!params.trim()) {
      return [];
    }

    return params.split(',').map(p => {
      const parts = p.trim().split(/[:\s]+/);
      return {
        name: parts[0]?.replace(/[*&]/, '') ?? '',
        type: parts[1]?.trim(),
      };
    });
  }

  async saveIndex(): Promise<void> {
    const indexPath = path.join(this.workingDir, '.engineering', 'index', 'functions.yaml');
    await fs.mkdir(path.dirname(indexPath), { recursive: true });

    const content = stringify({ functions: this.index }, { indent: 2 });
    await fs.writeFile(indexPath, content, 'utf-8');
  }

  search(query: string): FunctionIndexEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.index.filter(
      entry =>
        entry.name.toLowerCase().includes(lowerQuery) ||
        entry.signature.toLowerCase().includes(lowerQuery)
    );
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
    this.index = [];
  }
}

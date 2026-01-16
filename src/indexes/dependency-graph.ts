/**
 * Dependency Graph Analyzer
 * Analyzes module dependencies and generates dependency graph
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { stringify } from 'yaml';

export interface DependencyNode {
  file: string;
  imports: string[];
  importedBy: string[];
  externalDeps: string[];
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  circular: string[][];
  entryPoints: string[];
  orphans: string[];
}

export interface DependencyReport {
  totalFiles: number;
  totalImports: number;
  externalDependencies: string[];
  circularDependencies: string[][];
  entryPoints: string[];
  orphanModules: string[];
  mostImported: Array<{ file: string; count: number }>;
  mostDependencies: Array<{ file: string; count: number }>;
}

// Import patterns for different languages
const IMPORT_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    /import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/g,
  ],
  python: [/^import\s+(\w+(?:\.\w+)*)/gm, /^from\s+(\w+(?:\.\w+)*)\s+import/gm],
  go: [/import\s+"([^"]+)"/g, /import\s+\w+\s+"([^"]+)"/g],
  rust: [/use\s+(?:crate::)?(\w+(?:::\w+)*)/g, /mod\s+(\w+)/g],
  csharp: [/using\s+(\w+(?:\.\w+)*)\s*;/g],
};

const FILE_EXTENSIONS: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'typescript',
  '.jsx': 'typescript',
  '.mjs': 'typescript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.cs': 'csharp',
};

export class DependencyAnalyzer {
  private workingDir: string;
  private graph: DependencyGraph;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
    this.graph = {
      nodes: new Map(),
      circular: [],
      entryPoints: [],
      orphans: [],
    };
  }

  async analyze(): Promise<DependencyReport> {
    this.graph = {
      nodes: new Map(),
      circular: [],
      entryPoints: [],
      orphans: [],
    };

    // Find all source files
    const extensions = Object.keys(FILE_EXTENSIONS).map(ext => `**/*${ext}`);
    const files = await glob(extensions, {
      cwd: this.workingDir,
      nodir: true,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/vendor/**',
        '**/venv/**',
        '**/__pycache__/**',
      ],
    });

    // Parse each file for imports
    for (const file of files) {
      await this.parseFile(file);
    }

    // Build reverse dependencies (importedBy)
    this.buildReverseDependencies();

    // Detect circular dependencies
    this.detectCircularDependencies();

    // Find entry points and orphans
    this.findEntryPointsAndOrphans();

    return this.generateReport();
  }

  private async parseFile(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    const language = FILE_EXTENSIONS[ext];

    if (!language) return;

    const patterns = IMPORT_PATTERNS[language];
    if (!patterns) return;

    try {
      const fullPath = path.join(this.workingDir, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');

      const imports: string[] = [];
      const externalDeps: string[] = [];

      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match;

        while ((match = pattern.exec(content)) !== null) {
          const importPath = match[1];
          if (!importPath) continue;

          // Determine if internal or external
          if (this.isExternalImport(importPath, language)) {
            externalDeps.push(importPath);
          } else {
            const resolved = this.resolveImport(importPath, filePath, language);
            if (resolved) {
              imports.push(resolved);
            }
          }
        }
      }

      this.graph.nodes.set(filePath, {
        file: filePath,
        imports: [...new Set(imports)],
        importedBy: [],
        externalDeps: [...new Set(externalDeps)],
      });
    } catch {
      // Skip files that can't be read
    }
  }

  private isExternalImport(importPath: string, language: string): boolean {
    switch (language) {
      case 'typescript':
        // External if doesn't start with . or /
        return !importPath.startsWith('.') && !importPath.startsWith('/');
      case 'python':
        // External if not a relative import
        return !importPath.startsWith('.');
      case 'go':
        // External if contains a domain
        return importPath.includes('.') && !importPath.startsWith('./');
      case 'rust':
        // External if not crate:: or super:: or self::
        return (
          !importPath.startsWith('crate') &&
          !importPath.startsWith('super') &&
          !importPath.startsWith('self')
        );
      case 'csharp':
        // External if starts with System or Microsoft
        return (
          importPath.startsWith('System') ||
          importPath.startsWith('Microsoft') ||
          importPath.startsWith('Newtonsoft') ||
          importPath.startsWith('NUnit')
        );
      default:
        return false;
    }
  }

  private resolveImport(importPath: string, fromFile: string, language: string): string | null {
    const fromDir = path.dirname(fromFile);

    switch (language) {
      case 'typescript': {
        // Handle relative imports
        if (importPath.startsWith('.')) {
          let resolved = path.join(fromDir, importPath);
          // Normalize path separators
          resolved = resolved.replace(/\\/g, '/');

          // Try common extensions
          const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
          for (const ext of extensions) {
            const withExt = resolved + ext;
            if (this.graph.nodes.has(withExt) || this.fileExists(withExt)) {
              return withExt;
            }
          }
          return resolved;
        }
        break;
      }
      case 'python': {
        // Convert dot notation to path
        const parts = importPath.split('.');
        return parts.join('/') + '.py';
      }
      case 'go':
      case 'rust':
      case 'csharp':
        return importPath;
    }

    return null;
  }

  private fileExists(filePath: string): boolean {
    // Check if we've already parsed this file
    return this.graph.nodes.has(filePath);
  }

  private buildReverseDependencies(): void {
    for (const [file, node] of this.graph.nodes) {
      for (const imported of node.imports) {
        const importedNode = this.graph.nodes.get(imported);
        if (importedNode) {
          importedNode.importedBy.push(file);
        }
      }
    }
  }

  private detectCircularDependencies(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circular: string[][] = [];

    const dfs = (file: string, path: string[]): void => {
      visited.add(file);
      recursionStack.add(file);

      const node = this.graph.nodes.get(file);
      if (!node) return;

      for (const imported of node.imports) {
        if (!visited.has(imported)) {
          dfs(imported, [...path, file]);
        } else if (recursionStack.has(imported)) {
          // Found circular dependency
          const cycleStart = path.indexOf(imported);
          if (cycleStart !== -1) {
            const cycle = [...path.slice(cycleStart), file, imported];
            circular.push(cycle);
          } else {
            circular.push([...path, file, imported]);
          }
        }
      }

      recursionStack.delete(file);
    };

    for (const file of this.graph.nodes.keys()) {
      if (!visited.has(file)) {
        dfs(file, []);
      }
    }

    this.graph.circular = circular;
  }

  private findEntryPointsAndOrphans(): void {
    const entryPoints: string[] = [];
    const orphans: string[] = [];

    for (const [file, node] of this.graph.nodes) {
      // Entry points: files that are not imported by anything
      if (node.importedBy.length === 0) {
        // Check if it's a main/entry file
        const basename = path.basename(file).toLowerCase();
        if (
          basename.includes('index') ||
          basename.includes('main') ||
          basename.includes('app') ||
          basename.includes('server') ||
          basename.includes('cli') ||
          node.imports.length > 0
        ) {
          entryPoints.push(file);
        } else if (node.imports.length === 0) {
          // Orphan: no imports and not imported
          orphans.push(file);
        } else {
          entryPoints.push(file);
        }
      }
    }

    this.graph.entryPoints = entryPoints;
    this.graph.orphans = orphans;
  }

  private generateReport(): DependencyReport {
    const externalDeps = new Set<string>();
    let totalImports = 0;

    const importCounts = new Map<string, number>();
    const dependencyCounts = new Map<string, number>();

    for (const [file, node] of this.graph.nodes) {
      totalImports += node.imports.length;
      dependencyCounts.set(file, node.imports.length);

      for (const ext of node.externalDeps) {
        externalDeps.add(ext);
      }

      for (const imported of node.imports) {
        importCounts.set(imported, (importCounts.get(imported) ?? 0) + 1);
      }
    }

    // Sort by count
    const mostImported = [...importCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([file, count]) => ({ file, count }));

    const mostDependencies = [...dependencyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([file, count]) => ({ file, count }));

    return {
      totalFiles: this.graph.nodes.size,
      totalImports,
      externalDependencies: [...externalDeps].sort(),
      circularDependencies: this.graph.circular,
      entryPoints: this.graph.entryPoints,
      orphanModules: this.graph.orphans,
      mostImported,
      mostDependencies,
    };
  }

  async saveReport(): Promise<string> {
    const report = this.generateReport();
    const reportPath = path.join(this.workingDir, '.engineering', 'index', 'dependencies.yaml');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });

    await fs.writeFile(reportPath, stringify(report, { indent: 2 }), 'utf-8');
    return reportPath;
  }

  getSummary(): string {
    const report = this.generateReport();
    const lines: string[] = [];

    lines.push(`Dependency Analysis:`);
    lines.push(`  Files: ${report.totalFiles}`);
    lines.push(`  Total imports: ${report.totalImports}`);
    lines.push(`  External deps: ${report.externalDependencies.length}`);
    lines.push(`  Entry points: ${report.entryPoints.length}`);

    if (report.circularDependencies.length > 0) {
      lines.push(`\n⚠ Circular dependencies: ${report.circularDependencies.length}`);
      for (const cycle of report.circularDependencies.slice(0, 3)) {
        lines.push(`    ${cycle.join(' → ')}`);
      }
      if (report.circularDependencies.length > 3) {
        lines.push(`    ...and ${report.circularDependencies.length - 3} more`);
      }
    }

    if (report.orphanModules.length > 0) {
      lines.push(`\n⚠ Orphan modules: ${report.orphanModules.length}`);
      for (const orphan of report.orphanModules.slice(0, 5)) {
        lines.push(`    ${orphan}`);
      }
    }

    if (report.mostImported.length > 0) {
      lines.push(`\nMost imported:`);
      for (const { file, count } of report.mostImported.slice(0, 5)) {
        lines.push(`    ${file} (${count} imports)`);
      }
    }

    return lines.join('\n');
  }

  getGraph(): DependencyGraph {
    return this.graph;
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
    this.graph = {
      nodes: new Map(),
      circular: [],
      entryPoints: [],
      orphans: [],
    };
  }
}

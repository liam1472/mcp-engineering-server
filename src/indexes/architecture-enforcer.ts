/**
 * Architecture Enforcer
 * Enforces architectural layer dependencies and detects violations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parse, stringify } from 'yaml';
import { minimatch } from 'minimatch';

/**
 * Layer definition
 */
export interface LayerConfig {
  name: string;
  pattern: string;
  allowedDependencies: string[];
}

/**
 * Custom rule definition
 */
export interface RuleConfig {
  name: string;
  description: string;
  from: string;
  to: string;
  allow: boolean;
}

/**
 * Architecture configuration
 */
export interface ArchitectureConfig {
  layers: LayerConfig[];
  rules: RuleConfig[];
}

/**
 * A single violation
 */
export interface Violation {
  type: 'forbidden-dependency' | 'cycle' | 'rule-violation';
  file: string;
  line: number;
  from: string;
  to: string;
  description: string;
}

/**
 * Violation report
 */
export interface ViolationReport {
  violations: Violation[];
  summary: string;
  failed: boolean;
}

/**
 * Init result
 */
export interface InitResult {
  created: boolean;
  skipped: boolean;
  configPath: string;
}

/**
 * Default architecture template
 */
const DEFAULT_TEMPLATE = `# Architecture Configuration
# Define layers and dependency rules for your project

layers:
  # Example: Clean Architecture layers
  - name: presentation
    pattern: "src/ui/**"
    allowedDependencies: ["application", "domain"]

  - name: application
    pattern: "src/app/**"
    allowedDependencies: ["domain"]

  - name: domain
    pattern: "src/domain/**"
    allowedDependencies: []

  - name: infrastructure
    pattern: "src/infra/**"
    allowedDependencies: ["domain", "application"]

rules:
  # Additional custom rules
  # - name: "No direct DB in domain"
  #   description: "Domain should not access database directly"
  #   from: "domain"
  #   to: "infrastructure"
  #   allow: false
`;

/**
 * ArchitectureEnforcer - Enforces architectural boundaries
 */
export class ArchitectureEnforcer {
  private workingDir: string;
  private config: ArchitectureConfig | null = null;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
  }

  /**
   * Initialize architecture configuration
   */
  async init(): Promise<InitResult> {
    const configPath = path.join(this.workingDir, '.engineering', 'architecture.yaml');

    // Check if already exists
    try {
      await fs.access(configPath);
      return {
        created: false,
        skipped: true,
        configPath,
      };
    } catch {
      // Doesn't exist, create it
    }

    // Create directory if needed
    await fs.mkdir(path.join(this.workingDir, '.engineering'), { recursive: true });

    // Write template
    await fs.writeFile(configPath, DEFAULT_TEMPLATE, 'utf-8');

    return {
      created: true,
      skipped: false,
      configPath,
    };
  }

  /**
   * Load architecture configuration
   */
  async loadConfig(): Promise<ArchitectureConfig> {
    const configPath = path.join(this.workingDir, '.engineering', 'architecture.yaml');

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const parsed = parse(content) as { layers?: LayerConfig[]; rules?: RuleConfig[] };

      this.config = {
        layers: parsed.layers ?? [],
        rules: parsed.rules ?? [],
      };

      return this.config;
    } catch {
      this.config = { layers: [], rules: [] };
      return this.config;
    }
  }

  /**
   * Get the layer a file belongs to
   */
  getFileLayer(filePath: string): string | null {
    if (!this.config) {
      return null;
    }

    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, '/');

    for (const layer of this.config.layers) {
      if (minimatch(normalizedPath, layer.pattern)) {
        return layer.name;
      }
    }

    return null;
  }

  /**
   * Check for architecture violations
   */
  async check(): Promise<ViolationReport> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (!this.config || this.config.layers.length === 0) {
      return {
        violations: [],
        summary: 'No architecture configuration found.',
        failed: false,
      };
    }

    const violations: Violation[] = [];

    // Find all source files
    const sourceFiles = await this.findSourceFiles(this.workingDir);

    // Analyze each file for import violations
    for (const file of sourceFiles) {
      const fileLayer = this.getFileLayer(path.relative(this.workingDir, file));
      if (!fileLayer) {
        continue;
      }

      const layerConfig = this.config.layers.find((l) => l.name === fileLayer);
      if (!layerConfig) {
        continue;
      }

      // Parse imports
      const imports = await this.parseImports(file);

      for (const imp of imports) {
        // Resolve import to file path
        const resolvedPath = this.resolveImport(file, imp.path);
        if (!resolvedPath) {
          continue;
        }

        const importLayer = this.getFileLayer(path.relative(this.workingDir, resolvedPath));

        // If importing from same layer, skip
        if (importLayer === fileLayer) {
          continue;
        }

        // If import target has no defined layer, treat it as "external/unknown"
        // This allows detection when a layer with no allowed dependencies imports anything
        const targetLayer = importLayer ?? 'external';

        // Check if this dependency is allowed
        if (!layerConfig.allowedDependencies.includes(targetLayer)) {
          violations.push({
            type: 'forbidden-dependency',
            file: path.relative(this.workingDir, file).replace(/\\/g, '/'),
            line: imp.line,
            from: fileLayer,
            to: targetLayer,
            description: `Layer "${fileLayer}" cannot depend on "${targetLayer}"`,
          });
        }
      }
    }

    return {
      violations,
      summary:
        violations.length === 0
          ? 'No architecture violations found.'
          : `${violations.length} violation(s) found.`,
      failed: violations.length > 0,
    };
  }

  /**
   * Enforce architecture - check and return failure status
   */
  async enforce(): Promise<ViolationReport> {
    return this.check();
  }

  /**
   * Find all source files recursively
   */
  private async findSourceFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.cs'];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip common non-source directories
          if (!['node_modules', '.git', 'dist', 'build', '.engineering'].includes(entry.name)) {
            const subFiles = await this.findSourceFiles(fullPath);
            results.push(...subFiles);
          }
        } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
          results.push(fullPath);
        }
      }
    } catch {
      // Directory not accessible
    }

    return results;
  }

  /**
   * Parse imports from a file
   */
  private async parseImports(filePath: string): Promise<Array<{ path: string; line: number }>> {
    const imports: Array<{ path: string; line: number }> = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const lineNum = i + 1;

        // TypeScript/JavaScript imports
        const esImport = line.match(/import\s+.*?from\s+['"]([^'"]+)['"]/);
        if (esImport && esImport[1]) {
          imports.push({ path: esImport[1], line: lineNum });
          continue;
        }

        // CommonJS require
        const cjsRequire = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (cjsRequire && cjsRequire[1]) {
          imports.push({ path: cjsRequire[1], line: lineNum });
          continue;
        }

        // Python imports
        const pyImport = line.match(/from\s+([^\s]+)\s+import/);
        if (pyImport && pyImport[1]) {
          imports.push({ path: pyImport[1].replace(/\./g, '/'), line: lineNum });
          continue;
        }
      }
    } catch {
      // File not readable
    }

    return imports;
  }

  /**
   * Resolve import path to actual file path
   */
  private resolveImport(fromFile: string, importPath: string): string | null {
    // Only handle relative imports
    if (!importPath.startsWith('.')) {
      return null;
    }

    const fromDir = path.dirname(fromFile);
    const resolved = path.resolve(fromDir, importPath);

    // Try with different extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];

    for (const ext of extensions) {
      const fullPath = resolved + ext;
      try {
        // Just return the resolved path - we don't need to check if it exists
        // for pattern matching purposes
        if (ext === '' || ext.startsWith('/index')) {
          return fullPath;
        }
        return fullPath;
      } catch {
        continue;
      }
    }

    return resolved;
  }

  /**
   * Format report for display
   */
  formatReport(report: ViolationReport): string {
    let output = '# Architecture Check Report\n\n';
    output += `${report.summary}\n\n`;

    if (report.violations.length > 0) {
      output += '## Violations\n\n';

      for (const v of report.violations) {
        output += `**${v.file}:${v.line}**\n`;
        output += `  Type: ${v.type}\n`;
        output += `  From: ${v.from} → To: ${v.to}\n`;
        output += `  ${v.description}\n\n`;
      }
    }

    return output;
  }

  /**
   * Set working directory
   */
  setWorkingDir(dir: string): void {
    this.workingDir = dir;
    this.config = null;
  }
}

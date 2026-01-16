/**
 * Route Indexer
 * Indexes API routes for web projects (Express, Fastify, Flask, Django, etc.)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { stringify } from 'yaml';
import type { RouteIndexEntry } from '../types/index.js';

type HttpMethod = RouteIndexEntry['method'];

interface RoutePattern {
  regex: RegExp;
  methodGroup: number;
  pathGroup: number;
  handlerGroup?: number;
  defaultMethod?: HttpMethod;
}

// Framework-specific route patterns
const ROUTE_PATTERNS: Record<string, RoutePattern[]> = {
  // Express/Node.js
  express: [
    // app.get('/path', handler) or router.get(...)
    {
      regex:
        /(?:app|router)\.(get|post|put|delete|patch|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
      methodGroup: 1,
      pathGroup: 2,
    },
    // @Get('/path'), @Post('/path') - NestJS style
    {
      regex: /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gi,
      methodGroup: 1,
      pathGroup: 2,
    },
  ],
  // Python Flask
  flask: [
    // @app.route('/path', methods=['GET'])
    {
      regex: /@(?:app|bp|blueprint)\.route\s*\(\s*['"`]([^'"`]+)['"`]/gi,
      methodGroup: -1, // No method group, extract from methods=
      pathGroup: 1,
      defaultMethod: 'GET',
    },
    // @app.get('/path')
    {
      regex: /@(?:app|bp|blueprint)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
      methodGroup: 1,
      pathGroup: 2,
    },
  ],
  // Python FastAPI
  fastapi: [
    // @app.get('/path')
    {
      regex:
        /@(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
      methodGroup: 1,
      pathGroup: 2,
    },
  ],
  // Go (Gin, Echo, Chi)
  go: [
    // r.GET('/path', handler)
    {
      regex: /\.\s*(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\(\s*"([^"]+)"/gi,
      methodGroup: 1,
      pathGroup: 2,
    },
    // http.HandleFunc('/path', handler)
    {
      regex: /HandleFunc\s*\(\s*"([^"]+)"/gi,
      methodGroup: -1,
      pathGroup: 1,
      defaultMethod: 'ALL',
    },
  ],
  // ASP.NET
  aspnet: [
    // [HttpGet('/path')] or [HttpPost('/path')]
    {
      regex: /\[Http(Get|Post|Put|Delete|Patch)\s*\(\s*"([^"]+)"\s*\)\]/gi,
      methodGroup: 1,
      pathGroup: 2,
    },
    // [Route('/path')]
    {
      regex: /\[Route\s*\(\s*"([^"]+)"\s*\)\]/gi,
      methodGroup: -1,
      pathGroup: 1,
      defaultMethod: 'ALL',
    },
  ],
};

const FILE_PATTERNS: Record<string, string[]> = {
  express: ['**/*.ts', '**/*.js', '**/routes/**/*', '**/controllers/**/*'],
  flask: ['**/*.py'],
  fastapi: ['**/*.py'],
  go: ['**/*.go'],
  aspnet: ['**/*.cs', '**/Controllers/**/*'],
};

export class RouteIndexer {
  private workingDir: string;
  private routes: RouteIndexEntry[] = [];

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
  }

  async scan(framework?: string): Promise<RouteIndexEntry[]> {
    this.routes = [];

    // Detect framework if not specified
    const frameworks = framework ? [framework] : await this.detectFrameworks();

    for (const fw of frameworks) {
      const patterns = FILE_PATTERNS[fw] ?? ['**/*.ts', '**/*.js', '**/*.py'];
      const files = await glob(patterns, {
        cwd: this.workingDir,
        nodir: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/venv/**'],
      });

      for (const file of files) {
        await this.scanFile(file, fw);
      }
    }

    return this.routes;
  }

  private async detectFrameworks(): Promise<string[]> {
    const frameworks: string[] = [];

    try {
      // Check for package.json (Node.js)
      const pkgPath = path.join(this.workingDir, 'package.json');
      const pkgContent = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent) as { dependencies?: Record<string, string> };

      const deps = pkg.dependencies;
      if (deps !== undefined && (deps['express'] !== undefined || deps['@nestjs/core'] !== undefined)) {
        frameworks.push('express');
      }
      if (deps !== undefined && deps['fastify'] !== undefined) {
        frameworks.push('express'); // Similar patterns
      }
    } catch {
      // No package.json
    }

    try {
      // Check for requirements.txt or pyproject.toml (Python)
      const reqPath = path.join(this.workingDir, 'requirements.txt');
      const reqContent = await fs.readFile(reqPath, 'utf-8');

      if (reqContent.includes('flask')) {
        frameworks.push('flask');
      }
      if (reqContent.includes('fastapi')) {
        frameworks.push('fastapi');
      }
    } catch {
      // No requirements.txt
    }

    try {
      // Check for go.mod (Go)
      const goModPath = path.join(this.workingDir, 'go.mod');
      await fs.access(goModPath);
      frameworks.push('go');
    } catch {
      // No go.mod
    }

    try {
      // Check for *.csproj (ASP.NET)
      const csProjects = await glob('**/*.csproj', { cwd: this.workingDir, nodir: true });
      if (csProjects.length > 0) {
        frameworks.push('aspnet');
      }
    } catch {
      // No csproj
    }

    return frameworks.length > 0 ? frameworks : ['express']; // Default
  }

  private async scanFile(filePath: string, framework: string): Promise<void> {
    const patterns = ROUTE_PATTERNS[framework];
    if (!patterns) return;

    try {
      const fullPath = path.join(this.workingDir, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        if (!line) continue;

        for (const pattern of patterns) {
          pattern.regex.lastIndex = 0;
          const match = pattern.regex.exec(line);

          if (match) {
            const method =
              pattern.methodGroup === -1
                ? (pattern.defaultMethod ?? 'GET')
                : ((match[pattern.methodGroup]?.toUpperCase() as HttpMethod) ?? 'GET');

            const routePath = match[pattern.pathGroup] ?? '';
            const handler = pattern.handlerGroup ? match[pattern.handlerGroup] : undefined;

            this.routes.push({
              method,
              path: routePath,
              handler: handler ?? this.findHandler(lines, lineNum),
              file: filePath,
              line: lineNum + 1,
            });
          }
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  private findHandler(lines: string[], routeLine: number): string {
    // Look for function name in the route line or next few lines
    const searchLines = lines.slice(routeLine, routeLine + 3).join(' ');

    // Common patterns: async function name, const name =, def name(, func name(
    const handlerPatterns = [
      /async\s+(?:function\s+)?(\w+)/,
      /(?:const|let|var)\s+(\w+)\s*=/,
      /def\s+(\w+)\s*\(/,
      /func\s+(\w+)\s*\(/,
    ];

    for (const pattern of handlerPatterns) {
      const match = pattern.exec(searchLines);
      if (match?.[1]) {
        return match[1];
      }
    }

    return 'anonymous';
  }

  async saveIndex(): Promise<string> {
    const indexPath = path.join(this.workingDir, '.engineering', 'index', 'routes.yaml');
    await fs.mkdir(path.dirname(indexPath), { recursive: true });

    const content = stringify({ routes: this.routes }, { indent: 2 });
    await fs.writeFile(indexPath, content, 'utf-8');

    return indexPath;
  }

  getRoutes(): RouteIndexEntry[] {
    return this.routes;
  }

  search(query: string): RouteIndexEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.routes.filter(
      route =>
        route.path.toLowerCase().includes(lowerQuery) ||
        route.handler.toLowerCase().includes(lowerQuery) ||
        route.method.toLowerCase().includes(lowerQuery)
    );
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
    this.routes = [];
  }
}

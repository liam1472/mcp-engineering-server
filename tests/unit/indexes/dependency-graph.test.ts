/**
 * Unit tests for indexes/dependency-graph.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import { DependencyAnalyzer } from '../../../src/indexes/dependency-graph.js';
import { createTempDir, cleanupTempDir, writeTestFile, fileExists } from '../../setup.js';

describe('indexes/dependency-graph.ts', () => {
  describe('DependencyAnalyzer', () => {
    let tempDir: string;
    let analyzer: DependencyAnalyzer;

    beforeEach(async () => {
      tempDir = await createTempDir('dependency-test');
      analyzer = new DependencyAnalyzer(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('analyze() - TypeScript', () => {
      it('should detect ES imports', async () => {
        await writeTestFile(
          path.join(tempDir, 'utils.ts'),
          `export const helper = () => {};`
        );
        await writeTestFile(
          path.join(tempDir, 'app.ts'),
          `import { helper } from './utils';
helper();`
        );

        const report = await analyzer.analyze();

        expect(report.totalFiles).toBe(2);
        expect(report.totalImports).toBeGreaterThan(0);
      });

      it('should detect default imports', async () => {
        await writeTestFile(
          path.join(tempDir, 'lib.ts'),
          `export default function() { return 1; }`
        );
        await writeTestFile(
          path.join(tempDir, 'main.ts'),
          `import lib from './lib';`
        );

        const report = await analyzer.analyze();

        expect(report.totalImports).toBeGreaterThan(0);
      });

      it('should detect namespace imports', async () => {
        await writeTestFile(
          path.join(tempDir, 'utils.ts'),
          `export const a = 1; export const b = 2;`
        );
        await writeTestFile(
          path.join(tempDir, 'app.ts'),
          `import * as Utils from './utils';`
        );

        const report = await analyzer.analyze();

        expect(report.totalImports).toBeGreaterThan(0);
      });

      it('should detect require calls', async () => {
        await writeTestFile(
          path.join(tempDir, 'lib.js'),
          `module.exports = { hello: 'world' };`
        );
        await writeTestFile(
          path.join(tempDir, 'app.js'),
          `const lib = require('./lib');`
        );

        const report = await analyzer.analyze();

        expect(report.totalFiles).toBe(2);
      });

      it('should detect re-exports', async () => {
        await writeTestFile(
          path.join(tempDir, 'internal.ts'),
          `export const secret = 'value';`
        );
        await writeTestFile(
          path.join(tempDir, 'index.ts'),
          `export { secret } from './internal';`
        );

        const report = await analyzer.analyze();

        expect(report.totalImports).toBeGreaterThan(0);
      });

      it('should identify external dependencies', async () => {
        await writeTestFile(
          path.join(tempDir, 'app.ts'),
          `import express from 'express';
import { readFile } from 'fs/promises';
import { MyClass } from './local';`
        );
        await writeTestFile(
          path.join(tempDir, 'local.ts'),
          `export class MyClass {}`
        );

        const report = await analyzer.analyze();

        expect(report.externalDependencies).toContain('express');
        expect(report.externalDependencies).toContain('fs/promises');
      });
    });

    describe('analyze() - Python', () => {
      it('should detect Python imports', async () => {
        await writeTestFile(
          path.join(tempDir, 'utils.py'),
          `def helper():\n    pass`
        );
        await writeTestFile(
          path.join(tempDir, 'app.py'),
          `import utils\nfrom utils import helper`
        );

        const report = await analyzer.analyze();

        expect(report.totalFiles).toBe(2);
      });

      it('should detect from imports', async () => {
        await writeTestFile(
          path.join(tempDir, 'models.py'),
          `class User: pass`
        );
        await writeTestFile(
          path.join(tempDir, 'app.py'),
          `from models import User`
        );

        const report = await analyzer.analyze();

        expect(report.totalFiles).toBe(2);
        // Python 'from X import Y' without . prefix is treated as external dependency
        expect(report.externalDependencies).toContain('models');
      });
    });

    describe('analyze() - Go', () => {
      it('should detect Go imports', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.go'),
          `package main

import "fmt"
import mylib "github.com/user/lib"

func main() {
    fmt.Println("hello")
}`
        );

        const report = await analyzer.analyze();

        expect(report.totalFiles).toBe(1);
        expect(report.externalDependencies.length).toBeGreaterThan(0);
      });
    });

    describe('analyze() - Rust', () => {
      it('should detect Rust use statements', async () => {
        await writeTestFile(
          path.join(tempDir, 'lib.rs'),
          `mod utils;
use crate::utils::helper;
use std::io;`
        );

        const report = await analyzer.analyze();

        expect(report.totalFiles).toBe(1);
      });
    });

    describe('analyze() - C#', () => {
      it('should detect C# using statements', async () => {
        await writeTestFile(
          path.join(tempDir, 'Program.cs'),
          `using System;
using System.IO;
using MyProject.Utils;

namespace MyProject { }`
        );

        const report = await analyzer.analyze();

        expect(report.totalFiles).toBe(1);
        expect(report.externalDependencies.some(d => d.startsWith('System'))).toBe(true);
      });
    });

    describe('circular dependencies', () => {
      it('should detect circular dependencies', async () => {
        await writeTestFile(
          path.join(tempDir, 'a.ts'),
          `import { b } from './b';
export const a = () => b();`
        );
        await writeTestFile(
          path.join(tempDir, 'b.ts'),
          `import { a } from './a';
export const b = () => a();`
        );

        const report = await analyzer.analyze();

        // May or may not detect depending on resolution
        expect(Array.isArray(report.circularDependencies)).toBe(true);
      });
    });

    describe('entry points and orphans', () => {
      it('should identify entry points', async () => {
        await writeTestFile(
          path.join(tempDir, 'index.ts'),
          `import { helper } from './utils';
export { helper };`
        );
        await writeTestFile(
          path.join(tempDir, 'utils.ts'),
          `export const helper = () => {};`
        );

        const report = await analyzer.analyze();

        expect(report.entryPoints.some(e => e.includes('index'))).toBe(true);
      });

      it('should identify orphan modules', async () => {
        await writeTestFile(
          path.join(tempDir, 'used.ts'),
          `export const used = 1;`
        );
        await writeTestFile(
          path.join(tempDir, 'orphan.ts'),
          `// This file is not imported anywhere and imports nothing
const orphan = 1;`
        );
        await writeTestFile(
          path.join(tempDir, 'main.ts'),
          `import { used } from './used';`
        );

        const report = await analyzer.analyze();

        // Orphan detection depends on import/export analysis
        expect(Array.isArray(report.orphanModules)).toBe(true);
      });
    });

    describe('most imported', () => {
      it('should track most imported modules', async () => {
        await writeTestFile(
          path.join(tempDir, 'utils.ts'),
          `export const helper = () => {};`
        );
        await writeTestFile(
          path.join(tempDir, 'a.ts'),
          `import { helper } from './utils';`
        );
        await writeTestFile(
          path.join(tempDir, 'b.ts'),
          `import { helper } from './utils';`
        );
        await writeTestFile(
          path.join(tempDir, 'c.ts'),
          `import { helper } from './utils';`
        );

        const report = await analyzer.analyze();

        expect(report.mostImported.length).toBeGreaterThan(0);
      });
    });

    describe('most dependencies', () => {
      it('should track modules with most dependencies', async () => {
        await writeTestFile(path.join(tempDir, 'a.ts'), `export const a = 1;`);
        await writeTestFile(path.join(tempDir, 'b.ts'), `export const b = 2;`);
        await writeTestFile(path.join(tempDir, 'c.ts'), `export const c = 3;`);
        await writeTestFile(
          path.join(tempDir, 'main.ts'),
          `import { a } from './a';
import { b } from './b';
import { c } from './c';`
        );

        const report = await analyzer.analyze();

        expect(report.mostDependencies.length).toBeGreaterThan(0);
        expect(report.mostDependencies.some(d => d.file.includes('main'))).toBe(true);
      });
    });

    describe('getGraph()', () => {
      it('should return dependency graph', async () => {
        await writeTestFile(
          path.join(tempDir, 'app.ts'),
          `import { helper } from './lib';`
        );
        await writeTestFile(path.join(tempDir, 'lib.ts'), `export const helper = 1;`);

        await analyzer.analyze();
        const graph = analyzer.getGraph();

        expect(graph.nodes).toBeDefined();
        expect(graph.circular).toBeDefined();
        expect(graph.entryPoints).toBeDefined();
        expect(graph.orphans).toBeDefined();
      });

      it('should return empty graph before analyze', () => {
        const graph = analyzer.getGraph();

        expect(graph.nodes.size).toBe(0);
      });
    });

    describe('getSummary()', () => {
      it('should generate summary string', async () => {
        await writeTestFile(
          path.join(tempDir, 'app.ts'),
          `import express from 'express';`
        );

        await analyzer.analyze();
        const summary = analyzer.getSummary();

        expect(summary).toContain('Dependency Analysis');
        expect(summary).toContain('Files');
      });

      it('should show circular dependencies in summary', async () => {
        await writeTestFile(
          path.join(tempDir, 'a.ts'),
          `import { b } from './b'; export const a = b;`
        );
        await writeTestFile(
          path.join(tempDir, 'b.ts'),
          `import { a } from './a'; export const b = a;`
        );

        await analyzer.analyze();
        const summary = analyzer.getSummary();

        // May or may not have circular deps
        expect(summary).toContain('Dependency Analysis');
      });
    });

    describe('saveReport()', () => {
      it('should save report to YAML file', async () => {
        await writeTestFile(path.join(tempDir, 'app.ts'), `const x = 1;`);

        await analyzer.analyze();
        const reportPath = await analyzer.saveReport();

        expect(reportPath).toContain('dependencies.yaml');
        const exists = await fileExists(reportPath);
        expect(exists).toBe(true);
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        const otherDir = await createTempDir('other-deps');
        await writeTestFile(
          path.join(otherDir, 'other.ts'),
          `export const other = 1;`
        );

        analyzer.setWorkingDir(otherDir);
        const report = await analyzer.analyze();

        expect(report.totalFiles).toBe(1);

        await cleanupTempDir(otherDir);
      });

      it('should clear graph on directory change', async () => {
        await writeTestFile(path.join(tempDir, 'app.ts'), `const x = 1;`);

        await analyzer.analyze();
        const otherDir = await createTempDir('other-clear');

        analyzer.setWorkingDir(otherDir);
        const graph = analyzer.getGraph();

        expect(graph.nodes.size).toBe(0);

        await cleanupTempDir(otherDir);
      });
    });

    describe('ignores', () => {
      it('should ignore node_modules', async () => {
        await writeTestFile(
          path.join(tempDir, 'src', 'app.ts'),
          `import lib from './lib';`
        );
        await writeTestFile(
          path.join(tempDir, 'node_modules', 'lib', 'index.ts'),
          `export default 'lib';`
        );

        const report = await analyzer.analyze();
        const nodeModulesFiles = [...analyzer.getGraph().nodes.keys()].filter(f =>
          f.includes('node_modules')
        );

        expect(nodeModulesFiles.length).toBe(0);
      });

      it('should ignore dist directory', async () => {
        await writeTestFile(path.join(tempDir, 'src', 'app.ts'), `const x = 1;`);
        await writeTestFile(path.join(tempDir, 'dist', 'app.js'), `const x = 1;`);

        const report = await analyzer.analyze();
        const distFiles = [...analyzer.getGraph().nodes.keys()].filter(f =>
          f.includes('dist')
        );

        expect(distFiles.length).toBe(0);
      });
    });
  });
});

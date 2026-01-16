/**
 * Unit tests for indexes/function-indexer.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import { FunctionIndexer } from '../../../src/indexes/function-indexer.js';
import {
  createTempDir,
  cleanupTempDir,
  writeTestFile,
  getCodeSamplePath,
  readTestFile,
  fileExists,
} from '../../setup.js';

describe('indexes/function-indexer.ts', () => {
  describe('FunctionIndexer', () => {
    let tempDir: string;
    let indexer: FunctionIndexer;

    beforeEach(async () => {
      tempDir = await createTempDir('indexer-test');
      indexer = new FunctionIndexer(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('scanFile() - TypeScript', () => {
      it('should index function declarations', async () => {
        await writeTestFile(
          path.join(tempDir, 'funcs.ts'),
          `export function calculateSum(a: number, b: number): number {
  return a + b;
}`
        );

        const entries = await indexer.scanFile('funcs.ts');

        expect(entries.length).toBeGreaterThan(0);
        expect(entries.some(e => e.name === 'calculateSum')).toBe(true);
      });

      it('should index async functions', async () => {
        await writeTestFile(
          path.join(tempDir, 'async.ts'),
          `async function fetchData(url: string): Promise<Response> {
  return fetch(url);
}`
        );

        const entries = await indexer.scanFile('async.ts');

        expect(entries.some(e => e.name === 'fetchData')).toBe(true);
      });

      it('should index arrow functions', async () => {
        await writeTestFile(
          path.join(tempDir, 'arrow.ts'),
          `export const multiply = (x: number, y: number): number => x * y;`
        );

        const entries = await indexer.scanFile('arrow.ts');

        expect(entries.some(e => e.name === 'multiply')).toBe(true);
      });

      it('should capture return type', async () => {
        await writeTestFile(
          path.join(tempDir, 'return.ts'),
          `function getValue(): string { return 'test'; }`
        );

        const entries = await indexer.scanFile('return.ts');
        const entry = entries.find(e => e.name === 'getValue');

        // Return type might be captured differently depending on regex
        expect(entry).toBeDefined();
        // Check that the signature at least contains the return type
        expect(entry?.signature).toContain('string');
      });

      it('should capture parameters', async () => {
        await writeTestFile(
          path.join(tempDir, 'params.ts'),
          `function process(name: string, count: number): void { }`
        );

        const entries = await indexer.scanFile('params.ts');
        const entry = entries.find(e => e.name === 'process');

        expect(entry?.parameters.length).toBe(2);
        expect(entry?.parameters[0]?.name).toBe('name');
      });

      it('should include line number', async () => {
        await writeTestFile(
          path.join(tempDir, 'lines.ts'),
          `// Line 1
// Line 2
function onLineThree() { }
// Line 4
function onLineFive() { }`
        );

        const entries = await indexer.scanFile('lines.ts');
        const entry3 = entries.find(e => e.name === 'onLineThree');
        const entry5 = entries.find(e => e.name === 'onLineFive');

        expect(entry3?.line).toBe(3);
        expect(entry5?.line).toBe(5);
      });
    });

    describe('scanFile() - Python', () => {
      it('should index def functions', async () => {
        await writeTestFile(
          path.join(tempDir, 'funcs.py'),
          `def calculate_sum(a, b):
    return a + b`
        );

        const entries = await indexer.scanFile('funcs.py');

        expect(entries.some(e => e.name === 'calculate_sum')).toBe(true);
      });

      it('should index async def functions', async () => {
        await writeTestFile(
          path.join(tempDir, 'async.py'),
          `async def fetch_data(url):
    return await aiohttp.get(url)`
        );

        const entries = await indexer.scanFile('async.py');

        expect(entries.some(e => e.name === 'fetch_data')).toBe(true);
      });

      it('should capture return type hint', async () => {
        await writeTestFile(
          path.join(tempDir, 'typed.py'),
          `def get_value() -> str:
    return "test"`
        );

        const entries = await indexer.scanFile('typed.py');
        const entry = entries.find(e => e.name === 'get_value');

        expect(entry?.returnType).toContain('str');
      });
    });

    describe('scanFile() - Go', () => {
      it('should index func declarations', async () => {
        await writeTestFile(
          path.join(tempDir, 'funcs.go'),
          `func CalculateSum(a int, b int) int {
    return a + b
}`
        );

        const entries = await indexer.scanFile('funcs.go');

        expect(entries.some(e => e.name === 'CalculateSum')).toBe(true);
      });

      it('should index method receivers', async () => {
        await writeTestFile(
          path.join(tempDir, 'methods.go'),
          `func (c *Calculator) Add(n int) *Calculator {
    c.value += n
    return c
}`
        );

        const entries = await indexer.scanFile('methods.go');

        expect(entries.some(e => e.name === 'Add')).toBe(true);
      });
    });

    describe('scanFile() - Rust', () => {
      it('should index fn declarations', async () => {
        await writeTestFile(
          path.join(tempDir, 'funcs.rs'),
          `pub fn calculate_sum(a: i32, b: i32) -> i32 {
    a + b
}`
        );

        const entries = await indexer.scanFile('funcs.rs');

        expect(entries.some(e => e.name === 'calculate_sum')).toBe(true);
      });

      it('should index async fn', async () => {
        await writeTestFile(
          path.join(tempDir, 'async.rs'),
          `pub async fn fetch_data(url: &str) -> Result<String, Error> {
    Ok(String::new())
}`
        );

        const entries = await indexer.scanFile('async.rs');

        expect(entries.some(e => e.name === 'fetch_data')).toBe(true);
      });
    });

    describe('scanFile() - C/C++', () => {
      it('should index C functions', async () => {
        await writeTestFile(
          path.join(tempDir, 'funcs.c'),
          `int calculate_sum(int a, int b) {
    return a + b;
}`
        );

        const entries = await indexer.scanFile('funcs.c');

        expect(entries.some(e => e.name === 'calculate_sum')).toBe(true);
      });

      it('should index C++ functions', async () => {
        await writeTestFile(
          path.join(tempDir, 'funcs.cpp'),
          `int calculateSum(int a, int b) {
    return a + b;
}`
        );

        const entries = await indexer.scanFile('funcs.cpp');

        expect(entries.some(e => e.name === 'calculateSum')).toBe(true);
      });
    });

    describe('scanFile() - C#', () => {
      it('should index public methods', async () => {
        await writeTestFile(
          path.join(tempDir, 'funcs.cs'),
          `public int CalculateSum(int a, int b) {
    return a + b;
}`
        );

        const entries = await indexer.scanFile('funcs.cs');

        expect(entries.some(e => e.name === 'CalculateSum')).toBe(true);
      });

      it('should index static methods', async () => {
        await writeTestFile(
          path.join(tempDir, 'static.cs'),
          `public static Calculator Create(double initial) {
    return new Calculator(initial);
}`
        );

        const entries = await indexer.scanFile('static.cs');

        expect(entries.some(e => e.name === 'Create')).toBe(true);
      });
    });

    describe('scan()', () => {
      it('should scan all files in directory', async () => {
        await writeTestFile(
          path.join(tempDir, 'a.ts'),
          `function funcA() { }`
        );
        await writeTestFile(
          path.join(tempDir, 'b.ts'),
          `function funcB() { }`
        );
        await writeTestFile(
          path.join(tempDir, 'c.py'),
          `def func_c():
    pass`
        );

        const entries = await indexer.scan();

        expect(entries.length).toBeGreaterThanOrEqual(3);
        expect(entries.some(e => e.name === 'funcA')).toBe(true);
        expect(entries.some(e => e.name === 'funcB')).toBe(true);
        expect(entries.some(e => e.name === 'func_c')).toBe(true);
      });

      it('should ignore node_modules', async () => {
        await writeTestFile(
          path.join(tempDir, 'src', 'app.ts'),
          `function appFunc() { }`
        );
        await writeTestFile(
          path.join(tempDir, 'node_modules', 'lib', 'index.ts'),
          `function libFunc() { }`
        );

        const entries = await indexer.scan();

        expect(entries.some(e => e.name === 'appFunc')).toBe(true);
        expect(entries.some(e => e.name === 'libFunc')).toBe(false);
      });

      it('should ignore dist directory', async () => {
        await writeTestFile(
          path.join(tempDir, 'src', 'app.ts'),
          `function srcFunc() { }`
        );
        await writeTestFile(
          path.join(tempDir, 'dist', 'app.js'),
          `function distFunc() { }`
        );

        const entries = await indexer.scan();

        expect(entries.some(e => e.name === 'srcFunc')).toBe(true);
        expect(entries.some(e => e.name === 'distFunc')).toBe(false);
      });
    });

    describe('search()', () => {
      it('should find functions by name', async () => {
        await writeTestFile(
          path.join(tempDir, 'funcs.ts'),
          `function calculateSum() { }
function calculateProduct() { }
function getValue() { }`
        );

        await indexer.scan();
        const results = indexer.search('calculate');

        // Should find at least the two calculate* functions
        expect(results.length).toBeGreaterThanOrEqual(2);
        expect(results.some(r => r.name === 'calculateSum')).toBe(true);
        expect(results.some(r => r.name === 'calculateProduct')).toBe(true);
      });

      it('should be case-insensitive', async () => {
        await writeTestFile(
          path.join(tempDir, 'funcs.ts'),
          `function CalculateSum() { }`
        );

        await indexer.scan();
        const results = indexer.search('calculate');

        // Should find at least one function
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results.some(r => r.name === 'CalculateSum')).toBe(true);
      });

      it('should search in signature', async () => {
        await writeTestFile(
          path.join(tempDir, 'funcs.ts'),
          `function process(data: string): void { }`
        );

        await indexer.scan();
        const results = indexer.search('string');

        expect(results.some(r => r.name === 'process')).toBe(true);
      });
    });

    describe('saveIndex()', () => {
      it('should save index to YAML file', async () => {
        await writeTestFile(
          path.join(tempDir, 'funcs.ts'),
          `function testFunc() { }`
        );

        await indexer.scan();
        await indexer.saveIndex();

        const indexPath = path.join(tempDir, '.engineering', 'index', 'functions.yaml');
        const exists = await fileExists(indexPath);

        expect(exists).toBe(true);
      });
    });

    describe('with fixtures', () => {
      it('should index TypeScript fixture', async () => {
        const fixturePath = getCodeSamplePath('typescript', 'functions.ts');
        const content = await readTestFile(fixturePath);
        await writeTestFile(path.join(tempDir, 'functions.ts'), content);

        const entries = await indexer.scan();

        expect(entries.length).toBeGreaterThan(5);
        expect(entries.some(e => e.name === 'calculateSum')).toBe(true);
        expect(entries.some(e => e.name === 'multiply')).toBe(true);
      });

      it('should index Python fixture', async () => {
        const fixturePath = getCodeSamplePath('python', 'functions.py');
        const content = await readTestFile(fixturePath);
        await writeTestFile(path.join(tempDir, 'functions.py'), content);

        const entries = await indexer.scan();

        expect(entries.length).toBeGreaterThan(5);
        expect(entries.some(e => e.name === 'calculate_sum')).toBe(true);
      });

      it('should index Go fixture', async () => {
        const fixturePath = getCodeSamplePath('go', 'functions.go');
        const content = await readTestFile(fixturePath);
        await writeTestFile(path.join(tempDir, 'functions.go'), content);

        const entries = await indexer.scan();

        expect(entries.length).toBeGreaterThan(5);
        expect(entries.some(e => e.name === 'CalculateSum')).toBe(true);
      });

      it('should index Rust fixture', async () => {
        const fixturePath = getCodeSamplePath('rust', 'functions.rs');
        const content = await readTestFile(fixturePath);
        await writeTestFile(path.join(tempDir, 'functions.rs'), content);

        const entries = await indexer.scan();

        expect(entries.length).toBeGreaterThan(5);
        expect(entries.some(e => e.name === 'calculate_sum')).toBe(true);
      });
    });
  });
});

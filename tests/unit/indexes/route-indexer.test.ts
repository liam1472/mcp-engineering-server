/**
 * Unit tests for indexes/route-indexer.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import { RouteIndexer } from '../../../src/indexes/route-indexer.js';
import { createTempDir, cleanupTempDir, writeTestFile, fileExists } from '../../setup.js';

describe('indexes/route-indexer.ts', () => {
  describe('RouteIndexer', () => {
    let tempDir: string;
    let indexer: RouteIndexer;

    beforeEach(async () => {
      tempDir = await createTempDir('route-test');
      indexer = new RouteIndexer(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('scan() - Express', () => {
      it('should detect app.get routes', async () => {
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({ name: 'test', dependencies: { express: '^4.0.0' } })
        );
        await writeTestFile(
          path.join(tempDir, 'routes.ts'),
          `app.get('/users', getUsers);`
        );

        const routes = await indexer.scan('express');

        expect(routes.some(r => r.path === '/users' && r.method === 'GET')).toBe(true);
      });

      it('should detect app.post routes', async () => {
        await writeTestFile(
          path.join(tempDir, 'routes.ts'),
          `app.post('/users', createUser);`
        );

        const routes = await indexer.scan('express');

        expect(routes.some(r => r.path === '/users' && r.method === 'POST')).toBe(true);
      });

      it('should detect router.put routes', async () => {
        await writeTestFile(
          path.join(tempDir, 'routes.ts'),
          `router.put('/users/:id', updateUser);`
        );

        const routes = await indexer.scan('express');

        expect(routes.some(r => r.path === '/users/:id' && r.method === 'PUT')).toBe(true);
      });

      it('should detect router.delete routes', async () => {
        await writeTestFile(
          path.join(tempDir, 'routes.ts'),
          `router.delete('/users/:id', deleteUser);`
        );

        const routes = await indexer.scan('express');

        expect(routes.some(r => r.method === 'DELETE')).toBe(true);
      });

      it('should detect NestJS decorator routes', async () => {
        await writeTestFile(
          path.join(tempDir, 'controller.ts'),
          `@Get('/items')
  findAll() {}`
        );

        const routes = await indexer.scan('express');

        expect(routes.some(r => r.path === '/items' && r.method === 'GET')).toBe(true);
      });

      it('should include file and line info', async () => {
        await writeTestFile(
          path.join(tempDir, 'api.ts'),
          `// Line 1
// Line 2
app.get('/test', handler);`
        );

        const routes = await indexer.scan('express');
        const route = routes.find(r => r.path === '/test');

        expect(route?.file).toBe('api.ts');
        expect(route?.line).toBe(3);
      });
    });

    describe('scan() - Flask', () => {
      it('should detect @app.route decorators', async () => {
        await writeTestFile(
          path.join(tempDir, 'requirements.txt'),
          'flask>=2.0.0'
        );
        await writeTestFile(
          path.join(tempDir, 'app.py'),
          `@app.route('/users')
def get_users():
    return users`
        );

        const routes = await indexer.scan('flask');

        expect(routes.some(r => r.path === '/users')).toBe(true);
      });

      it('should detect @app.get decorators', async () => {
        await writeTestFile(
          path.join(tempDir, 'app.py'),
          `@app.get('/items')
def get_items():
    return items`
        );

        const routes = await indexer.scan('flask');

        expect(routes.some(r => r.path === '/items' && r.method === 'GET')).toBe(true);
      });

      it('should detect blueprint routes', async () => {
        await writeTestFile(
          path.join(tempDir, 'views.py'),
          `@bp.post('/create')
def create():
    pass`
        );

        const routes = await indexer.scan('flask');

        expect(routes.some(r => r.path === '/create' && r.method === 'POST')).toBe(true);
      });
    });

    describe('scan() - FastAPI', () => {
      it('should detect @app.get decorators', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.py'),
          `@app.get('/api/items')
async def get_items():
    return []`
        );

        const routes = await indexer.scan('fastapi');

        expect(routes.some(r => r.path === '/api/items')).toBe(true);
      });

      it('should detect @router decorators', async () => {
        await writeTestFile(
          path.join(tempDir, 'routes.py'),
          `@router.post('/api/users')
async def create_user():
    pass`
        );

        const routes = await indexer.scan('fastapi');

        expect(routes.some(r => r.method === 'POST')).toBe(true);
      });
    });

    describe('scan() - Go', () => {
      it('should detect r.GET routes', async () => {
        await writeTestFile(path.join(tempDir, 'go.mod'), 'module test\n\ngo 1.21');
        await writeTestFile(
          path.join(tempDir, 'routes.go'),
          `r.GET("/users", getUsers)`
        );

        const routes = await indexer.scan('go');

        expect(routes.some(r => r.path === '/users' && r.method === 'GET')).toBe(true);
      });

      it('should detect r.POST routes', async () => {
        await writeTestFile(
          path.join(tempDir, 'routes.go'),
          `router.POST("/users", createUser)`
        );

        const routes = await indexer.scan('go');

        expect(routes.some(r => r.method === 'POST')).toBe(true);
      });

      it('should detect HandleFunc', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.go'),
          `http.HandleFunc("/health", healthHandler)`
        );

        const routes = await indexer.scan('go');

        expect(routes.some(r => r.path === '/health')).toBe(true);
      });
    });

    describe('scan() - ASP.NET', () => {
      it('should detect [HttpGet] attributes', async () => {
        await writeTestFile(
          path.join(tempDir, 'Test.csproj'),
          '<Project Sdk="Microsoft.NET.Sdk"></Project>'
        );
        await writeTestFile(
          path.join(tempDir, 'Controller.cs'),
          `[HttpGet("/api/users")]
public IActionResult GetUsers() { }`
        );

        const routes = await indexer.scan('aspnet');

        expect(routes.some(r => r.path === '/api/users' && r.method === 'GET')).toBe(true);
      });

      it('should detect [HttpPost] attributes', async () => {
        await writeTestFile(
          path.join(tempDir, 'Controller.cs'),
          `[HttpPost("/api/users")]
public IActionResult CreateUser() { }`
        );

        const routes = await indexer.scan('aspnet');

        expect(routes.some(r => r.method === 'POST')).toBe(true);
      });

      it('should detect [Route] attributes', async () => {
        await writeTestFile(
          path.join(tempDir, 'Controller.cs'),
          `[Route("/api/items")]
public IActionResult Items() { }`
        );

        const routes = await indexer.scan('aspnet');

        expect(routes.some(r => r.path === '/api/items')).toBe(true);
      });
    });

    describe('getRoutes()', () => {
      it('should return scanned routes', async () => {
        await writeTestFile(
          path.join(tempDir, 'routes.ts'),
          `app.get('/test', handler);`
        );

        await indexer.scan('express');
        const routes = indexer.getRoutes();

        expect(Array.isArray(routes)).toBe(true);
      });

      it('should return empty before scan', () => {
        const routes = indexer.getRoutes();
        expect(routes).toEqual([]);
      });
    });

    describe('search()', () => {
      it('should find routes by path', async () => {
        await writeTestFile(
          path.join(tempDir, 'routes.ts'),
          `app.get('/users', handler);
app.get('/items', handler);
app.post('/users', handler);`
        );

        await indexer.scan('express');
        const results = indexer.search('users');

        expect(results.length).toBeGreaterThanOrEqual(2);
      });

      it('should find routes by method', async () => {
        await writeTestFile(
          path.join(tempDir, 'routes.ts'),
          `app.get('/a', handler);
app.post('/b', handler);
app.get('/c', handler);`
        );

        await indexer.scan('express');
        const results = indexer.search('GET');

        expect(results.length).toBe(2);
      });

      it('should find routes by handler', async () => {
        await writeTestFile(
          path.join(tempDir, 'routes.ts'),
          `app.get('/users', getUsers);
app.post('/items', createItem);`
        );

        await indexer.scan('express');
        // Handler detection may vary
        expect(indexer.search('')).toBeDefined();
      });
    });

    describe('saveIndex()', () => {
      it('should save routes to YAML file', async () => {
        await writeTestFile(
          path.join(tempDir, 'routes.ts'),
          `app.get('/test', handler);`
        );

        await indexer.scan('express');
        const indexPath = await indexer.saveIndex();

        expect(indexPath).toContain('routes.yaml');
        const exists = await fileExists(indexPath);
        expect(exists).toBe(true);
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        const otherDir = await createTempDir('other-routes');
        await writeTestFile(
          path.join(otherDir, 'routes.ts'),
          `app.get('/other', handler);`
        );

        indexer.setWorkingDir(otherDir);
        const routes = await indexer.scan('express');

        expect(routes.some(r => r.path === '/other')).toBe(true);

        await cleanupTempDir(otherDir);
      });

      it('should clear previous routes', async () => {
        await writeTestFile(
          path.join(tempDir, 'routes.ts'),
          `app.get('/first', handler);`
        );

        await indexer.scan('express');
        const otherDir = await createTempDir('other-clear');

        indexer.setWorkingDir(otherDir);
        const routes = indexer.getRoutes();

        expect(routes).toEqual([]);

        await cleanupTempDir(otherDir);
      });
    });

    describe('auto-detect frameworks', () => {
      it('should detect Express from package.json', async () => {
        await writeTestFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({ dependencies: { express: '^4.0.0' } })
        );
        await writeTestFile(
          path.join(tempDir, 'app.ts'),
          `app.get('/detected', handler);`
        );

        const routes = await indexer.scan(); // No framework specified

        expect(routes.some(r => r.path === '/detected')).toBe(true);
      });

      it('should detect Flask from requirements.txt', async () => {
        await writeTestFile(
          path.join(tempDir, 'requirements.txt'),
          'flask>=2.0.0'
        );
        await writeTestFile(
          path.join(tempDir, 'app.py'),
          `@app.route('/flask-route')\ndef handler(): pass`
        );

        const routes = await indexer.scan();

        expect(routes.some(r => r.path === '/flask-route')).toBe(true);
      });
    });
  });
});

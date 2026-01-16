/**
 * Unit tests for types/index.ts - Zod schemas
 */

/// <reference types="vitest/globals" />
import {
  ProjectTypeSchema,
  SessionStateSchema,
  SecurityFindingSchema,
  FunctionIndexEntrySchema,
  EngConfigSchema,
  KnowledgeEntrySchema,
  KnowledgeBaseSchema,
  DuplicateBlockSchema,
  RouteIndexEntrySchema,
  HardwareConfigSchema,
} from '../../../src/types/index.js';

describe('types/index.ts', () => {
  describe('ProjectTypeSchema', () => {
    it('should accept valid embedded project types', () => {
      expect(ProjectTypeSchema.parse('embedded-stm32')).toBe('embedded-stm32');
      expect(ProjectTypeSchema.parse('embedded-esp32')).toBe('embedded-esp32');
      expect(ProjectTypeSchema.parse('embedded-zephyr')).toBe('embedded-zephyr');
      expect(ProjectTypeSchema.parse('embedded-arduino')).toBe('embedded-arduino');
    });

    it('should accept valid dotnet project types', () => {
      expect(ProjectTypeSchema.parse('dotnet-aspnet')).toBe('dotnet-aspnet');
      expect(ProjectTypeSchema.parse('dotnet-wpf')).toBe('dotnet-wpf');
      expect(ProjectTypeSchema.parse('dotnet-maui')).toBe('dotnet-maui');
      expect(ProjectTypeSchema.parse('dotnet-blazor')).toBe('dotnet-blazor');
      expect(ProjectTypeSchema.parse('dotnet-console')).toBe('dotnet-console');
    });

    it('should accept valid web project types', () => {
      expect(ProjectTypeSchema.parse('web-react')).toBe('web-react');
      expect(ProjectTypeSchema.parse('web-vue')).toBe('web-vue');
      expect(ProjectTypeSchema.parse('web-angular')).toBe('web-angular');
      expect(ProjectTypeSchema.parse('web-nextjs')).toBe('web-nextjs');
      expect(ProjectTypeSchema.parse('web-node')).toBe('web-node');
    });

    it('should accept valid native project types', () => {
      expect(ProjectTypeSchema.parse('native-cmake')).toBe('native-cmake');
      expect(ProjectTypeSchema.parse('native-rust')).toBe('native-rust');
      expect(ProjectTypeSchema.parse('native-go')).toBe('native-go');
    });

    it('should accept valid python project types', () => {
      expect(ProjectTypeSchema.parse('python-django')).toBe('python-django');
      expect(ProjectTypeSchema.parse('python-flask')).toBe('python-flask');
      expect(ProjectTypeSchema.parse('python-general')).toBe('python-general');
    });

    it('should accept unknown type', () => {
      expect(ProjectTypeSchema.parse('unknown')).toBe('unknown');
    });

    it('should reject invalid project types', () => {
      expect(() => ProjectTypeSchema.parse('invalid')).toThrow();
      expect(() => ProjectTypeSchema.parse('')).toThrow();
      expect(() => ProjectTypeSchema.parse(123)).toThrow();
    });
  });

  describe('SessionStateSchema', () => {
    it('should parse valid session state', () => {
      const validState = {
        id: 'session-123',
        projectType: 'web-node',
        currentTask: 'Implementing feature X',
        decisions: ['Use TypeScript', 'Use ESM modules'],
        findings: ['Found security issue'],
        blockers: [],
        nextSteps: ['Write tests'],
        lastUpdated: '2024-01-15T10:30:00.000Z',
      };

      const result = SessionStateSchema.parse(validState);
      expect(result.id).toBe('session-123');
      expect(result.projectType).toBe('web-node');
      expect(result.decisions).toHaveLength(2);
    });

    it('should allow optional currentTask', () => {
      const state = {
        id: 'session-456',
        projectType: 'native-rust',
        decisions: [],
        findings: [],
        blockers: [],
        nextSteps: [],
        lastUpdated: '2024-01-15T10:30:00.000Z',
      };

      const result = SessionStateSchema.parse(state);
      expect(result.currentTask).toBeUndefined();
    });

    it('should reject invalid datetime format', () => {
      const state = {
        id: 'session-789',
        projectType: 'web-node',
        decisions: [],
        findings: [],
        blockers: [],
        nextSteps: [],
        lastUpdated: 'invalid-date',
      };

      expect(() => SessionStateSchema.parse(state)).toThrow();
    });
  });

  describe('SecurityFindingSchema', () => {
    it('should parse valid security finding', () => {
      const finding = {
        type: 'secret',
        severity: 'critical',
        file: 'src/config.ts',
        line: 42,
        pattern: 'AWS_ACCESS_KEY_ID',
        match: 'AKIAIOSFODNN7EXAMPLE',
        suggestion: 'Move to environment variable',
      };

      const result = SecurityFindingSchema.parse(finding);
      expect(result.type).toBe('secret');
      expect(result.severity).toBe('critical');
      expect(result.line).toBe(42);
    });

    it('should accept all valid types', () => {
      const types = ['secret', 'credential', 'key', 'token', 'password', 'pii'];
      types.forEach(type => {
        const finding = {
          type,
          severity: 'high',
          file: 'test.ts',
          line: 1,
          pattern: 'test',
          match: 'value',
          suggestion: 'fix it',
        };
        expect(SecurityFindingSchema.parse(finding).type).toBe(type);
      });
    });

    it('should accept all valid severities', () => {
      const severities = ['critical', 'high', 'medium', 'low'];
      severities.forEach(severity => {
        const finding = {
          type: 'secret',
          severity,
          file: 'test.ts',
          line: 1,
          pattern: 'test',
          match: 'value',
          suggestion: 'fix it',
        };
        expect(SecurityFindingSchema.parse(finding).severity).toBe(severity);
      });
    });
  });

  describe('FunctionIndexEntrySchema', () => {
    it('should parse valid function entry', () => {
      const entry = {
        name: 'calculateSum',
        file: 'src/math.ts',
        line: 10,
        signature: 'function calculateSum(a: number, b: number): number',
        returnType: 'number',
        parameters: [
          { name: 'a', type: 'number' },
          { name: 'b', type: 'number' },
        ],
        description: 'Adds two numbers',
      };

      const result = FunctionIndexEntrySchema.parse(entry);
      expect(result.name).toBe('calculateSum');
      expect(result.parameters).toHaveLength(2);
    });

    it('should allow optional fields', () => {
      const entry = {
        name: 'doSomething',
        file: 'src/utils.ts',
        line: 5,
        signature: 'function doSomething()',
        parameters: [],
      };

      const result = FunctionIndexEntrySchema.parse(entry);
      expect(result.returnType).toBeUndefined();
      expect(result.description).toBeUndefined();
    });

    it('should allow parameters without type', () => {
      const entry = {
        name: 'process',
        file: 'src/index.ts',
        line: 1,
        signature: 'function process(data)',
        parameters: [{ name: 'data' }],
      };

      const result = FunctionIndexEntrySchema.parse(entry);
      expect(result.parameters[0]?.type).toBeUndefined();
    });
  });

  describe('EngConfigSchema', () => {
    it('should parse valid config', () => {
      const config = {
        version: '1.0.0',
        projectType: 'web-node',
        projectName: 'my-project',
        autoSaveInterval: 600,
        security: {
          enabled: true,
          customPatterns: ['MY_SECRET_\\w+'],
          whitelist: ['test.ts'],
        },
        indexes: {
          functions: true,
          errors: true,
          constants: false,
          dependencies: true,
        },
      };

      const result = EngConfigSchema.parse(config);
      expect(result.projectName).toBe('my-project');
      expect(result.autoSaveInterval).toBe(600);
    });

    it('should apply default values', () => {
      const config = {
        version: '1.0.0',
        projectType: 'native-rust',
        projectName: 'rust-app',
        security: {},
        indexes: {},
      };

      const result = EngConfigSchema.parse(config);
      expect(result.autoSaveInterval).toBe(300);
      expect(result.security.enabled).toBe(true);
      expect(result.security.customPatterns).toEqual([]);
      expect(result.indexes.functions).toBe(true);
    });
  });

  describe('KnowledgeEntrySchema', () => {
    it('should parse valid knowledge entry', () => {
      const entry = {
        id: 'knowledge-001',
        type: 'pattern',
        title: 'Error Handling Pattern',
        content: 'Use try-catch with specific error types',
        tags: ['error', 'pattern', 'typescript'],
        source: {
          feature: 'error-handling',
          files: ['src/errors.ts'],
          date: '2024-01-15',
        },
      };

      const result = KnowledgeEntrySchema.parse(entry);
      expect(result.type).toBe('pattern');
      expect(result.tags).toHaveLength(3);
    });

    it('should accept all valid types', () => {
      const types = ['pattern', 'solution', 'bug', 'decision', 'tip'];
      types.forEach(type => {
        const entry = {
          id: `test-${type}`,
          type,
          title: 'Test',
          content: 'Content',
          tags: [],
          source: { feature: 'test', files: [], date: '2024-01-01' },
        };
        expect(KnowledgeEntrySchema.parse(entry).type).toBe(type);
      });
    });
  });

  describe('DuplicateBlockSchema', () => {
    it('should parse valid duplicate block', () => {
      const block = {
        hash: 'abc123def456',
        lines: 10,
        occurrences: [
          { file: 'src/a.ts', startLine: 5, endLine: 15 },
          { file: 'src/b.ts', startLine: 20, endLine: 30 },
        ],
        preview: 'function duplicate() { ... }',
      };

      const result = DuplicateBlockSchema.parse(block);
      expect(result.occurrences).toHaveLength(2);
      expect(result.lines).toBe(10);
    });
  });

  describe('RouteIndexEntrySchema', () => {
    it('should parse valid route entry', () => {
      const route = {
        method: 'GET',
        path: '/api/users/:id',
        handler: 'getUserById',
        file: 'src/routes/users.ts',
        line: 25,
        middleware: ['auth', 'validate'],
      };

      const result = RouteIndexEntrySchema.parse(route);
      expect(result.method).toBe('GET');
      expect(result.middleware).toHaveLength(2);
    });

    it('should accept all HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'ALL'];
      methods.forEach(method => {
        const route = {
          method,
          path: '/test',
          handler: 'test',
          file: 'test.ts',
          line: 1,
        };
        expect(RouteIndexEntrySchema.parse(route).method).toBe(method);
      });
    });

    it('should allow optional middleware', () => {
      const route = {
        method: 'POST',
        path: '/api/data',
        handler: 'createData',
        file: 'routes.ts',
        line: 10,
      };

      const result = RouteIndexEntrySchema.parse(route);
      expect(result.middleware).toBeUndefined();
    });
  });

  describe('HardwareConfigSchema', () => {
    it('should parse valid hardware config', () => {
      const config = {
        peripherals: [
          {
            type: 'GPIO',
            name: 'LED_PIN',
            pins: ['PA5'],
            file: 'main.c',
            line: 10,
          },
          {
            type: 'UART',
            name: 'USART1',
            pins: ['PA9', 'PA10'],
            file: 'main.c',
            line: 20,
          },
        ],
        defines: [
          {
            name: 'LED_PORT',
            value: 'GPIOA',
            file: 'config.h',
            line: 5,
          },
        ],
      };

      const result = HardwareConfigSchema.parse(config);
      expect(result.peripherals).toHaveLength(2);
      expect(result.defines).toHaveLength(1);
    });

    it('should allow empty arrays', () => {
      const config = {
        peripherals: [],
        defines: [],
      };

      const result = HardwareConfigSchema.parse(config);
      expect(result.peripherals).toHaveLength(0);
      expect(result.defines).toHaveLength(0);
    });
  });
});

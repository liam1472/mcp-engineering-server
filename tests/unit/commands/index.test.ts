/**
 * Unit tests for commands/index.ts
 */

/// <reference types="vitest/globals" />
import { registerCommands } from '../../../src/commands/index.js';

describe('commands/index.ts', () => {
  describe('registerCommands()', () => {
    it('should return array of tools', () => {
      const tools = registerCommands();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should include all lifecycle commands', () => {
      const tools = registerCommands();
      const names = tools.map(t => t.name);

      expect(names).toContain('eng_init');
      expect(names).toContain('eng_scan');
      expect(names).toContain('eng_security');
      expect(names).toContain('eng_start');
      expect(names).toContain('eng_validate');
      expect(names).toContain('eng_done');
    });

    it('should include checkpoint/resume commands', () => {
      const tools = registerCommands();
      const names = tools.map(t => t.name);

      expect(names).toContain('eng_session_checkpoint');
      expect(names).toContain('eng_session_resume');
    });

    it('should include index commands', () => {
      const tools = registerCommands();
      const names = tools.map(t => t.name);

      expect(names).toContain('eng_search');
      expect(names).toContain('eng_duplicates');
      expect(names).toContain('eng_routes');
      expect(names).toContain('eng_hardware');
      expect(names).toContain('eng_knowledge');
    });

    it('should include validation commands', () => {
      const tools = registerCommands();
      const names = tools.map(t => t.name);

      expect(names).toContain('eng_pipeline');
      expect(names).toContain('eng_deps');
      expect(names).toContain('eng_refactor');
      expect(names).toContain('eng_review');
    });

    it('should include function index commands', () => {
      const tools = registerCommands();
      const names = tools.map(t => t.name);

      expect(names).toContain('eng_index_function');
      expect(names).toContain('eng_index_similar');
    });

    describe('tool schemas', () => {
      it('eng_init should have optional name parameter', () => {
        const tools = registerCommands();
        const engInit = tools.find(t => t.name === 'eng_init');

        expect(engInit?.inputSchema.properties).toHaveProperty('name');
        expect(engInit?.inputSchema.required).toBeUndefined();
      });

      it('eng_start should require feature parameter', () => {
        const tools = registerCommands();
        const engStart = tools.find(t => t.name === 'eng_start');

        expect(engStart?.inputSchema.properties).toHaveProperty('feature');
        expect(engStart?.inputSchema.required).toContain('feature');
      });

      it('eng_search should require query parameter', () => {
        const tools = registerCommands();
        const search = tools.find(t => t.name === 'eng_search');

        expect(search?.inputSchema.properties).toHaveProperty('query');
        expect(search?.inputSchema.required).toContain('query');
      });

      it('eng_security should have fix, dryRun, and force options', () => {
        const tools = registerCommands();
        const security = tools.find(t => t.name === 'eng_security');

        expect(security?.inputSchema.properties).toHaveProperty('fix');
        expect(security?.inputSchema.properties).toHaveProperty('dryRun');
        expect(security?.inputSchema.properties).toHaveProperty('force');
      });

      it('eng_refactor should have fix, dryRun, and force options', () => {
        const tools = registerCommands();
        const refactor = tools.find(t => t.name === 'eng_refactor');

        expect(refactor?.inputSchema.properties).toHaveProperty('fix');
        expect(refactor?.inputSchema.properties).toHaveProperty('dryRun');
        expect(refactor?.inputSchema.properties).toHaveProperty('force');
      });

      it('eng_index_similar should require code parameter', () => {
        const tools = registerCommands();
        const similar = tools.find(t => t.name === 'eng_index_similar');

        expect(similar?.inputSchema.properties).toHaveProperty('code');
        expect(similar?.inputSchema.required).toContain('code');
      });
    });

    describe('tool descriptions', () => {
      it('all tools should have descriptions', () => {
        const tools = registerCommands();

        for (const tool of tools) {
          expect(tool.description).toBeDefined();
          expect(tool.description.length).toBeGreaterThan(10);
        }
      });

      it('eng_security description should mention secrets', () => {
        const tools = registerCommands();
        const security = tools.find(t => t.name === 'eng_security');

        expect(security?.description.toLowerCase()).toContain('secret');
      });

      it('eng_validate description should mention validation', () => {
        const tools = registerCommands();
        const validate = tools.find(t => t.name === 'eng_validate');

        expect(validate?.description.toLowerCase()).toContain('validat');
      });
    });
  });
});

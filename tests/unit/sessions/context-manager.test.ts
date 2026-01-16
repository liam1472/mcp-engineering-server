/**
 * Unit tests for sessions/context-manager.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import { ContextManager } from '../../../src/sessions/context-manager.js';
import type { SessionState } from '../../../src/types/index.js';
import {
  createTempDir,
  cleanupTempDir,
  writeTestFile,
  fileExists,
} from '../../setup.js';

describe('sessions/context-manager.ts', () => {
  describe('ContextManager', () => {
    let tempDir: string;
    let contextManager: ContextManager;

    const createValidSession = (): SessionState => ({
      id: 'test-session',
      projectType: 'web-node',
      currentTask: 'Testing',
      decisions: ['Decision 1'],
      findings: ['Finding 1'],
      blockers: [],
      nextSteps: ['Step 1'],
      lastUpdated: new Date().toISOString(),
    });

    beforeEach(async () => {
      tempDir = await createTempDir('context-test');
      contextManager = new ContextManager(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('loadContext()', () => {
      it('should return null when no context exists', async () => {
        const context = await contextManager.loadContext();
        expect(context).toBeNull();
      });

      it('should load existing context', async () => {
        const sessionDir = path.join(tempDir, '.engineering', 'sessions');
        await writeTestFile(
          path.join(sessionDir, 'context.yaml'),
          `id: test-session
projectType: web-node
currentTask: Testing
decisions: []
findings: []
blockers: []
nextSteps: []
lastUpdated: "2024-01-15T10:00:00.000Z"`
        );

        const context = await contextManager.loadContext();

        expect(context).not.toBeNull();
        expect(context?.id).toBe('test-session');
        expect(context?.projectType).toBe('web-node');
      });

      it('should return null for invalid context file', async () => {
        const sessionDir = path.join(tempDir, '.engineering', 'sessions');
        await writeTestFile(
          path.join(sessionDir, 'context.yaml'),
          'invalid: content'
        );

        const context = await contextManager.loadContext();
        expect(context).toBeNull();
      });
    });

    describe('saveContext()', () => {
      it('should save context to file', async () => {
        const state = createValidSession();

        await contextManager.saveContext(state);

        const contextPath = path.join(
          tempDir,
          '.engineering',
          'sessions',
          'context.yaml'
        );
        expect(await fileExists(contextPath)).toBe(true);
      });

      it('should create sessions directory if not exists', async () => {
        const state = createValidSession();

        await contextManager.saveContext(state);

        const sessionDir = path.join(tempDir, '.engineering', 'sessions');
        expect(await fileExists(sessionDir)).toBe(true);
      });

      it('should preserve all state fields', async () => {
        const state = createValidSession();
        state.decisions = ['Decision A', 'Decision B'];
        state.findings = ['Finding X'];

        await contextManager.saveContext(state);
        const loaded = await contextManager.loadContext();

        expect(loaded?.decisions).toEqual(['Decision A', 'Decision B']);
        expect(loaded?.findings).toEqual(['Finding X']);
      });
    });

    describe('createCheckpoint()', () => {
      it('should create checkpoint with auto-generated name', async () => {
        const state = createValidSession();
        await contextManager.saveContext(state);

        const checkpointId = await contextManager.createCheckpoint();

        expect(checkpointId).toContain('checkpoint-');
        const checkpointPath = path.join(
          tempDir,
          '.engineering',
          'sessions',
          `${checkpointId}.yaml`
        );
        expect(await fileExists(checkpointPath)).toBe(true);
      });

      it('should create checkpoint with custom name', async () => {
        const state = createValidSession();
        await contextManager.saveContext(state);

        const checkpointId = await contextManager.createCheckpoint('my-checkpoint');

        expect(checkpointId).toBe('my-checkpoint');
        const checkpointPath = path.join(
          tempDir,
          '.engineering',
          'sessions',
          'my-checkpoint.yaml'
        );
        expect(await fileExists(checkpointPath)).toBe(true);
      });

      it('should throw when no active session', async () => {
        await expect(contextManager.createCheckpoint()).rejects.toThrow(
          'No active session'
        );
      });
    });

    describe('resumeFromCheckpoint()', () => {
      it('should resume from checkpoint', async () => {
        const state = createValidSession();
        state.currentTask = 'Original task';
        await contextManager.saveContext(state);
        await contextManager.createCheckpoint('resume-test');

        // Modify current context
        state.currentTask = 'Modified task';
        await contextManager.saveContext(state);

        // Resume from checkpoint
        const resumed = await contextManager.resumeFromCheckpoint('resume-test');

        expect(resumed.currentTask).toBe('Original task');
      });

      it('should throw for non-existent checkpoint', async () => {
        await expect(
          contextManager.resumeFromCheckpoint('non-existent')
        ).rejects.toThrow('Checkpoint not found');
      });

      it('should update current context after resume', async () => {
        const state = createValidSession();
        await contextManager.saveContext(state);
        await contextManager.createCheckpoint('update-test');

        await contextManager.resumeFromCheckpoint('update-test');
        const current = await contextManager.loadContext();

        expect(current?.id).toBe(state.id);
      });
    });

    describe('listCheckpoints()', () => {
      it('should return empty array when no checkpoints', async () => {
        const checkpoints = await contextManager.listCheckpoints();
        expect(checkpoints).toEqual([]);
      });

      it('should list all checkpoints', async () => {
        const state = createValidSession();
        await contextManager.saveContext(state);

        await contextManager.createCheckpoint('checkpoint-1');
        await contextManager.createCheckpoint('checkpoint-2');
        await contextManager.createCheckpoint('checkpoint-3');

        const checkpoints = await contextManager.listCheckpoints();

        expect(checkpoints).toContain('checkpoint-1');
        expect(checkpoints).toContain('checkpoint-2');
        expect(checkpoints).toContain('checkpoint-3');
        expect(checkpoints).not.toContain('context'); // Should exclude context.yaml
      });
    });

    describe('updateContext()', () => {
      it('should update partial context', async () => {
        const state = createValidSession();
        await contextManager.saveContext(state);

        const updated = await contextManager.updateContext({
          currentTask: 'New task',
        });

        expect(updated.currentTask).toBe('New task');
        expect(updated.id).toBe(state.id); // Other fields preserved
      });

      it('should update lastUpdated timestamp', async () => {
        const state = createValidSession();
        const originalTimestamp = state.lastUpdated;
        await contextManager.saveContext(state);

        // Wait a bit to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10));

        const updated = await contextManager.updateContext({
          currentTask: 'Updated',
        });

        expect(updated.lastUpdated).not.toBe(originalTimestamp);
      });

      it('should throw when no active session', async () => {
        await expect(
          contextManager.updateContext({ currentTask: 'Test' })
        ).rejects.toThrow('No active session');
      });
    });

    describe('addDecision()', () => {
      it('should add decision to list', async () => {
        const state = createValidSession();
        state.decisions = ['Initial decision'];
        await contextManager.saveContext(state);

        await contextManager.addDecision('New decision');

        const loaded = await contextManager.loadContext();
        expect(loaded?.decisions).toContain('Initial decision');
        expect(loaded?.decisions).toContain('New decision');
      });

      it('should throw when no active session', async () => {
        await expect(contextManager.addDecision('Test')).rejects.toThrow(
          'No active session'
        );
      });
    });

    describe('addFinding()', () => {
      it('should add finding to list', async () => {
        const state = createValidSession();
        state.findings = ['Initial finding'];
        await contextManager.saveContext(state);

        await contextManager.addFinding('New finding');

        const loaded = await contextManager.loadContext();
        expect(loaded?.findings).toContain('Initial finding');
        expect(loaded?.findings).toContain('New finding');
      });

      it('should throw when no active session', async () => {
        await expect(contextManager.addFinding('Test')).rejects.toThrow(
          'No active session'
        );
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        const newDir = await createTempDir('new-context-dir');

        contextManager.setWorkingDir(newDir);

        // Save to new directory
        const state = createValidSession();
        await contextManager.saveContext(state);

        const contextPath = path.join(
          newDir,
          '.engineering',
          'sessions',
          'context.yaml'
        );
        expect(await fileExists(contextPath)).toBe(true);

        await cleanupTempDir(newDir);
      });
    });
  });
});

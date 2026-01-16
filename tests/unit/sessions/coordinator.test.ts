/**
 * Unit tests for sessions/coordinator.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import { SessionCoordinator } from '../../../src/sessions/coordinator.js';
import {
  createTempDir,
  cleanupTempDir,
  fileExists,
} from '../../setup.js';

describe('sessions/coordinator.ts', () => {
  describe('SessionCoordinator', () => {
    let tempDir: string;
    let coordinator: SessionCoordinator;

    beforeEach(async () => {
      tempDir = await createTempDir('coordinator-test');
      coordinator = new SessionCoordinator(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('startSession()', () => {
      it('should start session A', async () => {
        const session = await coordinator.startSession('A');

        expect(session.id).toBe('A');
        expect(session.currentTask).toBeNull();
        expect(session.lockedFiles).toEqual([]);
      });

      it('should create session directory', async () => {
        await coordinator.startSession('B');

        const sessionDir = path.join(
          tempDir,
          '.engineering',
          'sessions',
          'instance-B'
        );
        expect(await fileExists(sessionDir)).toBe(true);
      });

      it('should create session info file', async () => {
        await coordinator.startSession('C');

        const infoPath = path.join(
          tempDir,
          '.engineering',
          'sessions',
          'instance-C',
          'info.yaml'
        );
        expect(await fileExists(infoPath)).toBe(true);
      });

      it('should set current session', async () => {
        await coordinator.startSession('A');

        expect(coordinator.getCurrentSession()).toBe('A');
      });

      it('should include startedAt timestamp', async () => {
        const before = new Date().toISOString();
        const session = await coordinator.startSession('A');
        const after = new Date().toISOString();

        expect(session.startedAt >= before).toBe(true);
        expect(session.startedAt <= after).toBe(true);
      });
    });

    describe('getSessionStatus()', () => {
      it('should return empty array when no sessions', async () => {
        const sessions = await coordinator.getSessionStatus();
        expect(sessions).toEqual([]);
      });

      it('should return active sessions', async () => {
        await coordinator.startSession('A');
        await coordinator.startSession('B');

        const sessions = await coordinator.getSessionStatus();

        expect(sessions.length).toBe(2);
        expect(sessions.some(s => s.id === 'A')).toBe(true);
        expect(sessions.some(s => s.id === 'B')).toBe(true);
      });

      it('should not include non-started sessions', async () => {
        await coordinator.startSession('A');

        const sessions = await coordinator.getSessionStatus();

        expect(sessions.length).toBe(1);
        expect(sessions[0]?.id).toBe('A');
      });
    });

    describe('switchSession()', () => {
      it('should switch to existing session', async () => {
        await coordinator.startSession('A');
        await coordinator.startSession('B');

        const session = await coordinator.switchSession('A');

        expect(session.id).toBe('A');
        expect(coordinator.getCurrentSession()).toBe('A');
      });

      it('should update lastActive timestamp', async () => {
        await coordinator.startSession('A');
        const original = (await coordinator.getSessionStatus())[0]?.lastActive;

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 10));

        await coordinator.switchSession('A');
        const updated = (await coordinator.getSessionStatus())[0]?.lastActive;

        expect(updated).not.toBe(original);
      });

      it('should throw for non-existent session', async () => {
        await expect(coordinator.switchSession('C')).rejects.toThrow(
          'Session C not found'
        );
      });
    });

    describe('lockFile()', () => {
      it('should lock file for current session', async () => {
        await coordinator.startSession('A');

        const locked = await coordinator.lockFile('src/index.ts');

        expect(locked).toBe(true);
      });

      it('should prevent lock by other session', async () => {
        await coordinator.startSession('A');
        await coordinator.lockFile('src/index.ts');

        // Create new coordinator instance for session B
        const coordinator2 = new SessionCoordinator(tempDir);
        await coordinator2.startSession('B');

        const locked = await coordinator2.lockFile('src/index.ts');

        expect(locked).toBe(false);
      });

      it('should allow same session to lock again', async () => {
        await coordinator.startSession('A');

        await coordinator.lockFile('src/index.ts');
        const locked = await coordinator.lockFile('src/index.ts');

        expect(locked).toBe(true);
      });

      it('should throw when no active session', async () => {
        await expect(coordinator.lockFile('test.ts')).rejects.toThrow(
          'No active session'
        );
      });
    });

    describe('unlockFile()', () => {
      it('should unlock file', async () => {
        await coordinator.startSession('A');
        await coordinator.lockFile('src/index.ts');

        await coordinator.unlockFile('src/index.ts');

        const locks = await coordinator.getLocks();
        expect(locks.some(l => l.file === 'src/index.ts')).toBe(false);
      });

      it('should only unlock own files', async () => {
        await coordinator.startSession('A');
        await coordinator.lockFile('file-a.ts');

        const coordinator2 = new SessionCoordinator(tempDir);
        await coordinator2.startSession('B');
        await coordinator2.lockFile('file-b.ts');

        // Try to unlock file-a from session B
        await coordinator2.unlockFile('file-a.ts');

        const locks = await coordinator.getLocks();
        // file-a should still be locked by A
        expect(locks.some(l => l.file === 'file-a.ts' && l.session === 'A')).toBe(true);
      });

      it('should not throw when no active session', async () => {
        await expect(coordinator.unlockFile('test.ts')).resolves.not.toThrow();
      });
    });

    describe('getLocks()', () => {
      it('should return empty array when no locks', async () => {
        const locks = await coordinator.getLocks();
        expect(locks).toEqual([]);
      });

      it('should return all locks', async () => {
        await coordinator.startSession('A');
        await coordinator.lockFile('file1.ts');
        await coordinator.lockFile('file2.ts');

        const locks = await coordinator.getLocks();

        expect(locks.length).toBe(2);
        expect(locks.some(l => l.file === 'file1.ts')).toBe(true);
        expect(locks.some(l => l.file === 'file2.ts')).toBe(true);
      });

      it('should include lock metadata', async () => {
        await coordinator.startSession('A');
        await coordinator.lockFile('test.ts');

        const locks = await coordinator.getLocks();
        const lock = locks[0];

        expect(lock?.session).toBe('A');
        expect(lock?.file).toBe('test.ts');
        expect(lock?.lockedAt).toBeDefined();
      });
    });

    describe('addDiscovery()', () => {
      it('should add finding discovery', async () => {
        await coordinator.startSession('A');

        await coordinator.addDiscovery('finding', 'Found security issue');

        const discoveries = await coordinator.getDiscoveries();
        expect(discoveries.some(d => d.content === 'Found security issue')).toBe(true);
      });

      it('should add decision discovery', async () => {
        await coordinator.startSession('A');

        await coordinator.addDiscovery('decision', 'Use TypeScript');

        const discoveries = await coordinator.getDiscoveries();
        expect(discoveries.some(d => d.type === 'decision')).toBe(true);
      });

      it('should add blocker discovery', async () => {
        await coordinator.startSession('A');

        await coordinator.addDiscovery('blocker', 'Missing dependency');

        const discoveries = await coordinator.getDiscoveries();
        expect(discoveries.some(d => d.type === 'blocker')).toBe(true);
      });

      it('should include session and timestamp', async () => {
        await coordinator.startSession('B');

        await coordinator.addDiscovery('finding', 'Test');

        const discoveries = await coordinator.getDiscoveries();
        const discovery = discoveries[0];

        expect(discovery?.session).toBe('B');
        expect(discovery?.timestamp).toBeDefined();
      });

      it('should throw when no active session', async () => {
        await expect(
          coordinator.addDiscovery('finding', 'Test')
        ).rejects.toThrow('No active session');
      });
    });

    describe('getDiscoveries()', () => {
      it('should return empty array when no discoveries', async () => {
        const discoveries = await coordinator.getDiscoveries();
        expect(discoveries).toEqual([]);
      });

      it('should filter by session when sinceSession provided', async () => {
        await coordinator.startSession('A');
        await coordinator.addDiscovery('finding', 'From A');

        const coordinator2 = new SessionCoordinator(tempDir);
        await coordinator2.startSession('B');
        await coordinator2.addDiscovery('finding', 'From B');

        // Get discoveries from other sessions (not A)
        const discoveries = await coordinator.getDiscoveries('A');

        expect(discoveries.length).toBe(1);
        expect(discoveries[0]?.content).toBe('From B');
      });
    });

    describe('syncSession()', () => {
      it('should return locks and discoveries', async () => {
        await coordinator.startSession('A');
        await coordinator.lockFile('test.ts');
        await coordinator.addDiscovery('finding', 'Test finding');

        const sync = await coordinator.syncSession();

        expect(sync.locks.length).toBeGreaterThan(0);
        // Discoveries from other sessions (none in this case since we're session A)
      });

      it('should return discoveries from other sessions', async () => {
        await coordinator.startSession('A');
        await coordinator.addDiscovery('finding', 'From A');

        const coordinator2 = new SessionCoordinator(tempDir);
        await coordinator2.startSession('B');
        await coordinator2.addDiscovery('finding', 'From B');

        // Sync from session A perspective
        const sync = await coordinator.syncSession();

        // Should see B's discovery
        expect(sync.discoveries.some(d => d.content === 'From B')).toBe(true);
        // Should not see A's own discovery
        expect(sync.discoveries.some(d => d.content === 'From A')).toBe(false);
      });
    });

    describe('getCurrentSession()', () => {
      it('should return null when no session started', () => {
        expect(coordinator.getCurrentSession()).toBeNull();
      });

      it('should return current session id', async () => {
        await coordinator.startSession('C');
        expect(coordinator.getCurrentSession()).toBe('C');
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        const newDir = await createTempDir('new-coord-dir');

        coordinator.setWorkingDir(newDir);
        await coordinator.startSession('A');

        const sessionDir = path.join(
          newDir,
          '.engineering',
          'sessions',
          'instance-A'
        );
        expect(await fileExists(sessionDir)).toBe(true);

        await cleanupTempDir(newDir);
      });
    });
  });
});

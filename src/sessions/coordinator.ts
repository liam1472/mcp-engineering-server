/**
 * Session Coordinator
 * Handles multi-session coordination: locking, sync, conflict prevention
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parse, stringify } from 'yaml';

type SessionId = 'A' | 'B' | 'C';

interface SessionInfo {
  id: SessionId;
  startedAt: string;
  lastActive: string;
  currentTask: string | null;
  lockedFiles: string[];
}

interface LockEntry {
  file: string;
  session: SessionId;
  lockedAt: string;
}

interface LocksFile {
  locks: LockEntry[];
}

interface Discovery {
  session: SessionId;
  timestamp: string;
  type: 'finding' | 'decision' | 'blocker';
  content: string;
}

interface SyncFile {
  discoveries: Discovery[];
}

export class SessionCoordinator {
  private workingDir: string;
  private sessionsDir: string;
  private currentSession: SessionId | null = null;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
    this.sessionsDir = path.join(this.workingDir, '.engineering', 'sessions');
  }

  async startSession(id: SessionId): Promise<SessionInfo> {
    await fs.mkdir(this.sessionsDir, { recursive: true });

    const sessionDir = path.join(this.sessionsDir, `instance-${id}`);
    await fs.mkdir(sessionDir, { recursive: true });

    const now = new Date().toISOString();
    const info: SessionInfo = {
      id,
      startedAt: now,
      lastActive: now,
      currentTask: null,
      lockedFiles: [],
    };

    await fs.writeFile(path.join(sessionDir, 'info.yaml'), stringify(info, { indent: 2 }), 'utf-8');

    this.currentSession = id;
    return info;
  }

  async getSessionStatus(): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];
    const sessionIds: SessionId[] = ['A', 'B', 'C'];

    for (const id of sessionIds) {
      const sessionDir = path.join(this.sessionsDir, `instance-${id}`);
      const infoPath = path.join(sessionDir, 'info.yaml');

      try {
        const content = await fs.readFile(infoPath, 'utf-8');
        const info = parse(content) as SessionInfo;
        sessions.push(info);
      } catch {
        // Session doesn't exist
      }
    }

    return sessions;
  }

  async switchSession(id: SessionId): Promise<SessionInfo> {
    const sessionDir = path.join(this.sessionsDir, `instance-${id}`);
    const infoPath = path.join(sessionDir, 'info.yaml');

    try {
      const content = await fs.readFile(infoPath, 'utf-8');
      const info = parse(content) as SessionInfo;

      // Update last active
      info.lastActive = new Date().toISOString();
      await fs.writeFile(infoPath, stringify(info, { indent: 2 }), 'utf-8');

      this.currentSession = id;
      return info;
    } catch {
      throw new Error(`Session ${id} not found. Start it with eng_session_start.`);
    }
  }

  async lockFile(filePath: string): Promise<boolean> {
    if (!this.currentSession) {
      throw new Error('No active session. Start one first.');
    }

    const locksPath = path.join(this.sessionsDir, 'locks.yaml');
    let locksFile: LocksFile = { locks: [] };

    try {
      const content = await fs.readFile(locksPath, 'utf-8');
      locksFile = parse(content) as LocksFile;
    } catch {
      // No locks file yet
    }

    // Check if already locked by another session
    const existingLock = locksFile.locks.find(l => l.file === filePath);
    if (existingLock && existingLock.session !== this.currentSession) {
      return false; // Locked by another session
    }

    if (!existingLock) {
      locksFile.locks.push({
        file: filePath,
        session: this.currentSession,
        lockedAt: new Date().toISOString(),
      });

      await fs.writeFile(locksPath, stringify(locksFile, { indent: 2 }), 'utf-8');
    }

    return true;
  }

  async unlockFile(filePath: string): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const locksPath = path.join(this.sessionsDir, 'locks.yaml');

    try {
      const content = await fs.readFile(locksPath, 'utf-8');
      const locksFile = parse(content) as LocksFile;

      locksFile.locks = locksFile.locks.filter(
        l => !(l.file === filePath && l.session === this.currentSession)
      );

      await fs.writeFile(locksPath, stringify(locksFile, { indent: 2 }), 'utf-8');
    } catch {
      // No locks file
    }
  }

  async getLocks(): Promise<LockEntry[]> {
    const locksPath = path.join(this.sessionsDir, 'locks.yaml');

    try {
      const content = await fs.readFile(locksPath, 'utf-8');
      const locksFile = parse(content) as LocksFile;
      return locksFile.locks;
    } catch {
      return [];
    }
  }

  async addDiscovery(type: Discovery['type'], content: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session.');
    }

    const syncPath = path.join(this.sessionsDir, 'sync.yaml');
    let syncFile: SyncFile = { discoveries: [] };

    try {
      const fileContent = await fs.readFile(syncPath, 'utf-8');
      syncFile = parse(fileContent) as SyncFile;
    } catch {
      // No sync file yet
    }

    syncFile.discoveries.push({
      session: this.currentSession,
      timestamp: new Date().toISOString(),
      type,
      content,
    });

    await fs.writeFile(syncPath, stringify(syncFile, { indent: 2 }), 'utf-8');
  }

  async getDiscoveries(sinceSession?: SessionId): Promise<Discovery[]> {
    const syncPath = path.join(this.sessionsDir, 'sync.yaml');

    try {
      const content = await fs.readFile(syncPath, 'utf-8');
      const syncFile = parse(content) as SyncFile;

      if (sinceSession) {
        // Filter discoveries from other sessions
        return syncFile.discoveries.filter(d => d.session !== sinceSession);
      }

      return syncFile.discoveries;
    } catch {
      return [];
    }
  }

  async syncSession(): Promise<{ locks: LockEntry[]; discoveries: Discovery[] }> {
    const locks = await this.getLocks();
    const discoveries = this.currentSession
      ? await this.getDiscoveries(this.currentSession)
      : await this.getDiscoveries();

    return { locks, discoveries };
  }

  getCurrentSession(): SessionId | null {
    return this.currentSession;
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
    this.sessionsDir = path.join(dir, '.engineering', 'sessions');
  }
}

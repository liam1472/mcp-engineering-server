/**
 * Session Context Manager
 * Handles session state persistence and checkpoint management
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parse, stringify } from 'yaml';
import { SessionStateSchema, type SessionState } from '../types/index.js';

export class ContextManager {
  private workingDir: string;
  private sessionDir: string;

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
    this.sessionDir = path.join(this.workingDir, '.engineering', 'sessions');
  }

  async loadContext(): Promise<SessionState | null> {
    try {
      const contextPath = path.join(this.sessionDir, 'context.yaml');
      const content = await fs.readFile(contextPath, 'utf-8');
      const parsed = parse(content) as unknown;
      return SessionStateSchema.parse(parsed);
    } catch {
      return null;
    }
  }

  async saveContext(state: SessionState): Promise<void> {
    await fs.mkdir(this.sessionDir, { recursive: true });

    const contextPath = path.join(this.sessionDir, 'context.yaml');
    const content = stringify(state, { indent: 2 });
    await fs.writeFile(contextPath, content, 'utf-8');
  }

  async createCheckpoint(name?: string): Promise<string> {
    const state = await this.loadContext();
    if (!state) {
      throw new Error('No active session to checkpoint');
    }

    const checkpointId = name ?? `checkpoint-${Date.now()}`;
    const checkpointPath = path.join(this.sessionDir, `${checkpointId}.yaml`);

    const content = stringify(state, { indent: 2 });
    await fs.writeFile(checkpointPath, content, 'utf-8');

    return checkpointId;
  }

  async resumeFromCheckpoint(checkpointId: string): Promise<SessionState> {
    const checkpointPath = path.join(this.sessionDir, `${checkpointId}.yaml`);

    try {
      const content = await fs.readFile(checkpointPath, 'utf-8');
      const parsed = parse(content) as unknown;
      const state = SessionStateSchema.parse(parsed);

      // Save as current context
      await this.saveContext(state);

      return state;
    } catch {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }
  }

  async listCheckpoints(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.sessionDir);
      return files
        .filter(f => f.endsWith('.yaml') && f !== 'context.yaml' && f !== 'locks.yaml')
        .map(f => f.replace('.yaml', ''));
    } catch {
      return [];
    }
  }

  async updateContext(updates: Partial<SessionState>): Promise<SessionState> {
    const current = await this.loadContext();
    if (!current) {
      throw new Error('No active session');
    }

    const updated: SessionState = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    await this.saveContext(updated);
    return updated;
  }

  async addDecision(decision: string): Promise<void> {
    const current = await this.loadContext();
    if (!current) {
      throw new Error('No active session');
    }

    current.decisions.push(decision);
    current.lastUpdated = new Date().toISOString();
    await this.saveContext(current);
  }

  async addFinding(finding: string): Promise<void> {
    const current = await this.loadContext();
    if (!current) {
      throw new Error('No active session');
    }

    current.findings.push(finding);
    current.lastUpdated = new Date().toISOString();
    await this.saveContext(current);
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
    this.sessionDir = path.join(dir, '.engineering', 'sessions');
  }
}

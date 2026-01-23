/**
 * Safety Utilities for --fix operations
 * Prevents dangerous auto-modifications
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Protected paths that should never be auto-modified
 */
export const PROTECTED_PATHS = ['node_modules/', '.git/', 'dist/', 'build/', '.env', '.env.local'];

/**
 * Maximum files to modify without --force flag
 */
export const MAX_FILES_WITHOUT_FORCE = 5;

/**
 * Check if running on own project (MCP Engineering Server)
 */
export async function isOwnProject(workingDir: string): Promise<boolean> {
  try {
    const pkgPath = path.join(workingDir, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as { name?: string };
    return pkg.name === 'mcp-engineering-server';
  } catch {
    return false;
  }
}

/**
 * Check if a file path is safe to modify
 * Returns an object with safe status and reason if not safe
 */
export async function isSafeToModify(
  filePath: string,
  workingDir: string
): Promise<{ safe: boolean; reason?: string }> {
  // Normalize path for comparison
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Check protected paths
  for (const protected_path of PROTECTED_PATHS) {
    if (normalizedPath.includes(protected_path)) {
      return {
        safe: false,
        reason: `Protected path: ${protected_path}`,
      };
    }
  }

  // If running on own project, block src/ modifications
  if (await isOwnProject(workingDir)) {
    if (normalizedPath.startsWith('src/') || normalizedPath.includes('/src/')) {
      return {
        safe: false,
        reason: 'Cannot modify own source code (src/) - this is the MCP Engineering Server project',
      };
    }
  }

  return { safe: true };
}

/**
 * Filter files that are safe to modify
 * Returns safe files and blocked files with reasons
 */
export async function filterSafeFiles(
  files: string[],
  workingDir: string
): Promise<{
  safeFiles: string[];
  blockedFiles: Array<{ file: string; reason: string }>;
}> {
  const safeFiles: string[] = [];
  const blockedFiles: Array<{ file: string; reason: string }> = [];

  for (const file of files) {
    const result = await isSafeToModify(file, workingDir);
    if (result.safe) {
      safeFiles.push(file);
    } else {
      blockedFiles.push({ file, reason: result.reason ?? 'Unknown' });
    }
  }

  return { safeFiles, blockedFiles };
}

/**
 * Check if operation requires --force flag
 * Returns true if file count exceeds limit
 */
export function requiresForceFlag(fileCount: number): boolean {
  return fileCount > MAX_FILES_WITHOUT_FORCE;
}

/**
 * Atomic file operations with rollback capability
 */
export interface FileBackup {
  path: string;
  backupPath: string;
  originalContent: string;
  originalMode?: number; // Unix file permissions (preserved on write)
}

export class AtomicFileWriter {
  private backups: FileBackup[] = [];
  private createdFiles: string[] = [];
  private workingDir: string;

  constructor(workingDir: string) {
    this.workingDir = workingDir;
  }

  /**
   * Backup a file before modification
   * Preserves original file permissions (important for executable scripts on Unix)
   */
  async backup(filePath: string): Promise<void> {
    const fullPath = path.join(this.workingDir, filePath);
    const backupPath = fullPath + '.bak';

    try {
      // Read content and get file stats (for permissions)
      const [content, stat] = await Promise.all([
        fs.readFile(fullPath, 'utf-8'),
        fs.stat(fullPath),
      ]);

      // Write backup with same permissions
      await fs.writeFile(backupPath, content, 'utf-8');
      // Preserve permissions on backup file (Unix only, no-op on Windows)
      try {
        await fs.chmod(backupPath, stat.mode);
      } catch {
        // chmod may fail on Windows, ignore
      }

      this.backups.push({
        path: fullPath,
        backupPath,
        originalContent: content,
        originalMode: stat.mode,
      });
    } catch (error) {
      throw new Error(`Failed to backup ${filePath}: ${String(error)}`);
    }
  }

  /**
   * Write file content (tracks for rollback)
   * Preserves original file permissions if file was backed up
   */
  async write(filePath: string, content: string, isNewFile = false): Promise<void> {
    const fullPath = path.join(this.workingDir, filePath);

    try {
      await fs.writeFile(fullPath, content, 'utf-8');

      // Restore original permissions if this file was backed up
      // This is important for executable scripts (chmod +x)
      const backup = this.backups.find((b) => b.path === fullPath);
      if (backup?.originalMode !== undefined) {
        try {
          await fs.chmod(fullPath, backup.originalMode);
        } catch {
          // chmod may fail on Windows, ignore
        }
      }

      if (isNewFile) {
        this.createdFiles.push(fullPath);
      }
    } catch (error) {
      throw new Error(`Failed to write ${filePath}: ${String(error)}`);
    }
  }

  /**
   * Rollback all changes on failure
   */
  async rollback(): Promise<string[]> {
    const restored: string[] = [];
    const errors: string[] = [];

    // Restore backups
    for (const backup of this.backups) {
      try {
        await fs.writeFile(backup.path, backup.originalContent, 'utf-8');
        // Restore original permissions
        if (backup.originalMode !== undefined) {
          try {
            await fs.chmod(backup.path, backup.originalMode);
          } catch {
            // chmod may fail on Windows, ignore
          }
        }
        restored.push(backup.path);
        // Remove backup file
        try {
          await fs.unlink(backup.backupPath);
        } catch {
          // Ignore backup removal errors
        }
      } catch (error) {
        errors.push(`Failed to restore ${backup.path}: ${String(error)}`);
      }
    }

    // Remove created files
    for (const file of this.createdFiles) {
      try {
        await fs.unlink(file);
        restored.push(`Removed: ${file}`);
      } catch (error) {
        errors.push(`Failed to remove ${file}: ${String(error)}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Rollback partially failed:\n${errors.join('\n')}`);
    }

    return restored;
  }

  /**
   * Commit changes - clean up backups
   */
  commit(): void {
    // In production, we keep .bak files for user reference
    // But clear the internal tracking
    this.backups = [];
    this.createdFiles = [];
  }

  /**
   * Get list of backed up files
   */
  getBackups(): string[] {
    return this.backups.map(b => path.relative(this.workingDir, b.backupPath));
  }
}

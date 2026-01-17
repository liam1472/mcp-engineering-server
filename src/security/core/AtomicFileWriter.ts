/**
 * AtomicFileWriter - Safe file writing with rollback capability
 *
 * Responsibilities:
 * - Write files with automatic backup
 * - Rollback changes on error
 * - Atomic operations (all-or-nothing)
 *
 * This class handles the complex file I/O logic that was hard to test
 * in the monolithic scanner.ts. By isolating it here, we can:
 * - Mock file operations in tests
 * - Test rollback scenarios
 * - Ensure atomic operations work correctly
 */

export interface FileChange {
  file: string;
  originalContent: string;
  newContent: string;
}

export class AtomicFileWriter {
  private backups: Map<string, string> = new Map();
  private modified: string[] = [];

  /**
   * Prepare a file change (creates backup)
   * @param filePath - Path to file
   * @param newContent - New content to write
   */
  async prepare(filePath: string, newContent: string): Promise<void> {
    // TODO: Implementation will be extracted from scanner.ts
    // This will be the backup/prepare logic from applyFixes()
  }

  /**
   * Commit all prepared changes
   */
  async commit(): Promise<void> {
    // TODO: Finalize all changes
  }

  /**
   * Rollback all changes (restore from backups)
   */
  async rollback(): Promise<void> {
    // TODO: Implementation will be extracted from scanner.ts
    // This will be the rollback logic from error handling
  }

  /**
   * Get list of files that were backed up
   */
  getBackedUpFiles(): string[] {
    return Array.from(this.backups.keys());
  }

  /**
   * Get list of modified files
   */
  getModifiedFiles(): string[] {
    return [...this.modified];
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.backups.clear();
    this.modified = [];
  }
}

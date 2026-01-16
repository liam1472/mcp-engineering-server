#!/usr/bin/env node
/**
 * MCP Engineering Server
 * Universal Engineering Workflow for AI-Assisted Development
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// CLI: Handle setup command before MCP server starts
const args = process.argv.slice(2);
if (args.includes('setup') || args.includes('--setup')) {
  await setupCommands();
  process.exit(0);
}

async function setupCommands(): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sourceDir = path.join(__dirname, '..', '.claude', 'commands');
  const targetDir = path.join(process.cwd(), '.claude', 'commands');

  try {
    // Check if source exists
    await fs.access(sourceDir);

    // Create target directory
    await fs.mkdir(targetDir, { recursive: true });

    // Copy all command files
    const files = await fs.readdir(sourceDir);
    let copied = 0;

    for (const file of files) {
      if (file.endsWith('.md')) {
        const src = path.join(sourceDir, file);
        const dest = path.join(targetDir, file);

        // Check if file already exists
        try {
          await fs.access(dest);
          console.log(`  Skip: ${file} (already exists)`);
        } catch {
          await fs.copyFile(src, dest);
          console.log(`  Copy: ${file}`);
          copied++;
        }
      }
    }

    console.log(`\n✓ Setup complete: ${copied} command(s) copied to .claude/commands/`);
    console.log('\nSlash commands available:');
    console.log('  /eng-init, /eng-scan, /eng-security, /eng-start, /eng-validate');
    console.log('  /eng-done, /eng-search, /eng-checkpoint, /eng-resume');
    console.log('  /eng-session-start, /eng-session-status, /eng-lock, /eng-unlock');
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { registerCommands } from './commands/index.js';
import { ProjectDetector } from './core/project-detector.js';
import { ConfigManager } from './core/config.js';
import { SecurityScanner } from './security/scanner.js';
import { FunctionIndexer } from './indexes/function-indexer.js';
import { FeatureManager } from './features/manager.js';
import { ContextManager } from './sessions/context-manager.js';
import { SessionCoordinator } from './sessions/coordinator.js';

const server = new Server(
  {
    name: 'mcp-engineering-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize core components
const projectDetector = new ProjectDetector();
const configManager = new ConfigManager();
const securityScanner = new SecurityScanner();
const functionIndexer = new FunctionIndexer();
const featureManager = new FeatureManager();
const contextManager = new ContextManager();
const sessionCoordinator = new SessionCoordinator();

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: registerCommands(),
  };
});

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;

  // Tool dispatch logic
  switch (name) {
    case 'eng_init': {
      try {
        // Check if already initialized
        if (await configManager.exists()) {
          const config = await configManager.load();
          return {
            content: [
              {
                type: 'text',
                text: `Project already initialized as "${config.projectName}" (${config.projectType}).\nUse eng_scan to rebuild indexes.`,
              },
            ],
          };
        }

        // Detect project type
        const projectType = await projectDetector.detect();
        const projectName =
          (args as { name?: string } | undefined)?.name ?? path.basename(process.cwd());

        // Initialize config and directory structure
        await configManager.initialize(projectName, projectType);

        return {
          content: [
            {
              type: 'text',
              text:
                `✓ Initialized "${projectName}"\n` +
                `  Type: ${projectType}\n` +
                `  Config: .engineering/config.yaml\n\n` +
                `Next: Run eng_scan to build code indexes, eng_security to scan for secrets.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Init failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_scan': {
      try {
        // Ensure initialized
        if (!(await configManager.exists())) {
          return {
            content: [{ type: 'text', text: 'Project not initialized. Run eng_init first.' }],
            isError: true,
          };
        }

        const functions = await functionIndexer.scan();
        await functionIndexer.saveIndex();

        return {
          content: [
            {
              type: 'text',
              text:
                `✓ Scan complete\n` +
                `  Functions indexed: ${functions.length}\n` +
                `  Output: .engineering/index/functions.yaml`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Scan failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_security': {
      try {
        const findings = await securityScanner.scan();

        if (findings.length === 0) {
          return {
            content: [{ type: 'text', text: '✓ No security issues found.' }],
          };
        }

        // Group by severity
        const critical = findings.filter(f => f.severity === 'critical');
        const high = findings.filter(f => f.severity === 'high');
        const other = findings.filter(f => f.severity !== 'critical' && f.severity !== 'high');

        let report = `⚠ Found ${findings.length} security issue(s):\n\n`;

        if (critical.length > 0) {
          report += `CRITICAL (${critical.length}):\n`;
          for (const f of critical) {
            report += `  • ${f.file}:${f.line} - ${f.pattern}: ${f.match}\n`;
            report += `    → ${f.suggestion}\n`;
          }
          report += '\n';
        }

        if (high.length > 0) {
          report += `HIGH (${high.length}):\n`;
          for (const f of high) {
            report += `  • ${f.file}:${f.line} - ${f.pattern}: ${f.match}\n`;
            report += `    → ${f.suggestion}\n`;
          }
          report += '\n';
        }

        if (other.length > 0) {
          report += `OTHER (${other.length}):\n`;
          for (const f of other) {
            report += `  • ${f.file}:${f.line} - ${f.pattern}\n`;
          }
        }

        return {
          content: [{ type: 'text', text: report }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Security scan failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_start': {
      try {
        if (!(await configManager.exists())) {
          return {
            content: [{ type: 'text', text: 'Project not initialized. Run eng_init first.' }],
            isError: true,
          };
        }

        const featureName = (args as { feature?: string } | undefined)?.feature;
        if (!featureName) {
          return {
            content: [
              { type: 'text', text: 'Feature name required. Usage: eng_start --feature <name>' },
            ],
            isError: true,
          };
        }

        // Check for active feature
        const activeFeature = await featureManager.getActiveFeature();
        if (activeFeature) {
          return {
            content: [
              {
                type: 'text',
                text: `Feature "${activeFeature}" is already active.\nRun eng_done to complete it first, or continue working on it.`,
              },
            ],
          };
        }

        const manifest = await featureManager.startFeature(featureName);

        return {
          content: [
            {
              type: 'text',
              text:
                `✓ Started feature "${featureName}"\n` +
                `  Directory: .engineering/features/${featureName}/\n` +
                `  Started: ${manifest.startedAt}\n\n` +
                `Track progress with eng_validate, complete with eng_done.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Start failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_validate': {
      try {
        if (!(await configManager.exists())) {
          return {
            content: [{ type: 'text', text: 'Project not initialized. Run eng_init first.' }],
            isError: true,
          };
        }

        const results: string[] = [];
        let hasErrors = false;

        // 1. Security scan
        const findings = await securityScanner.scan();
        const criticalFindings = findings.filter(f => f.severity === 'critical');
        if (criticalFindings.length > 0) {
          results.push(`✗ Security: ${criticalFindings.length} critical issue(s) found`);
          hasErrors = true;
        } else if (findings.length > 0) {
          results.push(`⚠ Security: ${findings.length} issue(s) found (no critical)`);
        } else {
          results.push('✓ Security: No issues');
        }

        // 2. Index check
        const functions = await functionIndexer.scan();
        results.push(`✓ Indexed: ${functions.length} functions`);

        // 3. Active feature check
        const activeFeature = await featureManager.getActiveFeature();
        if (activeFeature) {
          results.push(`✓ Active feature: ${activeFeature}`);
        } else {
          results.push('⚠ No active feature');
        }

        const status = hasErrors ? '⚠ Validation completed with errors' : '✓ Validation passed';

        return {
          content: [
            {
              type: 'text',
              text: `${status}\n\n${results.join('\n')}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Validation failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_done': {
      try {
        const activeFeature = await featureManager.getActiveFeature();
        if (!activeFeature) {
          return {
            content: [{ type: 'text', text: 'No active feature. Start one with eng_start.' }],
            isError: true,
          };
        }

        // Run security check before completing
        const findings = await securityScanner.scan();
        const criticalFindings = findings.filter(f => f.severity === 'critical');
        if (criticalFindings.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Cannot complete: ${criticalFindings.length} critical security issue(s) found.\nRun eng_security to see details, fix them first.`,
              },
            ],
            isError: true,
          };
        }

        const archivePath = await featureManager.completeFeature(activeFeature);

        return {
          content: [
            {
              type: 'text',
              text:
                `✓ Feature "${activeFeature}" completed\n` +
                `  Archived to: ${archivePath}\n\n` +
                `Ready to start a new feature with eng_start.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Done failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_session_checkpoint': {
      try {
        const checkpointName = (args as { name?: string } | undefined)?.name;
        const checkpointId = await contextManager.createCheckpoint(checkpointName);

        return {
          content: [
            {
              type: 'text',
              text:
                `✓ Checkpoint saved: ${checkpointId}\n` +
                `  Location: .engineering/sessions/${checkpointId}.yaml\n\n` +
                `Resume later with eng_session_resume --checkpoint ${checkpointId}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Checkpoint failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_session_resume': {
      try {
        const checkpointId = (args as { checkpoint?: string } | undefined)?.checkpoint;

        if (!checkpointId) {
          // List available checkpoints
          const checkpoints = await contextManager.listCheckpoints();
          if (checkpoints.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No checkpoints found. Create one with eng_session_checkpoint.',
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `Available checkpoints:\n${checkpoints.map(c => `  • ${c}`).join('\n')}\n\nResume with: eng_session_resume --checkpoint <name>`,
              },
            ],
          };
        }

        const state = await contextManager.resumeFromCheckpoint(checkpointId);

        return {
          content: [
            {
              type: 'text',
              text:
                `✓ Resumed from: ${checkpointId}\n` +
                `  Task: ${state.currentTask ?? '(none)'}\n` +
                `  Decisions: ${state.decisions.length}\n` +
                `  Findings: ${state.findings.length}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Resume failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_search': {
      try {
        const query = (args as { query?: string } | undefined)?.query;
        if (!query) {
          return {
            content: [
              { type: 'text', text: 'Search query required. Usage: eng_search --query <term>' },
            ],
            isError: true,
          };
        }

        // Search functions
        await functionIndexer.scan();
        const results = functionIndexer.search(query);

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `No results found for "${query}"` }],
          };
        }

        const formatted = results
          .slice(0, 20)
          .map(r => `  ${r.name} (${r.file}:${r.line})`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${results.length} result(s) for "${query}":\n\n${formatted}${results.length > 20 ? '\n  ...(truncated)' : ''}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Search failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    // Multi-Session Commands
    case 'eng_session_start': {
      try {
        const id = (args as { id?: 'A' | 'B' | 'C' } | undefined)?.id;
        if (!id || !['A', 'B', 'C'].includes(id)) {
          return {
            content: [{ type: 'text', text: 'Session ID required (A, B, or C).' }],
            isError: true,
          };
        }

        const info = await sessionCoordinator.startSession(id);

        return {
          content: [
            {
              type: 'text',
              text:
                `✓ Session ${id} started\n` +
                `  Started: ${info.startedAt}\n` +
                `  Directory: .engineering/sessions/instance-${id}/\n\n` +
                `Use eng_lock to lock files, eng_session_sync to see other sessions' discoveries.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Session start failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_session_status': {
      try {
        const sessions = await sessionCoordinator.getSessionStatus();
        const locks = await sessionCoordinator.getLocks();
        const current = sessionCoordinator.getCurrentSession();

        if (sessions.length === 0) {
          return {
            content: [
              { type: 'text', text: 'No active sessions. Start one with eng_session_start.' },
            ],
          };
        }

        let report = 'Active Sessions:\n';
        for (const s of sessions) {
          const marker = s.id === current ? ' (current)' : '';
          report += `  ${s.id}${marker}: started ${s.startedAt}\n`;
        }

        if (locks.length > 0) {
          report += '\nLocked Files:\n';
          for (const l of locks) {
            report += `  [${l.session}] ${l.file}\n`;
          }
        }

        return {
          content: [{ type: 'text', text: report }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Status failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_session_switch': {
      try {
        const id = (args as { id?: 'A' | 'B' | 'C' } | undefined)?.id;
        if (!id || !['A', 'B', 'C'].includes(id)) {
          return {
            content: [{ type: 'text', text: 'Session ID required (A, B, or C).' }],
            isError: true,
          };
        }

        const info = await sessionCoordinator.switchSession(id);

        return {
          content: [
            {
              type: 'text',
              text:
                `✓ Switched to session ${id}\n` +
                `  Last active: ${info.lastActive}\n` +
                `  Locked files: ${info.lockedFiles.length}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Switch failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_session_sync': {
      try {
        const { locks, discoveries } = await sessionCoordinator.syncSession();
        const current = sessionCoordinator.getCurrentSession();

        let report = `Sync for session ${current ?? '(none)'}:\n\n`;

        if (locks.length > 0) {
          const otherLocks = locks.filter(l => l.session !== current);
          if (otherLocks.length > 0) {
            report += 'Files locked by other sessions:\n';
            for (const l of otherLocks) {
              report += `  [${l.session}] ${l.file}\n`;
            }
            report += '\n';
          }
        }

        if (discoveries.length > 0) {
          report += `Discoveries from other sessions (${discoveries.length}):\n`;
          for (const d of discoveries.slice(-10)) {
            report += `  [${d.session}] ${d.type}: ${d.content}\n`;
          }
        } else {
          report += 'No new discoveries from other sessions.';
        }

        return {
          content: [{ type: 'text', text: report }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Sync failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_lock': {
      try {
        const file = (args as { file?: string } | undefined)?.file;
        if (!file) {
          return {
            content: [{ type: 'text', text: 'File path required.' }],
            isError: true,
          };
        }

        const success = await sessionCoordinator.lockFile(file);
        if (!success) {
          const locks = await sessionCoordinator.getLocks();
          const existing = locks.find(l => l.file === file);
          return {
            content: [
              {
                type: 'text',
                text: `Cannot lock: ${file} is locked by session ${existing?.session ?? 'unknown'}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: `✓ Locked: ${file}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Lock failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_unlock': {
      try {
        const file = (args as { file?: string } | undefined)?.file;
        if (!file) {
          return {
            content: [{ type: 'text', text: 'File path required.' }],
            isError: true,
          };
        }

        await sessionCoordinator.unlockFile(file);

        return {
          content: [{ type: 'text', text: `✓ Unlocked: ${file}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Unlock failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    default:
      return {
        content: [
          {
            type: 'text',
            text: `Unknown command: ${name}`,
          },
        ],
        isError: true,
      };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);

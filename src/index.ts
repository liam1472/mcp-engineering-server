#!/usr/bin/env node
/**
 * MCP Engineering Server
 * Universal Engineering Workflow for AI-Assisted Development
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// CLI: Handle commands before MCP server starts
const args = process.argv.slice(2);
const command = args[0];

if (command === 'install') {
  await installGlobal();
  process.exit(0);
} else if (command === 'setup') {
  await setupLocal();
  process.exit(0);
} else if (command === 'uninstall') {
  await uninstallGlobal();
  process.exit(0);
}

/**
 * Install globally: copy commands to ~/.claude/commands/ and register MCP server
 */
async function installGlobal(): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sourceDir = path.join(__dirname, '..', 'commands');
  const homeDir = os.homedir();
  const targetDir = path.join(homeDir, '.claude', 'commands');

  console.log('Installing mcp-engineering-server...\n');

  try {
    // Step 1: Copy slash commands to ~/.claude/commands/
    console.log('Step 1: Installing slash commands...');

    // Check if source exists
    try {
      await fs.access(sourceDir);
    } catch {
      console.error(`  Error: Commands directory not found at ${sourceDir}`);
      console.error('  Please reinstall the package: npm install -g mcp-engineering-server');
      process.exit(1);
    }

    // Create target directory
    await fs.mkdir(targetDir, { recursive: true });

    // Copy all command files
    const files = await fs.readdir(sourceDir);
    let copied = 0;
    let skipped = 0;

    for (const file of files) {
      if (file.endsWith('.md')) {
        const src = path.join(sourceDir, file);
        const dest = path.join(targetDir, file);

        // Check if file already exists
        try {
          await fs.access(dest);
          skipped++;
        } catch {
          await fs.copyFile(src, dest);
          copied++;
        }
      }
    }

    console.log(`  Copied: ${copied} command(s)`);
    if (skipped > 0) {
      console.log(`  Skipped: ${skipped} (already exist)`);
    }
    console.log(`  Location: ${targetDir}\n`);

    // Step 2: Register MCP server with Claude Code
    console.log('Step 2: Registering MCP server with Claude Code...');

    try {
      execSync('claude mcp add engineering -- mcp-engineering-server', {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      console.log('  MCP server registered successfully.\n');
    } catch (error) {
      const err = error as { stderr?: string; message?: string };
      if (err.stderr?.includes('already exists') || err.message?.includes('already exists')) {
        console.log('  MCP server already registered.\n');
      } else {
        console.log('  Warning: Could not auto-register MCP server.');
        console.log('  You may need to run manually:');
        console.log('    claude mcp add engineering -- mcp-engineering-server\n');
      }
    }

    // Success message
    console.log('✓ Installation complete!\n');
    console.log('Available slash commands:');
    console.log('  /eng-init        Initialize project');
    console.log('  /eng-scan        Build function index');
    console.log('  /eng-security    Scan for secrets');
    console.log('  /eng-start       Start a feature');
    console.log('  /eng-validate    Run validation');
    console.log('  /eng-done        Complete feature');
    console.log('  /eng-search      Search functions');
    console.log('  /eng-checkpoint  Save session');
    console.log('  /eng-resume      Resume session');
    console.log('  ...and more! Use /help to see all commands.\n');
    console.log('Get started: Open a project and run /eng-init');

  } catch (error) {
    console.error('Installation failed:', error);
    process.exit(1);
  }
}

/**
 * Setup for current project only (copy to ./.claude/commands/)
 */
async function setupLocal(): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sourceDir = path.join(__dirname, '..', 'commands');
  const targetDir = path.join(process.cwd(), '.claude', 'commands');

  console.log('Setting up slash commands for current project...\n');

  try {
    await fs.access(sourceDir);
    await fs.mkdir(targetDir, { recursive: true });

    const files = await fs.readdir(sourceDir);
    let copied = 0;

    for (const file of files) {
      if (file.endsWith('.md')) {
        const src = path.join(sourceDir, file);
        const dest = path.join(targetDir, file);

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

  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

/**
 * Uninstall: remove commands and MCP registration
 */
async function uninstallGlobal(): Promise<void> {
  const homeDir = os.homedir();
  const targetDir = path.join(homeDir, '.claude', 'commands');

  console.log('Uninstalling mcp-engineering-server...\n');

  try {
    // Remove slash commands
    console.log('Removing slash commands...');
    const files = await fs.readdir(targetDir).catch(() => []);
    let removed = 0;

    for (const file of files) {
      if (file.startsWith('eng-') && file.endsWith('.md')) {
        await fs.unlink(path.join(targetDir, file)).catch(() => {});
        removed++;
      }
    }
    console.log(`  Removed: ${removed} command(s)\n`);

    // Remove MCP registration
    console.log('Removing MCP server registration...');
    try {
      execSync('claude mcp remove engineering', { stdio: 'pipe' });
      console.log('  MCP server removed.\n');
    } catch {
      console.log('  MCP server was not registered.\n');
    }

    console.log('✓ Uninstall complete!');

  } catch (error) {
    console.error('Uninstall failed:', error);
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
import { DuplicateDetector } from './indexes/duplicate-detector.js';
import { RouteIndexer } from './indexes/route-indexer.js';
import { HardwareIndexer } from './indexes/hardware-indexer.js';
import { DependencyAnalyzer } from './indexes/dependency-graph.js';
import { RefactorAnalyzer } from './indexes/refactor-analyzer.js';
import { ArchitectureEnforcer } from './indexes/architecture-enforcer.js';
import { SimilarityAnalyzer } from './indexes/similarity.js';
import { ValidationPipeline } from './validation/pipeline.js';
import { ReviewChecker } from './validation/review-checker.js';
import { MutationRunner } from './testing/mutation-runner.js';
import { TestRunner } from './testing/test-runner.js';
import { LogAnalyzer } from './debugging/log-analyzer.js';
import { FeatureManager } from './features/manager.js';
import { PlanningManager } from './features/planner.js';
import { GlobalKnowledgeManager } from './knowledge/global-manager.js';
import { DeviceTreeIndexer } from './embedded/device-tree-indexer.js';
import { ContextManager } from './sessions/context-manager.js';

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
const duplicateDetector = new DuplicateDetector();
const routeIndexer = new RouteIndexer();
const hardwareIndexer = new HardwareIndexer();
const dependencyAnalyzer = new DependencyAnalyzer();
const refactorAnalyzer = new RefactorAnalyzer();
const architectureEnforcer = new ArchitectureEnforcer();
const similarityAnalyzer = new SimilarityAnalyzer();
const validationPipeline = new ValidationPipeline();
const reviewChecker = new ReviewChecker();
const mutationRunner = new MutationRunner();
const testRunner = new TestRunner(process.cwd());
const logAnalyzer = new LogAnalyzer();
const featureManager = new FeatureManager();
const planningManager = new PlanningManager();
const globalKnowledgeManager = new GlobalKnowledgeManager();
const deviceTreeIndexer = new DeviceTreeIndexer();
const contextManager = new ContextManager();

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
        const { profile, architecturalReport } = await configManager.initialize(
          projectName,
          projectType
        );

        // Build output message
        let resultText =
          `✓ Initialized "${projectName}"\n` +
          `  Type: ${projectType}\n` +
          `  Profile: ${profile}\n` +
          `  Config: .engineering/config.yaml\n`;

        // Show template info
        if (profile !== 'unknown') {
          resultText += `\n📋 Templates copied:\n`;
          resultText += `  • manifesto.md - Coding standards for ${profile}\n`;
          resultText += `  • blueprint.md - Deployment/ops standards for ${profile}\n`;
        }

        // Show architectural gaps
        if (architecturalReport.gaps.length > 0) {
          resultText += `\n⚠️ ARCHITECTURAL GAPS DETECTED:\n`;
          for (const gap of architecturalReport.gaps) {
            const icon = gap.severity === 'critical' ? '🔴' : gap.severity === 'warning' ? '🟡' : '🔵';
            resultText += `  ${icon} ${gap.name}: ${gap.description}\n`;
            resultText += `     → ${gap.suggestion}\n`;
          }
        }

        // Show recommendations
        if (architecturalReport.recommendations.length > 0) {
          resultText += `\n💡 Recommendations:\n`;
          for (const rec of architecturalReport.recommendations) {
            resultText += `  • ${rec}\n`;
          }
        }

        resultText += `\nNext: Run eng_scan to build code indexes, eng_security to scan for secrets.`;

        return {
          content: [
            {
              type: 'text',
              text: resultText,
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
        const securityArgs = args as
          | { fix?: boolean; dryRun?: boolean; force?: boolean }
          | undefined;
        const shouldFix = securityArgs?.fix === true;
        const dryRun = securityArgs?.dryRun === true;
        const force = securityArgs?.force === true;

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

        // Handle fix mode
        if (shouldFix) {
          if (dryRun) {
            // Dry run: show what would be changed
            const fix = await securityScanner.generateFixes(findings);
            report += '\n\n=== DRY RUN - Preview of changes ===\n';
            report += fix.instructions;
            report += '\n\n--- .env file content (would be created) ---\n' + fix.envFile;
            report +=
              '\n\n--- .env.example file content (would be created) ---\n' + fix.envExampleFile;
            report += '\n\n--- .gitignore entries (would be added) ---\n' + fix.gitignoreEntry;
            report += '\n\nRun with --fix (without --dry-run) to apply these changes.';
          } else {
            // Actually apply fixes with safety options
            const result = await securityScanner.applyFixes(findings, { force });
            report += '\n\n' + result.summary;
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

        // Search knowledge base for related entries
        const knowledgeExtractor = featureManager.getKnowledgeExtractor();
        const relatedKnowledge = await knowledgeExtractor.searchKnowledge(featureName);

        // Check project type for hardware relevance
        const config = await configManager.load();
        const isEmbedded = config.projectType.startsWith('embedded-');

        let resultText =
          `✓ Started feature "${featureName}"\n` +
          `  Directory: .engineering/features/${featureName}/\n` +
          `  Started: ${manifest.startedAt}\n`;

        // Show related knowledge if any
        if (relatedKnowledge.length > 0) {
          resultText += `\nRelated knowledge (${relatedKnowledge.length} entries):\n`;
          for (const entry of relatedKnowledge.slice(0, 3)) {
            resultText += `  • [${entry.type}] ${entry.title}\n`;
          }
          if (relatedKnowledge.length > 3) {
            resultText += `  ...use /eng-knowledge "${featureName}" for more\n`;
          }
        }

        // Hardware check for embedded projects
        if (isEmbedded) {
          try {
            const hwIndex = await hardwareIndexer.scan();
            if (hwIndex.peripherals.length > 0) {
              resultText += `\nHardware available (${hwIndex.peripherals.length} peripherals):\n`;
              const byType = new Map<string, number>();
              for (const p of hwIndex.peripherals) {
                byType.set(p.type, (byType.get(p.type) ?? 0) + 1);
              }
              for (const [type, count] of byType) {
                resultText += `  • ${type}: ${count}\n`;
              }
              resultText += `  Use /eng-hardware for details\n`;
            }
          } catch {
            // Hardware scan failed, skip silently
          }
        }

        resultText += `\nTrack progress with eng_validate, complete with eng_done.`;

        // Load and inject manifesto if available
        const manifesto = await featureManager.getManifesto();
        if (manifesto) {
          resultText += `\n\n<SYSTEM_ENFORCEMENT>\n`;
          resultText += `PROJECT MANIFESTO ACTIVE.\n`;
          resultText += `YOU MUST ADHERE TO THE FOLLOWING RULES:\n\n`;
          resultText += manifesto;
          resultText += `\n</SYSTEM_ENFORCEMENT>`;
        }

        return {
          content: [{ type: 'text', text: resultText }],
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
        const doneArgs = args as { promote?: boolean } | undefined;
        const shouldPromote = doneArgs?.promote === true;

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

        // Check if mutation test was run (look for recent Stryker report)
        const reportPath = path.join(process.cwd(), 'reports', 'mutation', 'mutation.json');
        let mutationWarning = '';
        try {
          const stat = await fs.stat(reportPath);
          const reportAge = Date.now() - stat.mtimeMs;
          const oneHour = 60 * 60 * 1000;

          if (reportAge > oneHour) {
            mutationWarning =
              '\n⚠️  Warning: Mutation test report is stale (>1 hour old). Consider running /eng-test before completing.';
          } else {
            // Check score from report
            const reportContent = await fs.readFile(reportPath, 'utf-8');
            const report = JSON.parse(reportContent) as { schemaVersion?: string; thresholds?: { high?: number; low?: number; break?: number }; files?: Record<string, unknown> };
            if (report.schemaVersion) {
              // Valid Stryker report - could extract score here for enforcement
              // For now, just acknowledge the test was run
            }
          }
        } catch {
          mutationWarning =
            '\n⚠️  Warning: No mutation test found. Run /eng-test to verify test quality before completing.';
        }

        const { archivePath, knowledgeExtracted } =
          await featureManager.completeFeature(activeFeature);

        let resultText =
          `✓ Feature "${activeFeature}" completed\n` + `  Archived to: ${archivePath}\n`;

        if (knowledgeExtracted.length > 0) {
          resultText += `\nKnowledge extracted (${knowledgeExtracted.length} entries):\n`;
          for (const entry of knowledgeExtracted.slice(0, 5)) {
            resultText += `  • [${entry.type}] ${entry.title}\n`;
          }
          if (knowledgeExtracted.length > 5) {
            resultText += `  ...and ${knowledgeExtracted.length - 5} more\n`;
          }
          resultText += `\nSaved to: .engineering/knowledge/base.yaml`;

          // Promote to global KB if requested
          if (shouldPromote && knowledgeExtracted.length > 0) {
            const config = await configManager.load();
            const promoteResult = await globalKnowledgeManager.promote(
              knowledgeExtracted,
              config.projectName
            );

            resultText += `\n\n📤 Global Knowledge Promotion:\n`;
            resultText += `  Promoted: ${promoteResult.promoted}\n`;
            resultText += `  Skipped (duplicates): ${promoteResult.skipped}\n`;
            resultText += `  Location: ${globalKnowledgeManager.getGlobalDir()}\n`;
          }
        }

        resultText += mutationWarning;
        resultText += `\n\nReady to start a new feature with eng_start.`;

        return {
          content: [{ type: 'text', text: resultText }],
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

    case 'eng_duplicates': {
      try {
        const duplicates = await duplicateDetector.scan();
        await duplicateDetector.saveReport();

        if (duplicates.length === 0) {
          return {
            content: [{ type: 'text', text: '✓ No significant duplicate code blocks found.' }],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text:
                duplicateDetector.getSummary() +
                '\n\nFull report: .engineering/index/duplicates.yaml',
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Duplicate scan failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_routes': {
      try {
        const routes = await routeIndexer.scan();
        await routeIndexer.saveIndex();

        if (routes.length === 0) {
          return {
            content: [{ type: 'text', text: 'No API routes found in the codebase.' }],
          };
        }

        let report = `✓ Found ${routes.length} API route(s):\n\n`;

        // Group by file
        const byFile = new Map<string, typeof routes>();
        for (const route of routes) {
          const existing = byFile.get(route.file) ?? [];
          existing.push(route);
          byFile.set(route.file, existing);
        }

        for (const [file, fileRoutes] of byFile) {
          report += `${file}:\n`;
          for (const r of fileRoutes.slice(0, 10)) {
            report += `  ${r.method.padEnd(7)} ${r.path} → ${r.handler}\n`;
          }
          if (fileRoutes.length > 10) {
            report += `  ...and ${fileRoutes.length - 10} more\n`;
          }
        }

        report += `\nFull index: .engineering/index/routes.yaml`;

        return {
          content: [{ type: 'text', text: report }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Route scan failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_hardware': {
      try {
        const hwIndex = await hardwareIndexer.scan();
        await hardwareIndexer.saveIndex();

        if (hwIndex.peripherals.length === 0 && hwIndex.defines.length === 0) {
          return {
            content: [{ type: 'text', text: 'No hardware configurations found.' }],
          };
        }

        let report = hardwareIndexer.getSummary();
        report += `\nFull index: .engineering/index/hardware.yaml`;

        return {
          content: [{ type: 'text', text: report }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Hardware scan failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_knowledge': {
      try {
        const query = (args as { query?: string } | undefined)?.query;
        const knowledgeExtractor = featureManager.getKnowledgeExtractor();

        if (!query) {
          // Show stats
          const stats = await knowledgeExtractor.getStats();

          if (stats.total === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Knowledge base is empty. Complete features with eng_done to build it.',
                },
              ],
            };
          }

          let report = `Knowledge Base: ${stats.total} entries\n\n`;
          report += 'By type:\n';
          for (const [type, count] of Object.entries(stats.byType)) {
            report += `  ${type}: ${count}\n`;
          }
          report += '\nSearch with: eng_knowledge --query <term>';

          return {
            content: [{ type: 'text', text: report }],
          };
        }

        // Search knowledge
        const results = await knowledgeExtractor.searchKnowledge(query);

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `No knowledge entries found for "${query}"` }],
          };
        }

        let report = `Found ${results.length} knowledge entries for "${query}":\n\n`;
        for (const entry of results.slice(0, 10)) {
          report += `[${entry.type}] ${entry.title}\n`;
          report += `  ${entry.content.slice(0, 100)}${entry.content.length > 100 ? '...' : ''}\n`;
          report += `  Source: ${entry.source.feature} (${entry.source.date.split('T')[0]})\n\n`;
        }

        if (results.length > 10) {
          report += `...and ${results.length - 10} more`;
        }

        return {
          content: [{ type: 'text', text: report }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Knowledge query failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_pipeline': {
      try {
        const options: {
          skipBuild?: boolean;
          skipTest?: boolean;
          skipLint?: boolean;
        } = {};

        const argsObj = args as
          | { skipBuild?: boolean; skipTest?: boolean; skipLint?: boolean }
          | undefined;
        if (argsObj?.skipBuild === true) options.skipBuild = true;
        if (argsObj?.skipTest === true) options.skipTest = true;
        if (argsObj?.skipLint === true) options.skipLint = true;

        const result = await validationPipeline.run(options);

        return {
          content: [{ type: 'text', text: result.summary }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Pipeline failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_deps': {
      try {
        await dependencyAnalyzer.analyze();
        await dependencyAnalyzer.saveReport();

        return {
          content: [
            {
              type: 'text',
              text:
                dependencyAnalyzer.getSummary() +
                '\n\nFull report: .engineering/index/dependencies.yaml',
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Dependency analysis failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_refactor': {
      try {
        const refactorArgs = args as
          | { fix?: boolean; dryRun?: boolean; force?: boolean; learn?: boolean; clean?: boolean }
          | undefined;
        const shouldFix = refactorArgs?.fix === true;
        const dryRun = refactorArgs?.dryRun === true;
        const force = refactorArgs?.force === true;
        const shouldLearn = refactorArgs?.learn === true;
        const shouldClean = refactorArgs?.clean === true;

        // Handle clean mode
        if (shouldClean) {
          const cleanResult = await refactorAnalyzer.cleanGarbage({
            fix: shouldFix,
            dryRun,
          });

          let output = '# Garbage File Detection\n\n';

          if (cleanResult.found.length === 0) {
            output += '✓ No garbage files found.\n';
          } else {
            output += `Found ${cleanResult.found.length} garbage file(s):\n\n`;
            for (const file of cleanResult.found.slice(0, 20)) {
              output += `  • ${file}\n`;
            }
            if (cleanResult.found.length > 20) {
              output += `  ...and ${cleanResult.found.length - 20} more\n`;
            }
            output += '\n';

            if (dryRun && cleanResult.wouldDelete.length > 0) {
              output += `\nWould delete ${cleanResult.wouldDelete.length} file(s).\n`;
              output += 'Run with --fix (without --dry-run) to delete.\n';
            } else if (cleanResult.deleted.length > 0) {
              output += `\n✓ Deleted ${cleanResult.deleted.length} file(s).\n`;
            } else if (!shouldFix) {
              output += '\nRun with --fix to delete these files.\n';
              output += 'Use --dry-run to preview what would be deleted.\n';
            }

            if (cleanResult.errors.length > 0) {
              output += `\nErrors:\n`;
              for (const err of cleanResult.errors) {
                output += `  • ${err}\n`;
              }
            }
          }

          return {
            content: [{ type: 'text', text: output }],
          };
        }

        // Always generate fixes if fix flag is set (for dry-run or apply)
        const report = await refactorAnalyzer.analyze({ generateFixes: shouldFix });

        let output = report.summary + '\n\n';

        if (report.suggestions.length > 0) {
          output += 'Detailed suggestions:\n';

          for (const s of report.suggestions.slice(0, 10)) {
            output += `\n[${s.priority.toUpperCase()}] ${s.title}\n`;
            output += `  ${s.description}\n`;
            output += `  Files: ${s.files.join(', ')}\n`;
            output += `  Impact: ${s.estimatedImpact}\n`;

            // Show fix instructions in dry-run mode
            if (shouldFix && dryRun && s.fix) {
              output += `\n  === PREVIEW (dry-run) ===\n`;
              output += `  ${s.fix.instructions.split('\n').join('\n  ')}\n`;
            }
          }
        }

        // Handle fix mode
        if (shouldFix && !dryRun) {
          // Actually apply fixes with safety options
          const result = await refactorAnalyzer.applyFixes(report, { force });
          output += '\n\n' + result.summary;
        } else if (shouldFix && dryRun) {
          output += '\n\nRun with --fix (without --dry-run) to apply these changes.';
        }

        // Handle learn mode - extract rules and append to manifesto
        if (shouldLearn && report.suggestions.length > 0) {
          const learnedRules = await refactorAnalyzer.learnFromRefactor(report);
          if (learnedRules.length > 0) {
            output += `\n\n📚 LEARNED RULES (${learnedRules.length}):\n`;
            for (const rule of learnedRules) {
              output += `  • [${rule.type}] ${rule.rule}\n`;
            }
            output += `\n✅ Rules appended to .engineering/manifesto.md`;
          } else {
            output += `\n\n📚 No significant patterns to learn from this analysis.`;
          }
        }

        return {
          content: [{ type: 'text', text: output }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Refactor analysis failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_review': {
      try {
        const skipTests = (args as { skipTests?: boolean } | undefined)?.skipTests ?? false;
        const report = await reviewChecker.runReview(skipTests);

        return {
          content: [
            {
              type: 'text',
              text: reviewChecker.formatReport(report),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Review failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_index_function': {
      try {
        const argsObj = args as { query?: string; file?: string; tag?: string } | undefined;
        const query = argsObj?.query;

        // Scan to get all functions
        const functions = await functionIndexer.scan();

        if (!query) {
          // Show stats
          // Group by file
          const byFile = new Map<string, number>();
          for (const fn of functions) {
            byFile.set(fn.file, (byFile.get(fn.file) ?? 0) + 1);
          }

          let report = `Function Index: ${functions.length} functions\n\n`;
          report += 'By file (top 10):\n';
          const sorted = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
          for (const [file, count] of sorted) {
            report += `  ${file}: ${count}\n`;
          }
          report += '\nSearch with: eng_index_function --query <term>';

          return {
            content: [{ type: 'text', text: report }],
          };
        }

        // Search with optional filters
        let results = functionIndexer.search(query);

        // Filter by file if specified
        if (argsObj?.file) {
          results = results.filter(r => r.file.includes(argsObj.file ?? ''));
        }

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `No functions found matching "${query}"` }],
          };
        }

        let report = `Found ${results.length} function(s) matching "${query}":\n\n`;
        for (const fn of results.slice(0, 15)) {
          report += `${fn.name}\n`;
          report += `  File: ${fn.file}:${fn.line}\n`;
          if (fn.signature) report += `  Signature: ${fn.signature}\n`;
          report += '\n';
        }

        if (results.length > 15) {
          report += `...and ${results.length - 15} more`;
        }

        return {
          content: [{ type: 'text', text: report }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Function search failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_index_similar': {
      try {
        const code = (args as { code?: string } | undefined)?.code;

        if (!code) {
          return {
            content: [
              {
                type: 'text',
                text: 'Code snippet required. Usage: eng_index_similar --code "<your code>"',
              },
            ],
            isError: true,
          };
        }

        const result = await similarityAnalyzer.findSimilar(code);

        return {
          content: [
            {
              type: 'text',
              text: similarityAnalyzer.formatResult(result),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Similarity search failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_test': {
      try {
        const testArgs = args as
          | { file?: string; threshold?: number; mode?: 'run' | 'check' | 'analyze' }
          | undefined;
        const mode = testArgs?.mode ?? 'run';
        const file = testArgs?.file;
        const threshold = testArgs?.threshold ?? 30;

        let output = '';

        if (mode === 'analyze') {
          // Testability analysis only (no Stryker)
          if (!file) {
            return {
              content: [
                { type: 'text', text: 'Please specify a file for testability analysis: --file <path>' },
              ],
              isError: true,
            };
          }

          const report = await mutationRunner.run({ file, threshold });
          output = `# Testability Analysis: ${file}\n\n`;

          if (report.testabilityIssues.length === 0) {
            output += '✓ No testability issues detected\n';
          } else {
            output += `Found ${report.testabilityIssues.length} testability issue(s):\n\n`;
            for (const issue of report.testabilityIssues) {
              output += `[${issue.severity.toUpperCase()}] ${issue.type}\n`;
              output += `  File: ${issue.file}:${issue.line}\n`;
              output += `  ${issue.description}\n`;
              output += `  💡 ${issue.suggestion}\n\n`;
            }
          }

          if (report.recommendations.length > 0) {
            output += '\n## Recommendations\n';
            for (const rec of report.recommendations) {
              output += `${rec}\n`;
            }
          }
        } else if (mode === 'check') {
          // Threshold check only
          const result = await mutationRunner.check({ file, threshold });
          output = result.message + '\n\n';
          output += `Score: ${result.score.toFixed(2)}%\n`;
          output += `Threshold: ${result.threshold}%\n`;
          output += `Status: ${result.passed ? 'PASSED ✓' : 'FAILED ✗'}`;
        } else {
          // Full mutation testing
          output = '# Mutation Test Report\n\n';
          output += '⏳ Running Stryker mutation testing...\n';
          output += 'This may take several minutes.\n\n';

          const report = await mutationRunner.run({ file, threshold });

          output = '# Mutation Test Report\n\n';
          output += `## Summary\n`;
          output += `Score: **${report.summary.score.toFixed(2)}%** (${report.summary.verdict})\n`;
          output += `Killed: ${report.summary.killed}\n`;
          output += `Survived: ${report.summary.survived}\n`;
          output += `No Coverage: ${report.summary.noCoverage}\n`;
          output += `Total: ${report.summary.total}\n`;
          output += `Duration: ${(report.summary.duration / 1000).toFixed(1)}s\n\n`;

          // Verdict explanation
          output += `## Verdict: ${report.summary.verdict.toUpperCase()}\n`;
          switch (report.summary.verdict) {
            case 'excellent':
              output += '✅ Excellent mutation coverage!\n';
              break;
            case 'good':
              output += '✓ Good mutation coverage.\n';
              break;
            case 'acceptable':
              output += '⚠️ Acceptable, but could be improved.\n';
              break;
            case 'needs-improvement':
              output += '⚠️ Needs improvement - add more targeted tests.\n';
              break;
            case 'poor':
              output += '❌ Poor coverage - prioritize adding tests.\n';
              break;
          }
          output += '\n';

          // Surviving mutants (limited)
          if (report.survivingMutants.length > 0) {
            output += `## Surviving Mutants (showing first 10)\n`;
            for (const mutant of report.survivingMutants.slice(0, 10)) {
              output += `\n**${mutant.file}:${mutant.line}** [${mutant.mutator}]\n`;
              output += `  Status: ${mutant.status}\n`;
              if (mutant.suggestion) {
                output += `  💡 ${mutant.suggestion}\n`;
              }
            }
            if (report.survivingMutants.length > 10) {
              output += `\n...and ${report.survivingMutants.length - 10} more\n`;
            }
            output += '\n';
          }

          // Testability issues
          if (report.testabilityIssues.length > 0) {
            output += `## Testability Issues (${report.testabilityIssues.length})\n`;
            for (const issue of report.testabilityIssues.slice(0, 5)) {
              output += `\n[${issue.severity.toUpperCase()}] **${issue.name}** (${issue.type})\n`;
              output += `  ${issue.file}:${issue.line}\n`;
              output += `  ${issue.description}\n`;
              output += `  💡 ${issue.suggestion}\n`;
            }
            output += '\n';
          }

          // Recommendations
          if (report.recommendations.length > 0) {
            output += `## Recommendations\n`;
            for (const rec of report.recommendations) {
              output += `${rec}\n`;
            }
          }
        }

        return {
          content: [{ type: 'text', text: output }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Mutation testing failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_unittest': {
      try {
        const testArgs = args as { file?: string; watch?: boolean } | undefined;
        const file = testArgs?.file;
        const watch = testArgs?.watch ?? false;

        // Detect framework
        const framework = await testRunner.detectFramework();

        if (framework === 'unknown') {
          return {
            content: [
              {
                type: 'text',
                text: 'No test framework detected. Supported: vitest, jest, pytest, cargo, go, dotnet, ctest.',
              },
            ],
            isError: true,
          };
        }

        // Get command for display
        const cmd = testRunner.getCommand(framework, { file, watch });

        if (watch) {
          return {
            content: [
              {
                type: 'text',
                text: `Starting watch mode with ${framework}...\n\nCommand: ${cmd}\n\nNote: Watch mode runs in background. Use Ctrl+C to stop.`,
              },
            ],
          };
        }

        // Run tests
        const result = await testRunner.run({ file, watch });

        let output = `# Unit Test Results (${framework})\n\n`;
        output += `Command: ${cmd}\n\n`;
        output += `## Summary\n`;
        output += `  Passed:  ${result.passed}\n`;
        output += `  Failed:  ${result.failed}\n`;
        output += `  Skipped: ${result.skipped}\n`;
        output += `  Total:   ${result.total}\n`;
        output += `  Duration: ${result.duration}ms\n\n`;

        if (result.exitCode === 0) {
          output += '✓ All tests passed!\n';
        } else {
          output += `✗ Tests failed (exit code: ${result.exitCode})\n\n`;
          output += '## Output\n```\n';
          // Limit output to last 50 lines
          const lines = result.output.split('\n');
          const lastLines = lines.slice(-50).join('\n');
          output += lastLines;
          output += '\n```';
        }

        return {
          content: [{ type: 'text', text: output }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Unit test failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_debug': {
      try {
        const debugArgs = args as
          | { file?: string; pattern?: string; tail?: number; ignoreCase?: boolean }
          | undefined;

        if (!debugArgs?.file) {
          return {
            content: [
              {
                type: 'text',
                text: 'File path required. Usage: eng_debug --file /path/to/log.log',
              },
            ],
            isError: true,
          };
        }

        const result = await logAnalyzer.analyze({
          file: debugArgs.file,
          pattern: debugArgs.pattern,
          tail: debugArgs.tail,
          ignoreCase: debugArgs.ignoreCase,
        });

        return {
          content: [{ type: 'text', text: logAnalyzer.formatResult(result) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Log analysis failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_plan': {
      try {
        const planArgs = args as
          | { feature?: string; injectKnowledge?: boolean; injectManifesto?: boolean; description?: string }
          | undefined;

        if (!planArgs?.feature) {
          return {
            content: [
              {
                type: 'text',
                text: 'Feature name required. Usage: eng_plan --feature <name>',
              },
            ],
            isError: true,
          };
        }

        const result = await planningManager.createPlan({
          feature: planArgs.feature,
          injectKnowledge: planArgs.injectKnowledge ?? true,
          injectManifesto: planArgs.injectManifesto ?? true,
          description: planArgs.description,
        });

        if (result.error) {
          return {
            content: [{ type: 'text', text: `Plan creation failed: ${result.error}` }],
            isError: true,
          };
        }

        let output = `✓ Created plan for feature "${result.feature}"\n`;
        output += `  Location: ${result.planPath}\n`;

        if (result.knowledgeInjected.length > 0) {
          output += `\n📚 Injected ${result.knowledgeInjected.length} knowledge entry(ies)\n`;
        }

        if (result.manifestoInjected) {
          output += `\n📋 Manifesto rules injected\n`;
        }

        output += `\nEdit the plan at ${result.planPath} to define objectives, tasks, and acceptance criteria.`;

        return {
          content: [{ type: 'text', text: output }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Plan creation failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_dts': {
      try {
        const dtsArgs = args as
          | { scan?: boolean; check?: string; conflicts?: boolean; available?: string }
          | undefined;

        // Default to scan if no specific action
        const shouldScan = dtsArgs?.scan ?? (!dtsArgs?.check && !dtsArgs?.conflicts && !dtsArgs?.available);

        if (shouldScan) {
          const result = await deviceTreeIndexer.scan();
          await deviceTreeIndexer.saveIndex();

          if (result.files.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No device tree files (.dts/.dtsi) found in the project.',
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: deviceTreeIndexer.getSummary() + '\n\nFull index: .engineering/index/device-tree.yaml',
              },
            ],
          };
        }

        // Need to scan first for other operations
        await deviceTreeIndexer.scan();

        // Check node reference
        if (dtsArgs?.check) {
          const checkResult = await deviceTreeIndexer.checkNode(dtsArgs.check);

          let output = `# Node Check: ${dtsArgs.check}\n\n`;
          if (checkResult.exists) {
            output += `✓ Node exists\n`;
            output += `  Status: ${checkResult.status}\n`;
            if (checkResult.node) {
              output += `  Path: ${checkResult.node.path}\n`;
              output += `  File: ${checkResult.node.file}:${checkResult.node.line}\n`;
            }
            if (checkResult.warning) {
              output += `\n⚠️ Warning: ${checkResult.warning}\n`;
            }
          } else {
            output += `✗ Node does not exist\n`;
            output += `\nAvailable nodes in index:\n`;
            const index = deviceTreeIndexer.getIndex();
            for (const node of index.nodes.slice(0, 10)) {
              output += `  • &${node.name} (${node.status})\n`;
            }
          }

          return {
            content: [{ type: 'text', text: output }],
          };
        }

        // Detect conflicts
        if (dtsArgs?.conflicts) {
          const conflicts = await deviceTreeIndexer.detectConflicts();

          let output = `# Pin Muxing Conflict Detection\n\n`;
          if (conflicts.length === 0) {
            output += `✓ No pin conflicts detected.\n`;
          } else {
            output += `⚠️ Found ${conflicts.length} conflict(s):\n\n`;
            for (const conflict of conflicts) {
              output += `**${conflict.nodes.join(' ↔ ')}**\n`;
              output += `  Pins: ${conflict.pins.join(', ')}\n`;
              output += `  ${conflict.description}\n\n`;
            }
          }

          return {
            content: [{ type: 'text', text: output }],
          };
        }

        // List available nodes
        if (dtsArgs?.available) {
          const nodes = await deviceTreeIndexer.listAvailable(dtsArgs.available);

          let output = `# Available ${dtsArgs.available.toUpperCase()} Nodes\n\n`;
          if (nodes.length === 0) {
            output += `No enabled ${dtsArgs.available} nodes found.\n`;
          } else {
            output += `Found ${nodes.length} enabled node(s):\n\n`;
            for (const node of nodes) {
              output += `**&${node.name}**\n`;
              output += `  Path: ${node.path}\n`;
              output += `  File: ${node.file}:${node.line}\n`;
              if (node.pinctrl.length > 0) {
                output += `  Pinctrl: ${node.pinctrl.join(', ')}\n`;
              }
              output += '\n';
            }
          }

          return {
            content: [{ type: 'text', text: output }],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: 'No action specified. Use --scan, --check <node>, --conflicts, or --available <type>.',
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Device tree analysis failed: ${String(error)}` }],
          isError: true,
        };
      }
    }

    case 'eng_arch': {
      try {
        const archArgs = args as
          | { init?: boolean; check?: boolean; enforce?: boolean }
          | undefined;

        // Handle init
        if (archArgs?.init) {
          const result = await architectureEnforcer.init();

          if (result.skipped) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Architecture config already exists at ${result.configPath}.\nEdit it to define your architectural layers and rules.`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `✓ Created architecture template at ${result.configPath}\n\nEdit the file to define:\n  • Layers (presentation, domain, infrastructure, etc.)\n  • Allowed dependencies between layers\n  • Custom rules\n\nThen run eng_arch --check to detect violations.`,
              },
            ],
          };
        }

        // Handle check
        if (archArgs?.check) {
          await architectureEnforcer.loadConfig();
          const report = await architectureEnforcer.check();

          return {
            content: [
              {
                type: 'text',
                text: architectureEnforcer.formatReport(report),
              },
            ],
          };
        }

        // Handle enforce
        if (archArgs?.enforce) {
          await architectureEnforcer.loadConfig();
          const report = await architectureEnforcer.enforce();

          if (report.failed) {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ Architecture enforcement FAILED\n\n${architectureEnforcer.formatReport(report)}`,
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `✓ Architecture check passed\n\n${report.summary}`,
              },
            ],
          };
        }

        // Default: show help
        return {
          content: [
            {
              type: 'text',
              text: 'Usage:\n  --init     Create architecture.yaml template\n  --check    Check for violations\n  --enforce  Fail if violations exist',
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Architecture check failed: ${String(error)}` }],
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

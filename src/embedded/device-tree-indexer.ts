/**
 * Device Tree Indexer
 * Scans and indexes .dts/.dtsi files for embedded Linux projects
 * Supports Radxa, Jetson, Raspberry Pi, and other SBC platforms
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * A single device tree node
 */
export interface DeviceTreeNode {
  name: string;
  path: string;
  status: 'okay' | 'disabled' | 'unknown';
  pinctrl: string[];
  file: string;
  line: number;
  compatible?: string | undefined;
  reg?: string | undefined;
}

/**
 * Result of device tree scanning
 */
export interface DeviceTreeIndex {
  platform: string;
  soc: string;
  files: string[];
  nodes: DeviceTreeNode[];
}

/**
 * Pin conflict
 */
export interface PinConflict {
  pins: string[];
  nodes: string[];
  description: string;
}

/**
 * Node check result
 */
export interface NodeCheckResult {
  exists: boolean;
  status?: 'okay' | 'disabled' | 'unknown' | undefined;
  warning?: string | undefined;
  node?: DeviceTreeNode | undefined;
}

/**
 * DeviceTreeIndexer - Parses and indexes device tree files
 */
export class DeviceTreeIndexer {
  private workingDir: string;
  private index: DeviceTreeIndex;
  private pinMappings: Map<string, string[]> = new Map();

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
    this.index = {
      platform: 'unknown',
      soc: 'unknown',
      files: [],
      nodes: [],
    };
  }

  /**
   * Scan directory for device tree files
   */
  async scan(): Promise<DeviceTreeIndex> {
    this.index = {
      platform: 'unknown',
      soc: 'unknown',
      files: [],
      nodes: [],
    };
    this.pinMappings.clear();

    // Find all .dts and .dtsi files
    const files = await this.findDtsFiles(this.workingDir);
    this.index.files = files;

    // Parse each file
    for (const file of files) {
      await this.parseFile(file);
    }

    return this.index;
  }

  /**
   * Find all .dts and .dtsi files recursively
   */
  private async findDtsFiles(dir: string): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip common non-source directories
          if (!['node_modules', '.git', 'build', 'dist'].includes(entry.name)) {
            const subFiles = await this.findDtsFiles(fullPath);
            results.push(...subFiles);
          }
        } else if (entry.name.endsWith('.dts') || entry.name.endsWith('.dtsi')) {
          results.push(fullPath);
        }
      }
    } catch {
      // Directory not accessible
    }

    return results;
  }

  /**
   * Parse a device tree file
   */
  private async parseFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Extract platform and SoC from compatible string
    const compatMatch = content.match(/compatible\s*=\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?/);
    if (compatMatch) {
      const firstCompat = compatMatch[1] ?? '';
      const secondCompat = compatMatch[2];

      // Parse platform from first compatible
      if (firstCompat.includes('radxa')) {
        this.index.platform = firstCompat.replace(/,/g, '-').replace('radxa-', 'radxa-');
        if (this.index.platform.includes(',')) {
          this.index.platform = 'radxa-' + firstCompat.split(',')[1];
        } else {
          this.index.platform = firstCompat.replace('radxa,', 'radxa-');
        }
      } else if (firstCompat.includes('nvidia')) {
        this.index.platform = 'jetson-' + (firstCompat.split(',')[1] ?? 'unknown');
      } else if (firstCompat.includes('raspberrypi') || firstCompat.includes('brcm')) {
        this.index.platform = 'rpi-' + (firstCompat.split(',')[1] ?? 'unknown');
      }

      // Parse SoC from second compatible
      if (secondCompat) {
        const socMatch = secondCompat.match(/rockchip,(\w+)|nvidia,(\w+)|brcm,(\w+)/);
        if (socMatch) {
          this.index.soc = socMatch[1] ?? socMatch[2] ?? socMatch[3] ?? 'unknown';
        }
      }
    }

    // Parse nodes
    let currentDepth = 0;
    let nodeStack: Array<{ name: string; label: string; path: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNum = i + 1;

      // Track braces for depth
      const openBraces = (line.match(/{/g) ?? []).length;
      const closeBraces = (line.match(/}/g) ?? []).length;

      // Node definition: label: name@address {
      const nodeMatch = line.match(/^\s*(\w+):\s*(\w+)@([\da-fA-F]+)\s*\{/);
      if (nodeMatch) {
        const label = nodeMatch[1] ?? '';
        const name = nodeMatch[2] ?? '';
        const address = nodeMatch[3] ?? '';
        const nodePath = nodeStack.length > 0 ? `${nodeStack[nodeStack.length - 1]?.path ?? ''}/${name}@${address}` : `/${name}@${address}`;

        nodeStack.push({ name, label, path: nodePath });

        // Create node entry
        const node: DeviceTreeNode = {
          name: label,
          path: nodePath,
          status: 'unknown',
          pinctrl: [],
          file: path.relative(this.workingDir, filePath),
          line: lineNum,
        };

        // Look ahead for properties
        let j = i + 1;
        let nodeContent = '';
        let braceCount = 1;

        while (j < lines.length && braceCount > 0) {
          const nextLine = lines[j] ?? '';
          braceCount += (nextLine.match(/{/g) ?? []).length;
          braceCount -= (nextLine.match(/}/g) ?? []).length;
          nodeContent += nextLine + '\n';
          j++;
        }

        // Extract status
        const statusMatch = nodeContent.match(/status\s*=\s*"(okay|disabled)"/);
        if (statusMatch) {
          node.status = statusMatch[1] as 'okay' | 'disabled';
        }

        // Extract pinctrl
        const pinctrlMatches = nodeContent.matchAll(/pinctrl-\d+\s*=\s*<([^>]+)>/g);
        for (const pinMatch of pinctrlMatches) {
          const refs = (pinMatch[1] ?? '').split(/\s+/).filter((r) => r.startsWith('&'));
          for (const ref of refs) {
            node.pinctrl.push(ref.replace('&', ''));
          }
        }

        // Extract compatible
        const nodeCompatMatch = nodeContent.match(/compatible\s*=\s*"([^"]+)"/);
        if (nodeCompatMatch) {
          node.compatible = nodeCompatMatch[1];
        }

        this.index.nodes.push(node);
      }

      // Track pinctrl definitions
      const pinctrlDefMatch = line.match(/(\w+):\s*\w+-\w+\s*\{/);
      if (pinctrlDefMatch) {
        const pinName = pinctrlDefMatch[1] ?? '';
        // Look for rockchip,pins or similar
        let j = i + 1;
        let braceCount = 1;
        const pins: string[] = [];

        while (j < lines.length && braceCount > 0) {
          const nextLine = lines[j] ?? '';
          braceCount += (nextLine.match(/{/g) ?? []).length;
          braceCount -= (nextLine.match(/}/g) ?? []).length;

          const pinsMatch = nextLine.match(/(?:rockchip|fsl),pins\s*=\s*<([^>]+)>/);
          if (pinsMatch) {
            const pinDefs = (pinsMatch[1] ?? '').split(/>,\s*</);
            for (const pinDef of pinDefs) {
              const parts = pinDef.trim().replace(/[<>]/g, '').split(/\s+/);
              if (parts.length >= 2) {
                pins.push(`GPIO${parts[0]}_${parts[1]}`);
              }
            }
          }
          j++;
        }

        if (pins.length > 0) {
          this.pinMappings.set(pinName, pins);
        }
      }

      // Update depth
      currentDepth += openBraces - closeBraces;
      if (closeBraces > 0 && nodeStack.length > 0) {
        for (let k = 0; k < closeBraces && nodeStack.length > 0; k++) {
          nodeStack.pop();
        }
      }
    }
  }

  /**
   * Check if a node reference exists
   */
  async checkNode(reference: string): Promise<NodeCheckResult> {
    // Remove & prefix if present
    const nodeName = reference.replace(/^&/, '');

    const node = this.index.nodes.find((n) => n.name === nodeName);

    if (!node) {
      return {
        exists: false,
      };
    }

    const result: NodeCheckResult = {
      exists: true,
      status: node.status,
      node,
    };

    if (node.status === 'disabled') {
      result.warning = `Node &${nodeName} exists but is disabled. Enable it by setting status = "okay"`;
    }

    return result;
  }

  /**
   * Detect pin muxing conflicts
   */
  async detectConflicts(): Promise<PinConflict[]> {
    const conflicts: PinConflict[] = [];

    // Get enabled nodes with pinctrl
    const enabledNodes = this.index.nodes.filter(
      (n) => n.status === 'okay' && n.pinctrl.length > 0
    );

    // Build pin -> node mapping
    const pinUsage = new Map<string, string[]>();

    for (const node of enabledNodes) {
      for (const pinctrl of node.pinctrl) {
        const pins = this.pinMappings.get(pinctrl) ?? [];
        for (const pin of pins) {
          const users = pinUsage.get(pin) ?? [];
          users.push(node.name);
          pinUsage.set(pin, users);
        }
      }
    }

    // Find conflicts (pin used by multiple nodes)
    for (const [pin, users] of pinUsage) {
      if (users.length > 1) {
        conflicts.push({
          pins: [pin],
          nodes: users,
          description: `Pin ${pin} is used by multiple enabled nodes: ${users.join(', ')}`,
        });
      }
    }

    return conflicts;
  }

  /**
   * List available nodes by type
   */
  async listAvailable(type: string): Promise<DeviceTreeNode[]> {
    return this.index.nodes.filter(
      (n) => n.name.startsWith(type) && n.status === 'okay'
    );
  }

  /**
   * Get the current index
   */
  getIndex(): DeviceTreeIndex {
    return this.index;
  }

  /**
   * Save index to file
   */
  async saveIndex(): Promise<void> {
    const indexDir = path.join(this.workingDir, '.engineering', 'index');
    await fs.mkdir(indexDir, { recursive: true });

    const { stringify } = await import('yaml');
    await fs.writeFile(
      path.join(indexDir, 'device-tree.yaml'),
      stringify(this.index, { indent: 2 }),
      'utf-8'
    );
  }

  /**
   * Format summary for display
   */
  getSummary(): string {
    let output = `# Device Tree Index\n\n`;
    output += `Platform: ${this.index.platform}\n`;
    output += `SoC: ${this.index.soc}\n`;
    output += `Files: ${this.index.files.length}\n`;
    output += `Nodes: ${this.index.nodes.length}\n\n`;

    // Group nodes by type
    const byType = new Map<string, DeviceTreeNode[]>();
    for (const node of this.index.nodes) {
      const type = node.name.replace(/\d+$/, '');
      const nodes = byType.get(type) ?? [];
      nodes.push(node);
      byType.set(type, nodes);
    }

    output += `## Nodes by Type\n`;
    for (const [type, nodes] of byType) {
      const enabled = nodes.filter((n) => n.status === 'okay').length;
      output += `- ${type}: ${enabled}/${nodes.length} enabled\n`;
    }

    return output;
  }

  /**
   * Set working directory
   */
  setWorkingDir(dir: string): void {
    this.workingDir = dir;
  }
}

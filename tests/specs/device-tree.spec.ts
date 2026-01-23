/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the behavioral contract for eng_dts (device tree specialist).
 * If a test fails, FIX THE SOURCE CODE, not the test.
 *
 * @see ROADMAP-V2.md Phase 1.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DeviceTreeIndexer, DeviceTreeNode, DeviceTreeIndex } from '../../src/embedded/device-tree-indexer.js';

/**
 * SPEC: Device Tree Scanning
 *
 * REQUIREMENT: The indexer MUST scan and parse .dts and .dtsi files.
 */
describe('[SPEC] DeviceTreeIndexer - Basic Scanning', () => {
  let tempDir: string;
  let indexer: DeviceTreeIndexer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-dts-'));
    indexer = new DeviceTreeIndexer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST find .dts files
   */
  it('MUST find .dts files', async () => {
    const dtsContent = `
/dts-v1/;

/ {
    compatible = "radxa,cm5", "rockchip,rk3588s";
    model = "Radxa CM5";
};
`;
    await fs.writeFile(path.join(tempDir, 'board.dts'), dtsContent, 'utf-8');

    const result = await indexer.scan();

    expect(result.files.length).toBe(1);
    expect(result.files[0]).toContain('board.dts');
  });

  /**
   * GOLDEN TEST: MUST find .dtsi files
   */
  it('MUST find .dtsi files (include files)', async () => {
    const dtsiContent = `
/ {
    i2c0: i2c@fdd40000 {
        compatible = "rockchip,rk3588-i2c";
        status = "disabled";
    };
};
`;
    await fs.writeFile(path.join(tempDir, 'rk3588s.dtsi'), dtsiContent, 'utf-8');

    const result = await indexer.scan();

    expect(result.files.length).toBe(1);
    expect(result.files[0]).toContain('rk3588s.dtsi');
  });

  /**
   * GOLDEN TEST: MUST detect platform from compatible string
   */
  it('MUST detect platform from compatible string', async () => {
    const dtsContent = `
/dts-v1/;

/ {
    compatible = "radxa,cm5", "rockchip,rk3588s";
    model = "Radxa CM5";
};
`;
    await fs.writeFile(path.join(tempDir, 'board.dts'), dtsContent, 'utf-8');

    const result = await indexer.scan();

    expect(result.platform).toBe('radxa-cm5');
    expect(result.soc).toBe('rk3588s');
  });
});

/**
 * SPEC: Node Parsing
 *
 * REQUIREMENT: The indexer MUST parse device tree nodes and extract key properties.
 */
describe('[SPEC] DeviceTreeIndexer - Node Parsing', () => {
  let tempDir: string;
  let indexer: DeviceTreeIndexer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-dts-node-'));
    indexer = new DeviceTreeIndexer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST extract node name and path
   */
  it('MUST extract node name and path', async () => {
    const dtsContent = `
/dts-v1/;

/ {
    i2c0: i2c@fdd40000 {
        compatible = "rockchip,rk3588-i2c";
        status = "okay";
    };
};
`;
    await fs.writeFile(path.join(tempDir, 'board.dts'), dtsContent, 'utf-8');

    const result = await indexer.scan();

    expect(result.nodes.length).toBeGreaterThan(0);
    const i2cNode = result.nodes.find(n => n.name === 'i2c0');
    expect(i2cNode).toBeDefined();
    expect(i2cNode?.path).toBe('/i2c@fdd40000');
  });

  /**
   * GOLDEN TEST: MUST extract status property
   */
  it('MUST extract status property', async () => {
    const dtsContent = `
/dts-v1/;

/ {
    i2c0: i2c@fdd40000 {
        status = "okay";
    };

    i2c1: i2c@fdd50000 {
        status = "disabled";
    };
};
`;
    await fs.writeFile(path.join(tempDir, 'board.dts'), dtsContent, 'utf-8');

    const result = await indexer.scan();

    const enabledNode = result.nodes.find(n => n.name === 'i2c0');
    const disabledNode = result.nodes.find(n => n.name === 'i2c1');

    expect(enabledNode?.status).toBe('okay');
    expect(disabledNode?.status).toBe('disabled');
  });

  /**
   * GOLDEN TEST: MUST extract pin configuration
   */
  it('MUST extract pin configuration', async () => {
    const dtsContent = `
/dts-v1/;

/ {
    i2c0: i2c@fdd40000 {
        status = "okay";
        pinctrl-names = "default";
        pinctrl-0 = <&i2c0_xfer>;
    };
};
`;
    await fs.writeFile(path.join(tempDir, 'board.dts'), dtsContent, 'utf-8');

    const result = await indexer.scan();

    const i2cNode = result.nodes.find(n => n.name === 'i2c0');
    expect(i2cNode?.pinctrl).toContain('i2c0_xfer');
  });
});

/**
 * SPEC: Node Validation
 *
 * REQUIREMENT: The indexer MUST validate node references.
 */
describe('[SPEC] DeviceTreeIndexer - Node Validation', () => {
  let tempDir: string;
  let indexer: DeviceTreeIndexer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-dts-validate-'));
    indexer = new DeviceTreeIndexer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST check if node exists
   */
  it('MUST check if node reference exists', async () => {
    const dtsContent = `
/dts-v1/;

/ {
    i2c0: i2c@fdd40000 {
        status = "okay";
    };
};
`;
    await fs.writeFile(path.join(tempDir, 'board.dts'), dtsContent, 'utf-8');

    await indexer.scan();

    const existsResult = await indexer.checkNode('&i2c0');
    const notExistsResult = await indexer.checkNode('&i2c5');

    expect(existsResult.exists).toBe(true);
    expect(notExistsResult.exists).toBe(false);
  });

  /**
   * GOLDEN TEST: MUST return node status in check
   */
  it('MUST return node status in check result', async () => {
    const dtsContent = `
/dts-v1/;

/ {
    i2c0: i2c@fdd40000 {
        status = "disabled";
    };
};
`;
    await fs.writeFile(path.join(tempDir, 'board.dts'), dtsContent, 'utf-8');

    await indexer.scan();

    const result = await indexer.checkNode('&i2c0');

    expect(result.exists).toBe(true);
    expect(result.status).toBe('disabled');
    expect(result.warning).toContain('disabled');
  });
});

/**
 * SPEC: Pin Conflict Detection
 *
 * REQUIREMENT: The indexer MUST detect pin muxing conflicts.
 */
describe('[SPEC] DeviceTreeIndexer - Pin Conflict Detection', () => {
  let tempDir: string;
  let indexer: DeviceTreeIndexer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-dts-conflict-'));
    indexer = new DeviceTreeIndexer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST detect conflicting pin usage
   */
  it('MUST detect conflicting pin usage', async () => {
    const dtsContent = `
/dts-v1/;

/ {
    i2c0: i2c@fdd40000 {
        status = "okay";
        pinctrl-0 = <&i2c0_xfer>;  /* Uses GPIO0_B1, GPIO0_B2 */
    };

    uart0: uart@fe2a0000 {
        status = "okay";
        pinctrl-0 = <&uart0_xfer>; /* Also uses GPIO0_B1, GPIO0_B2 on some boards */
    };
};

&pinctrl {
    i2c0 {
        i2c0_xfer: i2c0-xfer {
            rockchip,pins = <0 9 1 &pcfg_pull_none>,
                           <0 10 1 &pcfg_pull_none>;
        };
    };

    uart0 {
        uart0_xfer: uart0-xfer {
            rockchip,pins = <0 9 1 &pcfg_pull_none>,
                           <0 10 1 &pcfg_pull_none>;
        };
    };
};
`;
    await fs.writeFile(path.join(tempDir, 'board.dts'), dtsContent, 'utf-8');

    await indexer.scan();
    const conflicts = await indexer.detectConflicts();

    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].pins).toBeDefined();
  });

  /**
   * GOLDEN TEST: MUST NOT report conflicts for disabled nodes
   */
  it('MUST NOT report conflicts for disabled nodes', async () => {
    const dtsContent = `
/dts-v1/;

/ {
    i2c0: i2c@fdd40000 {
        status = "okay";
        pinctrl-0 = <&i2c0_xfer>;
    };

    uart0: uart@fe2a0000 {
        status = "disabled";
        pinctrl-0 = <&uart0_xfer>;  /* Same pins but disabled */
    };
};
`;
    await fs.writeFile(path.join(tempDir, 'board.dts'), dtsContent, 'utf-8');

    await indexer.scan();
    const conflicts = await indexer.detectConflicts();

    // No conflicts because uart0 is disabled
    expect(conflicts.length).toBe(0);
  });
});

/**
 * SPEC: Available Nodes Listing
 *
 * REQUIREMENT: The indexer MUST list available nodes by type.
 */
describe('[SPEC] DeviceTreeIndexer - Available Nodes', () => {
  let tempDir: string;
  let indexer: DeviceTreeIndexer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-dts-avail-'));
    indexer = new DeviceTreeIndexer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST list nodes by type
   */
  it('MUST list available nodes by type', async () => {
    const dtsContent = `
/dts-v1/;

/ {
    i2c0: i2c@fdd40000 {
        status = "okay";
    };

    i2c1: i2c@fdd50000 {
        status = "disabled";
    };

    i2c2: i2c@fdd60000 {
        status = "okay";
    };

    spi0: spi@fe610000 {
        status = "okay";
    };
};
`;
    await fs.writeFile(path.join(tempDir, 'board.dts'), dtsContent, 'utf-8');

    await indexer.scan();
    const i2cNodes = await indexer.listAvailable('i2c');
    const spiNodes = await indexer.listAvailable('spi');

    // Should only return enabled nodes
    expect(i2cNodes.length).toBe(2); // i2c0 and i2c2 are okay
    expect(spiNodes.length).toBe(1);
  });
});

/**
 * SPEC: Result Structure
 *
 * REQUIREMENT: DeviceTreeIndex MUST contain all required fields.
 */
describe('[SPEC] DeviceTreeIndexer - Result Structure', () => {
  it('MUST return DeviceTreeIndex with all required fields', () => {
    const index: DeviceTreeIndex = {
      platform: 'radxa-cm5',
      soc: 'rk3588s',
      files: ['board.dts'],
      nodes: [
        {
          name: 'i2c0',
          path: '/i2c@fdd40000',
          status: 'okay',
          pinctrl: ['i2c0_xfer'],
          file: 'board.dts',
          line: 5,
        },
      ],
    };

    expect(index).toHaveProperty('platform');
    expect(index).toHaveProperty('soc');
    expect(index).toHaveProperty('files');
    expect(index).toHaveProperty('nodes');
  });

  it('MUST return DeviceTreeNode with all required fields', () => {
    const node: DeviceTreeNode = {
      name: 'i2c0',
      path: '/i2c@fdd40000',
      status: 'okay',
      pinctrl: ['i2c0_xfer'],
      file: 'board.dts',
      line: 5,
    };

    expect(node).toHaveProperty('name');
    expect(node).toHaveProperty('path');
    expect(node).toHaveProperty('status');
    expect(node).toHaveProperty('file');
    expect(node).toHaveProperty('line');
  });
});

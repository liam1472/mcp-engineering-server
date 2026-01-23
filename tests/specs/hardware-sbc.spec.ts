/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the behavioral contract for eng_hardware Linux SBC detection.
 * If a test fails, FIX THE SOURCE CODE, not the test.
 *
 * @see ROADMAP-V2.md Phase 4.1
 */

/// <reference types="vitest/globals" />
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { HardwareIndexer } from '../../src/indexes/hardware-indexer.js';

/**
 * SPEC: Linux SBC Platform Detection
 *
 * REQUIREMENT: The indexer MUST detect Linux SBC platforms from system files.
 */
describe('[SPEC] HardwareIndexer - Linux SBC Detection', () => {
  let tempDir: string;
  let indexer: HardwareIndexer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-sbc-'));
    indexer = new HardwareIndexer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST detect Radxa platform from device-tree compatible
   * Detection: /proc/device-tree/compatible contains "radxa"
   */
  it('MUST detect Radxa platform from device-tree compatible', async () => {
    // Simulate /proc/device-tree/compatible file
    const procDir = path.join(tempDir, 'proc', 'device-tree');
    await fs.mkdir(procDir, { recursive: true });
    // Compatible string format: null-separated list
    await fs.writeFile(
      path.join(procDir, 'compatible'),
      'radxa,cm5\0rockchip,rk3588s\0',
      'utf-8'
    );

    const result = await indexer.detectSBCPlatform();

    expect(result.platform).toBe('radxa');
    expect(result.model).toContain('cm5');
    expect(result.soc).toBe('rk3588s');
  });

  /**
   * GOLDEN TEST: MUST detect Raspberry Pi from device-tree model
   * Detection: /proc/device-tree/model contains "Raspberry Pi"
   */
  it('MUST detect Raspberry Pi from device-tree model', async () => {
    const procDir = path.join(tempDir, 'proc', 'device-tree');
    await fs.mkdir(procDir, { recursive: true });
    await fs.writeFile(
      path.join(procDir, 'model'),
      'Raspberry Pi 5 Model B Rev 1.0\0',
      'utf-8'
    );
    await fs.writeFile(
      path.join(procDir, 'compatible'),
      'raspberrypi,5-model-b\0brcm,bcm2712\0',
      'utf-8'
    );

    const result = await indexer.detectSBCPlatform();

    expect(result.platform).toBe('raspberry-pi');
    expect(result.model).toContain('Raspberry Pi 5');
    expect(result.soc).toBe('bcm2712');
  });

  /**
   * GOLDEN TEST: MUST detect NVIDIA Jetson from nv_tegra_release
   * Detection: /etc/nv_tegra_release exists
   */
  it('MUST detect NVIDIA Jetson from nv_tegra_release', async () => {
    const etcDir = path.join(tempDir, 'etc');
    await fs.mkdir(etcDir, { recursive: true });
    await fs.writeFile(
      path.join(etcDir, 'nv_tegra_release'),
      '# R35 (release), REVISION: 4.1, GCID: 33958178, BOARD: t186ref, EABI: aarch64',
      'utf-8'
    );

    const result = await indexer.detectSBCPlatform();

    expect(result.platform).toBe('jetson');
    expect(result.tegra_release).toContain('R35');
  });

  /**
   * GOLDEN TEST: MUST detect Orange Pi from device-tree compatible
   * Detection: /proc/device-tree/compatible contains "orangepi" or "xunlong"
   */
  it('MUST detect Orange Pi from device-tree compatible', async () => {
    const procDir = path.join(tempDir, 'proc', 'device-tree');
    await fs.mkdir(procDir, { recursive: true });
    await fs.writeFile(
      path.join(procDir, 'compatible'),
      'xunlong,orangepi-5\0rockchip,rk3588s\0',
      'utf-8'
    );

    const result = await indexer.detectSBCPlatform();

    expect(result.platform).toBe('orange-pi');
    expect(result.soc).toBe('rk3588s');
  });

  /**
   * GOLDEN TEST: MUST detect BeagleBone from device-tree compatible
   * Detection: /proc/device-tree/compatible contains "beagleboard" or "beaglebone"
   */
  it('MUST detect BeagleBone from device-tree compatible', async () => {
    const procDir = path.join(tempDir, 'proc', 'device-tree');
    await fs.mkdir(procDir, { recursive: true });
    await fs.writeFile(
      path.join(procDir, 'compatible'),
      'beagleboard,am335x-bone-black\0ti,am33xx\0',
      'utf-8'
    );

    const result = await indexer.detectSBCPlatform();

    expect(result.platform).toBe('beaglebone');
    expect(result.soc).toBe('am33xx');
  });

  /**
   * GOLDEN TEST: MUST return unknown for unrecognized platform
   */
  it('MUST return unknown for unrecognized platform', async () => {
    // No proc/etc directories - simulate non-Linux or unrecognized

    const result = await indexer.detectSBCPlatform();

    expect(result.platform).toBe('unknown');
  });
});

/**
 * SPEC: SBC Info Integration with Hardware Index
 *
 * REQUIREMENT: SBC platform info MUST be included in hardware scan results.
 */
describe('[SPEC] HardwareIndexer - SBC Info in Hardware Index', () => {
  let tempDir: string;
  let indexer: HardwareIndexer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-sbc-index-'));
    indexer = new HardwareIndexer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST include SBC info in scan result
   */
  it('MUST include SBC info in scan result when detected', async () => {
    // Setup Radxa device
    const procDir = path.join(tempDir, 'proc', 'device-tree');
    await fs.mkdir(procDir, { recursive: true });
    await fs.writeFile(
      path.join(procDir, 'compatible'),
      'radxa,rock-5b\0rockchip,rk3588\0',
      'utf-8'
    );
    await fs.writeFile(
      path.join(procDir, 'model'),
      'Radxa ROCK 5B\0',
      'utf-8'
    );

    // Create a simple C file to trigger scan
    await fs.writeFile(
      path.join(tempDir, 'main.c'),
      '#include <gpiod.h>\nint main() { return 0; }',
      'utf-8'
    );

    const result = await indexer.scan();

    expect(result.sbc).toBeDefined();
    expect(result.sbc?.platform).toBe('radxa');
    expect(result.sbc?.model).toContain('ROCK 5B');
    expect(result.sbc?.soc).toBe('rk3588');
  });

  /**
   * GOLDEN TEST: MUST NOT include SBC info when not detected
   */
  it('MUST NOT include SBC info when platform is unknown', async () => {
    // Create a simple C file without SBC markers
    await fs.writeFile(
      path.join(tempDir, 'main.c'),
      'int main() { return 0; }',
      'utf-8'
    );

    const result = await indexer.scan();

    // sbc should be undefined or have platform: 'unknown'
    expect(result.sbc === undefined || result.sbc.platform === 'unknown').toBe(true);
  });
});

/**
 * SPEC: GPIO Chip Detection for Linux SBC
 *
 * REQUIREMENT: The indexer MUST detect available GPIO chips on Linux SBC.
 */
describe('[SPEC] HardwareIndexer - GPIO Chip Detection', () => {
  let tempDir: string;
  let indexer: HardwareIndexer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-gpio-'));
    indexer = new HardwareIndexer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST detect GPIO chips from /sys/class/gpio
   */
  it('MUST detect GPIO chips from sys/class/gpio', async () => {
    // Simulate /sys/class/gpio structure
    const gpioDir = path.join(tempDir, 'sys', 'class', 'gpio');
    await fs.mkdir(gpioDir, { recursive: true });

    // Create gpiochip directories
    const chip0Dir = path.join(gpioDir, 'gpiochip0');
    const chip1Dir = path.join(gpioDir, 'gpiochip128');
    await fs.mkdir(chip0Dir, { recursive: true });
    await fs.mkdir(chip1Dir, { recursive: true });

    // Write labels (typical for Rockchip)
    await fs.writeFile(path.join(chip0Dir, 'label'), 'gpio0', 'utf-8');
    await fs.writeFile(path.join(chip0Dir, 'ngpio'), '32', 'utf-8');
    await fs.writeFile(path.join(chip0Dir, 'base'), '0', 'utf-8');

    await fs.writeFile(path.join(chip1Dir, 'label'), 'gpio4', 'utf-8');
    await fs.writeFile(path.join(chip1Dir, 'ngpio'), '32', 'utf-8');
    await fs.writeFile(path.join(chip1Dir, 'base'), '128', 'utf-8');

    const result = await indexer.detectGPIOChips();

    expect(result.length).toBe(2);
    expect(result[0].label).toBe('gpio0');
    expect(result[0].ngpio).toBe(32);
    expect(result[0].base).toBe(0);
    expect(result[1].label).toBe('gpio4');
    expect(result[1].base).toBe(128);
  });

  /**
   * GOLDEN TEST: MUST return empty array when no GPIO chips found
   */
  it('MUST return empty array when no GPIO chips found', async () => {
    // No sys/class/gpio directory

    const result = await indexer.detectGPIOChips();

    expect(result).toEqual([]);
  });
});

/**
 * SPEC: I2C Bus Detection for Linux SBC
 *
 * REQUIREMENT: The indexer MUST detect available I2C buses.
 */
describe('[SPEC] HardwareIndexer - I2C Bus Detection', () => {
  let tempDir: string;
  let indexer: HardwareIndexer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-i2c-'));
    indexer = new HardwareIndexer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST detect I2C buses from /dev/i2c-*
   */
  it('MUST detect I2C buses from dev directory', async () => {
    // Simulate /dev directory with I2C devices
    const devDir = path.join(tempDir, 'dev');
    await fs.mkdir(devDir, { recursive: true });

    // Create mock device files (just empty files for detection)
    await fs.writeFile(path.join(devDir, 'i2c-0'), '', 'utf-8');
    await fs.writeFile(path.join(devDir, 'i2c-1'), '', 'utf-8');
    await fs.writeFile(path.join(devDir, 'i2c-6'), '', 'utf-8');

    const result = await indexer.detectI2CBuses();

    expect(result.length).toBe(3);
    expect(result).toContain(0);
    expect(result).toContain(1);
    expect(result).toContain(6);
  });

  /**
   * GOLDEN TEST: MUST return empty array when no I2C buses found
   */
  it('MUST return empty array when no I2C buses found', async () => {
    const result = await indexer.detectI2CBuses();

    expect(result).toEqual([]);
  });
});

/**
 * SPEC: SPI Bus Detection for Linux SBC
 *
 * REQUIREMENT: The indexer MUST detect available SPI buses.
 */
describe('[SPEC] HardwareIndexer - SPI Bus Detection', () => {
  let tempDir: string;
  let indexer: HardwareIndexer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-spi-'));
    indexer = new HardwareIndexer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST detect SPI buses from /dev/spidev*
   */
  it('MUST detect SPI buses from dev directory', async () => {
    // Simulate /dev directory with SPI devices
    const devDir = path.join(tempDir, 'dev');
    await fs.mkdir(devDir, { recursive: true });

    // Create mock device files
    await fs.writeFile(path.join(devDir, 'spidev0.0'), '', 'utf-8');
    await fs.writeFile(path.join(devDir, 'spidev0.1'), '', 'utf-8');
    await fs.writeFile(path.join(devDir, 'spidev1.0'), '', 'utf-8');

    const result = await indexer.detectSPIBuses();

    expect(result.length).toBe(3);
    expect(result).toContainEqual({ bus: 0, cs: 0 });
    expect(result).toContainEqual({ bus: 0, cs: 1 });
    expect(result).toContainEqual({ bus: 1, cs: 0 });
  });

  /**
   * GOLDEN TEST: MUST return empty array when no SPI buses found
   */
  it('MUST return empty array when no SPI buses found', async () => {
    const result = await indexer.detectSPIBuses();

    expect(result).toEqual([]);
  });
});

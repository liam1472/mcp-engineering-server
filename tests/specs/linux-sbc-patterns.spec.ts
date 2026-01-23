/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the behavioral contract for Linux SBC security patterns.
 * If a test fails, FIX THE SOURCE CODE, not the test.
 *
 * @see ROADMAP-V2.md Phase 4.2
 *
 * NOTE: YAML severity values are mapped in SafetyPatternMatcher:
 *   - 'critical' → 'critical'
 *   - 'warning' → 'high'
 *   - 'info' → 'medium'
 */

/// <reference types="vitest/globals" />
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SecurityScanner } from '../../src/security/scanner.js';

/**
 * SPEC: Linux SBC Security Patterns
 *
 * REQUIREMENT: The security scanner MUST detect deprecated and unsafe
 * patterns specific to Linux SBC platforms (Radxa, Raspberry Pi, Jetson, etc.)
 */
describe('[SPEC] Linux SBC Security - GPIO sysfs Deprecation', () => {
  let tempDir: string;
  let scanner: SecurityScanner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-sbc-gpio-'));
    scanner = new SecurityScanner(tempDir);
    await scanner.setProfile('embedded');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: sysfs GPIO MUST be flagged as high severity
   * The sysfs interface is deprecated since Linux 4.8
   * (YAML 'warning' maps to 'high' in SecurityFinding)
   */
  it('MUST flag /sys/class/gpio usage as high severity', async () => {
    await fs.writeFile(
      path.join(tempDir, 'gpio.c'),
      `
#include <fcntl.h>
int export_gpio(int pin) {
    int fd = open("/sys/class/gpio/export", O_WRONLY);
    char buf[64];
    sprintf(buf, "%d", pin);
    write(fd, buf, strlen(buf));
    close(fd);
    return 0;
}
`,
      'utf-8'
    );

    const findings = await scanner.scan();
    const gpioFinding = findings.find(
      f => f.pattern.includes('GPIO sysfs') && f.match.includes('/sys/class/gpio')
    );

    expect(gpioFinding).toBeDefined();
    expect(gpioFinding!.severity).toBe('high'); // YAML 'warning' → 'high'
    expect(gpioFinding!.suggestion).toContain('sysfs'); // Message mentions sysfs is deprecated
  });

  /**
   * GOLDEN TEST: Suggestion MUST mention libgpiod
   */
  it('MUST suggest libgpiod as alternative', async () => {
    await fs.writeFile(
      path.join(tempDir, 'gpio.c'),
      'fd = open("/sys/class/gpio/gpio17/value", O_RDWR);',
      'utf-8'
    );

    const findings = await scanner.scan();
    const gpioFinding = findings.find(f => f.pattern.includes('GPIO sysfs'));

    expect(gpioFinding).toBeDefined();
    expect(gpioFinding!.suggestion).toContain('libgpiod');
  });
});

describe('[SPEC] Linux SBC Security - I2C Error Handling', () => {
  let tempDir: string;
  let scanner: SecurityScanner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-sbc-i2c-'));
    scanner = new SecurityScanner(tempDir);
    await scanner.setProfile('embedded');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: I2C transfer without error check MUST be flagged as high severity
   * (YAML 'warning' maps to 'high' in SecurityFinding)
   */
  it('MUST flag i2c_transfer without error check as high severity', async () => {
    await fs.writeFile(
      path.join(tempDir, 'i2c_driver.c'),
      `
int read_sensor(struct i2c_client *client, u8 reg, u8 *val) {
    struct i2c_msg msgs[2] = {
        { .addr = client->addr, .flags = 0, .len = 1, .buf = &reg },
        { .addr = client->addr, .flags = I2C_M_RD, .len = 1, .buf = val }
    };
    i2c_transfer(client->adapter, msgs, 2);
    return 0;
}
`,
      'utf-8'
    );

    const findings = await scanner.scan();
    const i2cFinding = findings.find(
      f => f.pattern.includes('I2C') && f.match.includes('i2c_transfer')
    );

    expect(i2cFinding).toBeDefined();
    expect(i2cFinding!.severity).toBe('high'); // YAML 'warning' → 'high'
    expect(i2cFinding!.suggestion).toContain('error');
  });
});

describe('[SPEC] Linux SBC Security - Device Tree Patterns', () => {
  let tempDir: string;
  let scanner: SecurityScanner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-sbc-dts-'));
    scanner = new SecurityScanner(tempDir);
    await scanner.setProfile('embedded');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: DTS status="okay" MUST be flagged for review as medium severity
   * (YAML 'info' maps to 'medium' in SecurityFinding)
   */
  it('MUST flag status="okay" in DTS as medium severity', async () => {
    await fs.writeFile(
      path.join(tempDir, 'board.dts'),
      `
/dts-v1/;

/ {
    i2c0: i2c@fdd40000 {
        compatible = "rockchip,rk3588-i2c";
        status = "okay";
    };
};
`,
      'utf-8'
    );

    const findings = await scanner.scan();
    const dtsFinding = findings.find(
      f => f.pattern.includes('DTS') && f.match.includes('status')
    );

    expect(dtsFinding).toBeDefined();
    expect(dtsFinding!.severity).toBe('medium'); // YAML 'info' → 'medium'
    expect(dtsFinding!.suggestion).toContain('pinctrl');
  });
});

describe('[SPEC] Linux SBC Security - SPI Patterns', () => {
  let tempDir: string;
  let scanner: SecurityScanner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-sbc-spi-'));
    scanner = new SecurityScanner(tempDir);
    await scanner.setProfile('embedded');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: SPI sync without CS consideration MUST be flagged as medium severity
   * (YAML 'info' maps to 'medium' in SecurityFinding)
   */
  it('MUST flag spi_sync usage for review as medium severity', async () => {
    await fs.writeFile(
      path.join(tempDir, 'spi_driver.c'),
      `
int transfer_data(struct spi_device *spi, u8 *tx, u8 *rx, size_t len) {
    struct spi_transfer t = {
        .tx_buf = tx,
        .rx_buf = rx,
        .len = len,
    };
    struct spi_message m;
    spi_message_init(&m);
    spi_message_add_tail(&t, &m);
    spi_sync(spi, &m);
    return 0;
}
`,
      'utf-8'
    );

    const findings = await scanner.scan();
    const spiFinding = findings.find(
      f => f.pattern.includes('SPI') && f.match.includes('spi_sync')
    );

    expect(spiFinding).toBeDefined();
    expect(spiFinding!.severity).toBe('medium'); // YAML 'info' → 'medium'
  });
});

describe('[SPEC] Linux SBC Security - PWM Patterns', () => {
  let tempDir: string;
  let scanner: SecurityScanner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-sbc-pwm-'));
    scanner = new SecurityScanner(tempDir);
    await scanner.setProfile('embedded');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: PWM enable without config MUST be flagged as medium severity
   * (YAML 'info' maps to 'medium' in SecurityFinding)
   */
  it('MUST flag pwm_enable for config review as medium severity', async () => {
    await fs.writeFile(
      path.join(tempDir, 'pwm_driver.c'),
      `
int start_pwm(struct pwm_device *pwm) {
    pwm_enable(pwm);
    return 0;
}
`,
      'utf-8'
    );

    const findings = await scanner.scan();
    const pwmFinding = findings.find(
      f => f.pattern.includes('PWM') && f.match.includes('pwm_enable')
    );

    expect(pwmFinding).toBeDefined();
    expect(pwmFinding!.severity).toBe('medium'); // YAML 'info' → 'medium'
    expect(pwmFinding!.suggestion).toContain('pwm_config');
  });
});

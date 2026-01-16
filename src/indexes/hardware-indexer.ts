/**
 * Hardware Indexer
 * Indexes hardware configurations for embedded projects (STM32, ESP32, Arduino, etc.)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { stringify } from 'yaml';

interface Peripheral {
  type: string; // GPIO, UART, SPI, I2C, ADC, PWM, etc.
  name: string;
  pins: string[];
  file: string;
  line: number;
}

interface HardwareDefine {
  name: string;
  value: string;
  file: string;
  line: number;
}

interface HardwareIndex {
  peripherals: Peripheral[];
  defines: HardwareDefine[];
}

// Patterns for detecting hardware configurations
const PERIPHERAL_PATTERNS = [
  // GPIO: GPIO_PIN_0, GPIOA, PA0, etc.
  { regex: /GPIO[A-H]?_?(?:PIN_)?(\d+|[A-H]\d+)/gi, type: 'GPIO' },
  // UART/USART: USART1, UART2, Serial1
  { regex: /U(?:S)?ART(\d+)|Serial(\d+)/gi, type: 'UART' },
  // SPI: SPI1, HSPI, VSPI
  { regex: /(?:H|V)?SPI(\d+)?/gi, type: 'SPI' },
  // I2C: I2C1, Wire, TwoWire
  { regex: /I2C(\d+)?|Wire\d?|TwoWire/gi, type: 'I2C' },
  // ADC: ADC1, analogRead
  { regex: /ADC(\d+)?|analogRead/gi, type: 'ADC' },
  // PWM: PWM, analogWrite, ledcSetup
  { regex: /PWM|analogWrite|ledcSetup|ledcAttachPin/gi, type: 'PWM' },
  // Timer: TIM1, Timer1
  { regex: /TIM(?:ER)?(\d+)/gi, type: 'TIMER' },
  // DMA: DMA1, DMA_Channel
  { regex: /DMA(\d+)?_?(?:Channel_)?(\d+)?/gi, type: 'DMA' },
];

// Pin mapping patterns
const PIN_PATTERNS = [
  // Arduino-style: pinMode(13, OUTPUT), digitalWrite(LED_PIN, HIGH)
  /pinMode\s*\(\s*(\w+)\s*,/gi,
  /(?:digital|analog)(?:Write|Read)\s*\(\s*(\w+)/gi,
  // STM32 HAL: HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET)
  /HAL_GPIO_\w+\s*\(\s*(GPIO[A-H])\s*,\s*(GPIO_PIN_\d+)/gi,
  // ESP-IDF: gpio_set_level(GPIO_NUM_2, 1)
  /gpio_\w+\s*\(\s*(GPIO_NUM_\d+)/gi,
  // Zephyr: gpio_pin_configure(dev, 13, GPIO_OUTPUT)
  /gpio_pin_\w+\s*\([^,]+,\s*(\d+)/gi,
];

// Hardware defines patterns
const DEFINE_PATTERNS = [
  // #define LED_PIN 13
  /#define\s+(\w+)\s+(\d+|0x[0-9A-Fa-f]+|GPIO\w+)/g,
  // const int LED_PIN = 13
  /const\s+(?:int|uint\d+_t)\s+(\w+)\s*=\s*(\d+|0x[0-9A-Fa-f]+)/g,
  // constexpr auto LED_PIN = 13
  /constexpr\s+\w+\s+(\w+)\s*=\s*(\d+|0x[0-9A-Fa-f]+)/g,
  // LED_PIN = const(13) - MicroPython
  /(\w+)\s*=\s*(?:const\s*)?\(\s*(\d+)\s*\)/g,
];

export class HardwareIndexer {
  private workingDir: string;
  private index: HardwareIndex = { peripherals: [], defines: [] };

  constructor(workingDir?: string) {
    this.workingDir = workingDir ?? process.cwd();
  }

  async scan(): Promise<HardwareIndex> {
    this.index = { peripherals: [], defines: [] };

    // Find hardware-related files
    const files = await glob(
      [
        '**/*.c',
        '**/*.h',
        '**/*.cpp',
        '**/*.hpp',
        '**/*.ino',
        '**/*.py',
        '**/main.c',
        '**/main.cpp',
      ],
      {
        cwd: this.workingDir,
        nodir: true,
        ignore: [
          '**/node_modules/**',
          '**/build/**',
          '**/.git/**',
          '**/Drivers/**', // Skip HAL/LL driver files
          '**/Middlewares/**',
          '**/CMSIS/**',
        ],
      }
    );

    for (const file of files) {
      await this.scanFile(file);
    }

    // Also scan .ioc files for STM32
    const iocFiles = await glob('**/*.ioc', {
      cwd: this.workingDir,
      nodir: true,
    });

    for (const iocFile of iocFiles) {
      await this.scanIocFile(iocFile);
    }

    // Scan sdkconfig for ESP-IDF
    try {
      await this.scanSdkConfig();
    } catch {
      // No sdkconfig
    }

    return this.index;
  }

  private async scanFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.workingDir, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        if (!line) continue;

        // Check for peripheral usage
        for (const pattern of PERIPHERAL_PATTERNS) {
          pattern.regex.lastIndex = 0;
          const match = pattern.regex.exec(line);

          if (match) {
            // Extract pins from the line
            const pins = this.extractPins(line);

            this.index.peripherals.push({
              type: pattern.type,
              name: match[0],
              pins,
              file: filePath,
              line: lineNum + 1,
            });
          }
        }

        // Check for defines
        for (const pattern of DEFINE_PATTERNS) {
          pattern.lastIndex = 0;
          const match = pattern.exec(line);

          if (match && this.isHardwareDefine(match[1] ?? '')) {
            this.index.defines.push({
              name: match[1] ?? '',
              value: match[2] ?? '',
              file: filePath,
              line: lineNum + 1,
            });
          }
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  private async scanIocFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.workingDir, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        if (!line) continue;

        // Parse .ioc format: PA5.GPIO_Label=LED_GREEN
        const pinMatch = /^(P[A-H]\d+)\.(\w+)=(.+)$/i.exec(line);
        if (pinMatch) {
          const [, pin, property, value] = pinMatch;

          if (property === 'Signal' || property === 'Mode') {
            this.index.peripherals.push({
              type: this.determinePeripheralType(value ?? ''),
              name: value ?? '',
              pins: [pin ?? ''],
              file: filePath,
              line: lineNum + 1,
            });
          }
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  private async scanSdkConfig(): Promise<void> {
    const sdkConfigPath = path.join(this.workingDir, 'sdkconfig');
    const content = await fs.readFile(sdkConfigPath, 'utf-8');
    const lines = content.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      if (!line || line.startsWith('#')) continue;

      // CONFIG_GPIO_NUM=5
      const configMatch = /^CONFIG_(\w+)=(\d+)$/i.exec(line);
      const configName = configMatch?.[1];
      const configValue = configMatch?.[2];
      if (
        configMatch !== null &&
        configName !== undefined &&
        (configName.includes('GPIO') || configName.includes('PIN'))
      ) {
        this.index.defines.push({
          name: configName,
          value: configValue ?? '',
          file: 'sdkconfig',
          line: lineNum + 1,
        });
      }
    }
  }

  private extractPins(line: string): string[] {
    const pins: string[] = [];

    for (const pattern of PIN_PATTERNS) {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(line)) !== null) {
        if (match[1]) pins.push(match[1]);
        if (match[2]) pins.push(match[2]);
      }
    }

    return [...new Set(pins)]; // Remove duplicates
  }

  private isHardwareDefine(name: string): boolean {
    const hardwareKeywords = [
      'PIN',
      'GPIO',
      'LED',
      'BTN',
      'BUTTON',
      'SPI',
      'I2C',
      'UART',
      'USART',
      'ADC',
      'DAC',
      'PWM',
      'TIM',
      'DMA',
      'IRQ',
      'INT',
      'PORT',
      'BAUD',
      'FREQ',
      'CLOCK',
    ];

    const upperName = name.toUpperCase();
    return hardwareKeywords.some(kw => upperName.includes(kw));
  }

  private determinePeripheralType(signal: string): string {
    const upperSignal = signal.toUpperCase();

    if (upperSignal.includes('GPIO')) return 'GPIO';
    if (upperSignal.includes('UART') || upperSignal.includes('USART')) return 'UART';
    if (upperSignal.includes('SPI')) return 'SPI';
    if (upperSignal.includes('I2C')) return 'I2C';
    if (upperSignal.includes('ADC')) return 'ADC';
    if (upperSignal.includes('DAC')) return 'DAC';
    if (upperSignal.includes('TIM') || upperSignal.includes('PWM')) return 'TIMER';
    if (upperSignal.includes('DMA')) return 'DMA';
    if (upperSignal.includes('CAN')) return 'CAN';
    if (upperSignal.includes('USB')) return 'USB';
    if (upperSignal.includes('ETH')) return 'ETHERNET';

    return 'OTHER';
  }

  async saveIndex(): Promise<string> {
    const indexPath = path.join(this.workingDir, '.engineering', 'index', 'hardware.yaml');
    await fs.mkdir(path.dirname(indexPath), { recursive: true });

    const content = stringify(this.index, { indent: 2 });
    await fs.writeFile(indexPath, content, 'utf-8');

    return indexPath;
  }

  getIndex(): HardwareIndex {
    return this.index;
  }

  getSummary(): string {
    const peripheralTypes = new Map<string, number>();
    for (const p of this.index.peripherals) {
      peripheralTypes.set(p.type, (peripheralTypes.get(p.type) ?? 0) + 1);
    }

    let summary = `Hardware Configuration:\n`;
    summary += `  Peripherals: ${this.index.peripherals.length}\n`;

    for (const [type, count] of peripheralTypes) {
      summary += `    ${type}: ${count}\n`;
    }

    summary += `  Defines: ${this.index.defines.length}\n`;

    return summary;
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
    this.index = { peripherals: [], defines: [] };
  }
}

/**
 * Unit tests for indexes/hardware-indexer.ts
 */

/// <reference types="vitest/globals" />
import * as path from 'path';
import { HardwareIndexer } from '../../../src/indexes/hardware-indexer.js';
import { createTempDir, cleanupTempDir, writeTestFile, fileExists } from '../../setup.js';

describe('indexes/hardware-indexer.ts', () => {
  describe('HardwareIndexer', () => {
    let tempDir: string;
    let indexer: HardwareIndexer;

    beforeEach(async () => {
      tempDir = await createTempDir('hardware-test');
      indexer = new HardwareIndexer(tempDir);
    });

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('scan() - GPIO', () => {
      it('should detect GPIO usage', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.c'),
          `HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET);`
        );

        const index = await indexer.scan();

        expect(index.peripherals.some(p => p.type === 'GPIO')).toBe(true);
      });

      it('should detect Arduino pinMode', async () => {
        await writeTestFile(
          path.join(tempDir, 'sketch.ino'),
          `void setup() {
  pinMode(13, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
}`
        );

        const index = await indexer.scan();

        // pinMode indicates GPIO usage - MUST detect GPIO peripherals
        expect(index.peripherals.some(p => p.type === 'GPIO')).toBe(true);
      });

      it('should detect ESP-IDF GPIO', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.c'),
          `gpio_set_level(GPIO_NUM_2, 1);
#define LED_GPIO_PIN 5`
        );

        const index = await indexer.scan();

        // gpio_set_level MUST be detected as GPIO, and LED_GPIO_PIN as define
        expect(index.peripherals.some(p => p.type === 'GPIO')).toBe(true);
        expect(index.defines.some(d => d.name === 'LED_GPIO_PIN')).toBe(true);
      });
    });

    describe('scan() - UART', () => {
      it('should detect UART usage', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.c'),
          `HAL_UART_Transmit(&huart1, data, len, 100);`
        );

        const index = await indexer.scan();

        expect(index.peripherals.some(p => p.type === 'UART')).toBe(true);
      });

      it('should detect Arduino Serial', async () => {
        await writeTestFile(
          path.join(tempDir, 'sketch.ino'),
          `Serial1.begin(9600);
Serial1.println("Hello");`
        );

        const index = await indexer.scan();

        expect(index.peripherals.some(p => p.type === 'UART')).toBe(true);
      });
    });

    describe('scan() - SPI', () => {
      it('should detect SPI usage', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.c'),
          `HAL_SPI_Transmit(&hspi1, data, len, 100);`
        );

        const index = await indexer.scan();

        expect(index.peripherals.some(p => p.type === 'SPI')).toBe(true);
      });

      it('should detect ESP32 SPI', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.c'),
          `spi_bus_initialize(HSPI_HOST, &config, 1);`
        );

        const index = await indexer.scan();

        expect(index.peripherals.some(p => p.type === 'SPI')).toBe(true);
      });
    });

    describe('scan() - I2C', () => {
      it('should detect I2C usage', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.c'),
          `HAL_I2C_Master_Transmit(&hi2c1, addr, data, len, 100);`
        );

        const index = await indexer.scan();

        expect(index.peripherals.some(p => p.type === 'I2C')).toBe(true);
      });

      it('should detect Arduino Wire', async () => {
        await writeTestFile(
          path.join(tempDir, 'sketch.ino'),
          `Wire.begin();
Wire.beginTransmission(0x50);`
        );

        const index = await indexer.scan();

        expect(index.peripherals.some(p => p.type === 'I2C')).toBe(true);
      });
    });

    describe('scan() - ADC', () => {
      it('should detect ADC usage', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.c'),
          `HAL_ADC_Start(&hadc1);
uint32_t value = HAL_ADC_GetValue(&hadc1);`
        );

        const index = await indexer.scan();

        expect(index.peripherals.some(p => p.type === 'ADC')).toBe(true);
      });

      it('should detect Arduino analogRead', async () => {
        await writeTestFile(
          path.join(tempDir, 'sketch.ino'),
          `int value = analogRead(A0);`
        );

        const index = await indexer.scan();

        expect(index.peripherals.some(p => p.type === 'ADC')).toBe(true);
      });
    });

    describe('scan() - PWM', () => {
      it('should detect PWM usage', async () => {
        await writeTestFile(
          path.join(tempDir, 'sketch.ino'),
          `analogWrite(9, 128);`
        );

        const index = await indexer.scan();

        expect(index.peripherals.some(p => p.type === 'PWM')).toBe(true);
      });

      it('should detect ESP32 LEDC', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.c'),
          `ledcSetup(0, 5000, 8);
ledcAttachPin(LED_PIN, 0);`
        );

        const index = await indexer.scan();

        expect(index.peripherals.some(p => p.type === 'PWM')).toBe(true);
      });
    });

    describe('scan() - Defines', () => {
      it('should detect #define for pins', async () => {
        await writeTestFile(
          path.join(tempDir, 'config.h'),
          `#define LED_PIN 13
#define BUTTON_PIN 2
#define SPI_CS_PIN 10`
        );

        const index = await indexer.scan();

        expect(index.defines.some(d => d.name === 'LED_PIN')).toBe(true);
        expect(index.defines.some(d => d.name === 'BUTTON_PIN')).toBe(true);
      });

      it('should detect const int pins', async () => {
        await writeTestFile(
          path.join(tempDir, 'config.cpp'),
          `const int LED_PIN = 13;
const uint8_t GPIO_PIN = 5;`
        );

        const index = await indexer.scan();

        expect(index.defines.some(d => d.name === 'LED_PIN')).toBe(true);
      });

      it('should include file and line info', async () => {
        await writeTestFile(
          path.join(tempDir, 'pins.h'),
          `// Comment
#define LED_PIN 13`
        );

        const index = await indexer.scan();
        const define = index.defines.find(d => d.name === 'LED_PIN');

        expect(define?.file).toBe('pins.h');
        expect(define?.line).toBe(2);
      });
    });

    describe('scan() - STM32 .ioc files', () => {
      it('should parse .ioc pin configurations', async () => {
        await writeTestFile(
          path.join(tempDir, 'project.ioc'),
          `PA5.Signal=GPIO_Output
PA5.GPIO_Label=LED_GREEN
PB6.Signal=USART1_TX
PB7.Signal=USART1_RX`
        );

        const index = await indexer.scan();

        expect(index.peripherals.some(p => p.pins.includes('PA5'))).toBe(true);
        expect(index.peripherals.some(p => p.type === 'UART')).toBe(true);
      });
    });

    describe('getIndex()', () => {
      it('should return scanned index', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.c'),
          `#define LED_PIN 13`
        );

        await indexer.scan();
        const index = indexer.getIndex();

        expect(index.peripherals).toBeDefined();
        expect(index.defines).toBeDefined();
      });

      it('should return empty before scan', () => {
        const index = indexer.getIndex();

        expect(index.peripherals).toEqual([]);
        expect(index.defines).toEqual([]);
      });
    });

    describe('getSummary()', () => {
      it('should return summary of hardware config', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.c'),
          `HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET);
HAL_UART_Transmit(&huart1, data, len, 100);
#define LED_PIN 13`
        );

        await indexer.scan();
        const summary = indexer.getSummary();

        expect(summary).toContain('Hardware Configuration');
        expect(summary).toContain('Peripherals');
        expect(summary).toContain('Defines');
      });

      it('should show peripheral type counts', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.c'),
          `HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, 1);
HAL_GPIO_WritePin(GPIOB, GPIO_PIN_6, 1);
HAL_UART_Transmit(&huart1, data, len, 100);`
        );

        await indexer.scan();
        const summary = indexer.getSummary();

        // Summary should contain some peripheral info
        expect(summary).toContain('Hardware Configuration');
      });
    });

    describe('saveIndex()', () => {
      it('should save index to YAML file', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.c'),
          `#define LED_PIN 13`
        );

        await indexer.scan();
        const indexPath = await indexer.saveIndex();

        expect(indexPath).toContain('hardware.yaml');
        const exists = await fileExists(indexPath);
        expect(exists).toBe(true);
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        const otherDir = await createTempDir('other-hardware');
        await writeTestFile(
          path.join(otherDir, 'main.c'),
          `#define OTHER_PIN 5`
        );

        indexer.setWorkingDir(otherDir);
        const index = await indexer.scan();

        expect(index.defines.some(d => d.name === 'OTHER_PIN')).toBe(true);

        await cleanupTempDir(otherDir);
      });

      it('should clear previous index', async () => {
        await writeTestFile(
          path.join(tempDir, 'main.c'),
          `#define LED_PIN 13`
        );

        await indexer.scan();
        const otherDir = await createTempDir('other-clear');

        indexer.setWorkingDir(otherDir);
        const index = indexer.getIndex();

        expect(index.peripherals).toEqual([]);
        expect(index.defines).toEqual([]);

        await cleanupTempDir(otherDir);
      });
    });

    describe('ignores', () => {
      it('should ignore Drivers directory', async () => {
        await writeTestFile(
          path.join(tempDir, 'Drivers', 'HAL', 'gpio.c'),
          `GPIOA; GPIOB; GPIOC;`
        );
        await writeTestFile(
          path.join(tempDir, 'src', 'main.c'),
          `GPIOD;`
        );

        const index = await indexer.scan();
        const driverPeripherals = index.peripherals.filter(p =>
          p.file.includes('Drivers')
        );

        expect(driverPeripherals.length).toBe(0);
      });
    });
  });
});

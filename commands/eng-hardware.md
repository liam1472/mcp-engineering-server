---
description: Index hardware configurations for embedded projects
allowed-tools: MCP
---

Run the MCP tool `eng_hardware` to index hardware configurations.

Supports:
- STM32 (.ioc files, HAL patterns)
- ESP-IDF (sdkconfig)
- Arduino (.ino files)
- Zephyr RTOS
- Generic C/C++ GPIO patterns

Usage: /eng-hardware

Indexes:
- Peripherals (GPIO, UART, SPI, I2C, ADC, PWM, Timer, DMA)
- Pin definitions and mappings
- Hardware-related #defines

Output saved to `.engineering/index/hardware.yaml`

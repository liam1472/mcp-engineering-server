Device Tree analysis for embedded Linux development.

Usage: /eng-dts [options]

Options:
  --scan              Index all .dts/.dtsi files in project
  --check "<node>"    Validate node reference exists (e.g., "&i2c3")
  --conflicts         Detect pin muxing conflicts
  --available <type>  List available nodes of type (i2c, spi, uart, gpio)

Examples:
  /eng-dts --scan                    # Index device tree files
  /eng-dts --check "&i2c3"           # Validate I2C3 node exists
  /eng-dts --conflicts               # Find pin conflicts
  /eng-dts --available i2c           # List I2C nodes

Features:
- Index .dts and .dtsi files
- Validate node references before compile
- Detect pin muxing conflicts
- Support for Radxa, Jetson, RPi, BeagleBone overlays

Use before compiling device tree to catch errors early.

# EMBEDDED OPERATIONS BLUEPRINT
## Deployment & Operations Standards for Embedded Linux / SoC Systems

> **Project Type:** Embedded Linux (Radxa, NVIDIA Orin, Raspberry Pi, Yocto, Buildroot)
> **Objective:** Reliable deployment, safe OTA updates, production-ready firmware
> **Also applicable:** MCU systems (STM32, ESP32, Zephyr) with adaptations

---

## 🔄 OTA UPDATE REQUIREMENTS

### 1. Dual Rootfs (A/B) Scheme
- [ ] Two rootfs slots: `/rootfs_a` + `/rootfs_b`
- [ ] Atomic switch via symlink or U-Boot env
- [ ] Rollback on boot failure (watchdog or health check)
- [ ] Version tracking in `/etc/firmware-version` or U-Boot env

### 2. OTA Tools (Choose One)
- **RAUC** - Recommended for Yocto/Buildroot
- **SWUpdate** - Feature-rich, Lua scripting
- **Mender** - Cloud-integrated
- **Custom** - U-Boot + rsync/wget

### 3. Update Security
- [ ] Firmware image signature (RSA-2048 / ECDSA-P256)
- [ ] Encrypted transport (HTTPS / TLS 1.2+)
- [ ] Version downgrade protection
- [ ] Hash verification before apply

### OTA Manifest Format
```yaml
# ota-manifest.yaml
firmware:
  version: "2.1.0"
  build_date: "2026-01-17T10:00:00Z"
  target_platform: "radxa-rock5b"  # or "rpi4", "orin-nano"

  # Image Info
  image_type: "rootfs"  # rootfs | kernel | full
  compression: "zstd"
  size_bytes: 524288000
  sha256: "a1b2c3d4e5f6..."

  # Digital Signature
  signature:
    algorithm: "rsa-2048"
    value: "BASE64_SIGNATURE..."
    signer: "release-key-2026"

  # Compatibility
  min_bootloader_version: "2024.01"
  compatible_hw: ["rev1.0", "rev1.1"]
  downgrade_allowed: false

  # Rollback
  rollback_timeout_seconds: 300
  health_check_cmd: "/usr/bin/health-check"
```

### U-Boot Environment for A/B
```bash
# /boot/uEnv.txt or U-Boot env
boot_slot=a                    # a or b
boot_attempts=3
rollback_enabled=1

# Switch logic in bootcmd
if test ${boot_slot} = a; then
    setenv bootargs root=/dev/mmcblk0p2 rootwait
else
    setenv bootargs root=/dev/mmcblk0p3 rootwait
fi
```

---

## 💾 PARTITION LAYOUT

### Linux SoC (eMMC/SD - 16GB+)
| Partition | Mount | Purpose | Size |
|-----------|-------|---------|------|
| boot | /boot | U-Boot, Kernel, DTB | 256 MB |
| rootfs_a | / (slot A) | Root filesystem A | 4-6 GB |
| rootfs_b | / (slot B) | Root filesystem B | 4-6 GB |
| data | /data | Persistent user data | 2+ GB |
| coredump | /var/coredump | Crash dumps | 512 MB |
| logs | /var/log | System logs | 1 GB |

### Example: GPT Layout (sgdisk)
```bash
# Create partitions
sgdisk -n 1:0:+256M -t 1:8300 -c 1:"boot" /dev/mmcblk0
sgdisk -n 2:0:+5G   -t 2:8300 -c 2:"rootfs_a" /dev/mmcblk0
sgdisk -n 3:0:+5G   -t 3:8300 -c 3:"rootfs_b" /dev/mmcblk0
sgdisk -n 4:0:+2G   -t 4:8300 -c 4:"data" /dev/mmcblk0
sgdisk -n 5:0:+512M -t 5:8300 -c 5:"coredump" /dev/mmcblk0
sgdisk -n 6:0:0     -t 6:8300 -c 6:"logs" /dev/mmcblk0
```

### MCU Reference (STM32/ESP32)
| Partition | Purpose | Size |
|-----------|---------|------|
| bootloader | First-stage | 32-64 KB |
| app_a | Active firmware | 384 KB - 2 MB |
| app_b | Backup firmware | 384 KB - 2 MB |
| nvs | Non-volatile storage | 16-64 KB |
| coredump | Crash dumps | 64 KB |

---

## 🏭 FACTORY TEST & PROVISIONING

### Required Self-Tests (Linux SoC)
| Test | Command/Script | Pass Criteria |
|------|----------------|---------------|
| Network | `ip link show eth0` | Interface UP |
| WiFi | `iw dev wlan0 scan` | Scan successful |
| USB | `lsusb` | Expected devices listed |
| I2C | `i2cdetect -y 1` | Devices at expected addresses |
| SPI | `spidev_test -D /dev/spidev0.0` | Loopback OK |
| Camera | `v4l2-ctl --list-devices` | Camera detected |
| GPU | `nvidia-smi` or `vcgencmd measure_temp` | GPU responsive |
| Disk | `dd if=/dev/zero of=/tmp/test bs=1M count=100` | > 50 MB/s |
| Thermal | `cat /sys/class/thermal/thermal_zone0/temp` | < 80°C |
| Memory | `free -m` | Expected RAM available |

### Automated Factory Test Script
```bash
#!/bin/bash
# /usr/bin/factory-test.sh

RESULTS=()
PASS=true

run_test() {
    local name=$1
    local cmd=$2
    local expect=$3

    if eval "$cmd" 2>/dev/null | grep -q "$expect"; then
        RESULTS+=("$name: PASS")
    else
        RESULTS+=("$name: FAIL")
        PASS=false
    fi
}

run_test "eth0" "ip link show eth0" "state UP"
run_test "i2c" "i2cdetect -y 1 | grep -c ':'" "^[1-9]"
run_test "disk" "dd if=/dev/zero of=/tmp/test bs=1M count=10 2>&1 | tail -1" "MB/s"

# Output results
for r in "${RESULTS[@]}"; do echo "$r"; done
$PASS && exit 0 || exit 1
```

### Factory Test Report
```yaml
# factory-test-report.yaml
device_id: "PROD-2026-001234"
serial_number: "SN123456789"
mac_eth0: "AA:BB:CC:DD:EE:FF"
mac_wlan0: "AA:BB:CC:DD:EE:00"
test_date: "2026-01-17T10:30:00Z"
test_station: "FACTORY-LINE-A"
operator: "OP-042"

hardware:
  platform: "radxa-rock5b"
  revision: "v1.1"
  ram_mb: 8192
  emmc_gb: 64

overall_result: PASS
total_duration_seconds: 120

tests:
  - name: "network_eth0"
    result: PASS
    duration_ms: 500
    details: "Link UP, 1000Mbps"

  - name: "network_wlan0"
    result: PASS
    duration_ms: 3000
    details: "5 APs found"

  - name: "i2c_bus1"
    result: PASS
    duration_ms: 200
    devices_found: ["0x50", "0x68"]

  - name: "camera"
    result: PASS
    duration_ms: 1000
    device: "/dev/video0"

  - name: "thermal"
    result: PASS
    cpu_temp_c: 45
    gpu_temp_c: 42

  - name: "disk_speed"
    result: PASS
    read_mbps: 150
    write_mbps: 80

provisioning:
  firmware_version: "2.1.0"
  keys_installed: true
  certificates_installed: true
  unique_id_generated: true

error_codes: []
```

---

## 📊 MONITORING & HEALTH (systemd Service)

### Health Check Service
```ini
# /etc/systemd/system/health-check.service
[Unit]
Description=Health Check HTTP Endpoint
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/health-server --port 8080
Restart=always

[Install]
WantedBy=multi-user.target
```

### Health Check Endpoint
```yaml
# GET http://device:8080/health
# Response:
status: "healthy"  # healthy | degraded | critical
uptime_seconds: 86400
boot_count: 42

system:
  load_average: [0.5, 0.3, 0.2]
  memory_used_mb: 512
  memory_total_mb: 8192
  disk_used_percent: 35
  cpu_temp_celsius: 52
  gpu_temp_celsius: 48

firmware:
  version: "2.1.0"
  rootfs_slot: "a"
  last_ota_check: "2026-01-17T08:00:00Z"

network:
  eth0: "connected"
  wlan0: "connected"
  ip_eth0: "192.168.1.100"

peripherals:
  camera: "ok"
  i2c_sensors: "ok"
  gpio: "ok"

last_reboot:
  reason: "scheduled"  # power_on | watchdog | ota | scheduled | panic
  timestamp: "2026-01-16T02:00:00Z"

event_log:
  - timestamp: "2026-01-17T08:00:00Z"
    level: "info"
    code: "OTA_CHECK"
    message: "OTA check completed, no update available"

  - timestamp: "2026-01-17T07:30:00Z"
    level: "warn"
    code: "TEMP_HIGH"
    message: "CPU temperature reached 75°C"
```

### Prometheus Metrics (Optional)
```
# HELP device_uptime_seconds Device uptime in seconds
device_uptime_seconds 86400

# HELP device_cpu_temp CPU temperature in Celsius
device_cpu_temp 52

# HELP device_memory_used_bytes Memory usage in bytes
device_memory_used_bytes 536870912

# HELP device_rootfs_slot Current rootfs slot (0=a, 1=b)
device_rootfs_slot 0
```

---

## 🔒 SECURITY CHECKLIST

### Boot Security
- [ ] U-Boot verified boot (secure boot chain)
- [ ] Kernel signature verification
- [ ] Read-only rootfs (optional, with overlay)

### Filesystem Security
- [ ] LUKS encryption for `/data` partition
- [ ] File integrity monitoring (AIDE/Tripwire)
- [ ] Proper file permissions (no world-writable)

### Network Security
- [ ] TLS 1.2+ for all connections
- [ ] Certificate pinning for OTA server
- [ ] Firewall rules (iptables/nftables)
- [ ] SSH key-only authentication

### Key Management
- [ ] Device keys in `/etc/ssl/private` (mode 600)
- [ ] TPM/TEE for key storage (if available)
- [ ] Unique per-device certificates
- [ ] Key rotation mechanism

---

## 📋 RELEASE CHECKLIST

### Pre-Release
- [ ] All unit tests passing on target hardware
- [ ] Integration tests completed
- [ ] OTA update dry run (A→B→A)
- [ ] Disk I/O and memory profiling
- [ ] Thermal stress test (30 min at full load)
- [ ] Power consumption measured

### Build & Sign
- [ ] Build from clean CI/CD pipeline
- [ ] Firmware image signed with release key
- [ ] Version string updated in `/etc/firmware-version`
- [ ] Changelog documented

### Deployment
- [ ] OTA manifest uploaded to server
- [ ] Staged rollout (10% → 50% → 100%)
- [ ] Monitoring alerts configured
- [ ] Rollback procedure documented
- [ ] Support team briefed

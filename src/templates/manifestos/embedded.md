# EMBEDDED ENGINEERING MANIFESTO
## Safety-Oriented Embedded Coding Rules

> **Project Type:** Embedded (STM32, ESP32, Arduino, Zephyr)
> **Objective:** Safety-critical, resource-constrained, deterministic code
> Inspired by MISRA C/C++, AUTOSAR C++14, Barr Group Embedded C Coding Standard

---

## ❌ FORBIDDEN (Production Firmware)

### 1. Dynamic Memory Allocation
- `malloc`, `calloc`, `free`, `new`, `delete`

**Rationale:**
Dynamic allocation causes fragmentation, nondeterministic timing, hidden failure modes.

**Allowed only in:**
- Host / PC tools
- Unit tests
- Initialization phase with explicit review

**Preferred:**
- Static buffers
- Fixed-size memory pools

---

### 2. Blocking Delays
- Blocking delay calls in main loop or task context exceeding **X ms (configurable)**

**Rationale:**
Long blocking delays break real-time guarantees and may prevent watchdog servicing.

**Use instead:**
- Timers
- RTOS delay primitives
- Event-driven state machines
- `millis()` or hardware timer

---

### 3. Unsafe Global State
- Shared global variables accessed from ISR ↔ main or multiple tasks

**Unless they are:**
- Declared `volatile` if modified outside current context
- Accessed atomically or protected by mutex / critical section / IRQ disable

---

### 4. Floating Point in ISR
- Avoid `float` / `double` inside interrupts

**Rationale:**
FPU context switching is expensive, causing non-deterministic timing.

**Use instead:**
- Fixed-point arithmetic
- Integer scaling

---

### 5. Forbidden Operations in ISR
- Dynamic memory allocation
- Blocking calls
- Logging / printf-style output
- Heavy computation

---

### 6. Infinite Polling Without Timeout
- Avoid `while(1)` loops without timeout or error handling

**Rationale:** System hang, watchdog trigger

**Use instead:** Timeout + error handling

---

## ✅ REQUIRED (Mandatory Practices)

### 1. Watchdog Timer
- Must be enabled in production firmware
- Must not be refreshed inside blocking loops or long ISR

---

### 2. Interrupt Service Routines (ISR)
- Minimal and deterministic
- Allowed: clear flags, copy minimal data, set events/flags
- Forbidden: malloc/free, blocking calls, logging, heavy computation
- Duration: **≤ X µs** (configurable per project)

---

### 3. Stack Safety
- RTOS stack canary / watermark if supported
- MPU guard region if available
- Runtime stack usage monitoring

---

### 4. Deterministic Execution
- All control paths must have bounded execution time
- Recursion forbidden unless explicitly reviewed and bounded
- WCET considered for ISRs, control loops, safety-critical tasks

---

### 5. Peripheral Access
- Timeout for each I/O operation (I2C, SPI, UART)
- Error recovery / fallback for peripheral failure
- Use DMA when available to reduce CPU load

---

### 6. HAL / Configuration
- Use Hardware Abstraction Layer instead of direct register access
- Pin assignments, clock settings, and interrupt priorities documented in headers

---

## ⚠️ STRONGLY RECOMMENDED / BEST PRACTICES

- Fixed-width integers (`uint32_t`, `int16_t`, …)
- Avoid implicit casts, explicit initialization of variables
- Assertions to catch impossible states
- Prefer compile-time checks over runtime checks
- Sleep mode when idle, disable unused peripherals, clock gating
- Hardware-in-the-loop testing, boundary tests, stress test comms
- Memory map, interrupt vector table, and pin assignment diagrams

---

## 📌 CODE PATTERNS (GOOD vs BAD)

### State Machine Example
```c
// GOOD
static uint32_t lastUpdate = 0;
if (millis() - lastUpdate >= INTERVAL) {
    lastUpdate = millis();
    doWork();
}

// BAD: Blocking delay
delay(1000);
doWork();
```

### ISR Example
```c
// GOOD: Volatile for ISR-shared variable
volatile bool dataReady = false;

void ISR_Handler(void) {
    dataReady = true;  // Set flag only
}

void main_loop(void) {
    if (dataReady) {
        dataReady = false;
        processData();  // Process in main context
    }
}
```

### Static Buffer Example
```c
// GOOD
static uint8_t rxBuffer[RX_BUFFER_SIZE];

// BAD
uint8_t* rxBuffer = malloc(size);
```

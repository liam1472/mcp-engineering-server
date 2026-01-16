# MCP Server Implementation Guide
## Universal Engineering Workflow for AI-Assisted Development

**Version:** 4.0  
**Last Updated:** January 16, 2026  
**Status:** Ready for Implementation

---

## 📋 Executive Summary

MCP Server là công cụ workflow tiêu chuẩn giúp kỹ sư phần mềm làm việc hiệu quả hơn với Claude Code, áp dụng cho **TẤT CẢ** loại dự án:

- **Embedded Systems** (STM32, ESP32, Buildroot)
- **Native Applications** (C#/.NET, C++, Python)
- **Web Applications** (React, Vue, Node.js, ASP.NET)
- **Cross-platform** (Windows, Linux Ubuntu/Debian, macOS)

### Mục tiêu chính:
1. **Bảo toàn context** qua các session Claude
2. **Workflow chuẩn hóa** cho mọi loại dự án
3. **Security-first** - phát hiện secrets, sensitive data
4. **Multi-session** - chạy 2-3 Claude instances song song

---

## 🔑 Key Points cần tập trung (Priority Order)

### P0 - Critical (Phải có trong MVP)

#### 1. Security Scanner Module
```
Mục đích: Phát hiện và cảnh báo sensitive data trước khi commit

Phát hiện:
├── API Keys (AWS, GCP, Azure, OpenAI, Anthropic, etc.)
├── Secrets & Tokens (JWT, OAuth, Bearer tokens)
├── Private Keys (SSH, PEM, certificates)
├── Database credentials (connection strings)
├── Environment variables chứa secrets
├── Hardcoded passwords trong code
└── Personal data (emails, phone numbers trong code)

Tích hợp:
├── Pre-commit hook tự động
├── Real-time scanning khi viết code
├── Cảnh báo trước khi /eng done
└── Whitelist cho false positives

Patterns cần scan:
├── Regex patterns cho các provider phổ biến
├── Entropy-based detection (high entropy strings)
├── Pattern matching cho common secret formats
└── Custom patterns có thể configure
```

#### 2. Universal Project Detection
```
Tự động nhận diện loại dự án:

Embedded:
├── STM32CubeIDE projects (.ioc, .cproject)
├── ESP-IDF projects (CMakeLists.txt + sdkconfig)
├── Buildroot projects (Config.in, .mk files)
├── Zephyr projects (prj.conf, west.yml)
└── Arduino projects (.ino files)

.NET/C#:
├── .csproj, .sln files
├── ASP.NET Core (Program.cs + appsettings.json)
├── WPF/WinForms (App.xaml)
├── MAUI projects
└── Blazor projects

Web:
├── React (package.json + react dependency)
├── Vue (package.json + vue dependency)
├── Angular (angular.json)
├── Node.js/Express (package.json + express)
├── Next.js (next.config.js)
└── Python/Django/Flask (requirements.txt, manage.py)

Native:
├── CMake projects (CMakeLists.txt)
├── Meson projects (meson.build)
├── Makefile projects
├── Cargo/Rust projects (Cargo.toml)
└── Go projects (go.mod)
```

#### 3. Session Context Preservation
```
Vấn đề: Claude mất context sau mỗi session

Giải pháp:
├── Checkpoint system
│   ├── Auto-save mỗi 5 phút
│   ├── Manual checkpoint với /eng checkpoint
│   └── Resume với /eng resume [checkpoint-id]
│
├── Context file (.engineering/context.yaml)
│   ├── current_task: mô tả task đang làm
│   ├── decisions: các quyết định đã đưa ra
│   ├── findings: phát hiện trong quá trình dev
│   ├── blockers: vấn đề đang gặp
│   └── next_steps: các bước tiếp theo
│
└── Knowledge extraction
    ├── Tự động extract patterns sau /eng done
    ├── Lưu solutions cho vấn đề đã giải quyết
    └── Index searchable cho sessions sau
```

### P1 - High Priority (Cần có trong v1.0)

#### 4. Cross-Platform Support
```
Windows:
├── PowerShell integration
├── Visual Studio project detection
├── MSBuild support
├── Windows-specific paths handling
└── .NET SDK detection

Linux (Ubuntu/Debian):
├── Bash integration
├── apt package detection
├── systemd service files
├── Linux kernel config
└── Cross-compilation toolchains

Cross-platform:
├── Path normalization
├── Line ending handling (CRLF/LF)
├── Environment variable syntax
└── Shell command abstraction
```

#### 5. Intelligent Indexing System
```
Universal indexes (cho mọi loại dự án):
├── functions.yaml - Tất cả functions/methods
├── errors.yaml - Error codes, exceptions
├── constants.yaml - Magic numbers, config values
├── dependencies.yaml - Module dependencies
├── security.yaml - Security scan results
└── todos.yaml - TODO/FIXME/HACK comments

Project-specific indexes:
├── Embedded: hardware.yaml, memory.yaml, timing.yaml
├── .NET: namespaces.yaml, nuget.yaml
├── Web: routes.yaml, components.yaml, api.yaml
└── Native: cmake.yaml, targets.yaml
```

#### 6. Duplicate Detection
```
Phát hiện code trùng lặp:
├── Function-level similarity (>70% match)
├── Block-level detection (copy-paste detection)
├── Cross-file analysis
└── Suggest refactoring

Output:
├── Similarity percentage
├── Location of similar code
├── Refactoring suggestions
└── Common extraction candidates
```

### P2 - Medium Priority (v1.1)

#### 7. Multi-Session Coordination
```
Cho phép 2-3 Claude sessions làm việc song song:

Session management:
├── /eng session start A|B|C
├── /eng session status
├── /eng session switch <id>
└── /eng session sync

Conflict prevention:
├── File-level locking
├── Function-level locking (advanced)
├── Automatic task distribution
└── Merge conflict detection

Communication:
├── Discovery sharing giữa sessions
├── Blocking notification
└── Task completion alerts
```

#### 8. Validation Pipeline
```
/eng validate chạy các checks:

Universal:
├── Build/compile check
├── Lint (language-specific)
├── Security scan
├── Duplicate detection
├── Test coverage

Embedded-specific:
├── Stack analysis
├── Memory budget
├── Timing analysis

Web-specific:
├── Bundle size check
├── Accessibility scan
├── Performance audit
└── SEO check (if applicable)

.NET-specific:
├── Code analysis rules
├── NuGet vulnerability scan
└── Assembly compatibility
```

---

## 📁 Project Structure

```
.engineering/                     # Root directory
├── config.yaml                   # Project configuration
│
├── index/                        # Code indexes
│   ├── functions.yaml            # All functions/methods
│   ├── errors.yaml               # Error codes & exceptions
│   ├── constants.yaml            # Named constants
│   ├── dependencies.yaml         # Module dependencies
│   ├── security.yaml             # Security scan results
│   ├── todos.yaml                # TODO/FIXME tracking
│   │
│   ├── # Project-specific (auto-detected)
│   ├── hardware.yaml             # [Embedded] GPIO/UART/DMA map
│   ├── memory.yaml               # [Embedded] Flash/RAM budget
│   ├── routes.yaml               # [Web] API routes
│   ├── components.yaml           # [Web] UI components
│   └── namespaces.yaml           # [.NET] Namespace structure
│
├── knowledge/                    # Accumulated knowledge
│   ├── patterns/                 # Design patterns learned
│   ├── solutions/                # Solutions found
│   └── bugs/                     # Bugs fixed & root causes
│
├── sessions/                     # Session management
│   ├── main.yaml                 # Main state
│   ├── context.yaml              # Current context (for resume)
│   ├── instance-A/               # Session A checkpoints
│   ├── instance-B/               # Session B checkpoints
│   └── locks.yaml                # File/function locks
│
├── features/                     # Active features
│   └── <feature-name>/
│       ├── manifest.yaml         # Dependencies & scope
│       ├── context.yaml          # Feature-specific context
│       └── decisions.md          # Decision log
│
├── security/                     # Security configuration
│   ├── patterns.yaml             # Custom secret patterns
│   ├── whitelist.yaml            # False positive whitelist
│   └── scan-results.yaml         # Latest scan results
│
└── archive/                      # Completed features
    └── YYYY-MM-DD_<name>/
```

---

## 🔧 Command Reference

### Lifecycle Commands

| Command | Description |
|---------|-------------|
| `/eng init [name]` | Initialize project, auto-detect type |
| `/eng scan` | Scan codebase, build indexes |
| `/eng start <feature>` | Start new feature |
| `/eng validate` | Run validation pipeline |
| `/eng security` | Run security scan only |
| `/eng refactor` | Analyze & suggest refactoring |
| `/eng review` | Pre-completion review |
| `/eng done` | Complete feature, extract knowledge |

### Session Commands

| Command | Description |
|---------|-------------|
| `/eng session start <A\|B\|C>` | Start session |
| `/eng session status` | View all sessions |
| `/eng session switch <id>` | Switch to session |
| `/eng session checkpoint [name]` | Save checkpoint |
| `/eng session resume [checkpoint]` | Resume from checkpoint |
| `/eng session sync` | Sync discoveries between sessions |

### Index Commands

| Command | Description |
|---------|-------------|
| `/eng index function <name>` | Search functions |
| `/eng index similar <code>` | Find similar code |
| `/eng index deps <module>` | Show dependencies |
| `/eng search <query>` | Semantic search in knowledge |

### Security Commands

| Command | Description |
|---------|-------------|
| `/eng security scan` | Full security scan |
| `/eng security whitelist <pattern>` | Add to whitelist |
| `/eng security report` | Generate security report |

---

## 🔐 Security Scanner Details

### Supported Secret Patterns

```yaml
patterns:
  # Cloud Providers
  aws_access_key: 'AKIA[0-9A-Z]{16}'
  aws_secret_key: '[0-9a-zA-Z/+]{40}'
  gcp_api_key: 'AIza[0-9A-Za-z\-_]{35}'
  azure_storage_key: '[a-zA-Z0-9+/]{86}=='
  
  # AI/ML APIs
  openai_api_key: 'sk-[a-zA-Z0-9]{48}'
  anthropic_api_key: 'sk-ant-[a-zA-Z0-9\-_]{95}'
  huggingface_token: 'hf_[a-zA-Z0-9]{34}'
  
  # Authentication
  jwt_token: 'eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+'
  bearer_token: 'Bearer [a-zA-Z0-9\-_.]+'
  basic_auth: 'Basic [a-zA-Z0-9+/=]+'
  
  # Database
  mongodb_uri: 'mongodb(\+srv)?://[^\s]+'
  postgres_uri: 'postgres(ql)?://[^\s]+'
  mysql_uri: 'mysql://[^\s]+'
  redis_uri: 'redis://[^\s]+'
  connection_string: '(Server|Data Source)=[^;]+;.*Password=[^;]+'
  
  # Private Keys
  rsa_private: '-----BEGIN RSA PRIVATE KEY-----'
  openssh_private: '-----BEGIN OPENSSH PRIVATE KEY-----'
  pem_private: '-----BEGIN PRIVATE KEY-----'
  pgp_private: '-----BEGIN PGP PRIVATE KEY BLOCK-----'
  
  # Common Secrets
  password_in_code: '(password|passwd|pwd)\s*=\s*["\'][^"\']{8,}["\']'
  secret_in_code: '(secret|api_key|apikey)\s*=\s*["\'][^"\']+["\']'
  
  # High Entropy Detection
  high_entropy_base64: '[A-Za-z0-9+/]{40,}={0,2}'
  high_entropy_hex: '[0-9a-fA-F]{32,}'
```

### Integration Points

```
1. Real-time (khi viết code):
   └── Highlight ngay khi phát hiện

2. Pre-commit:
   └── Block commit nếu có secrets

3. /eng validate:
   └── Bao gồm trong validation pipeline

4. /eng done:
   └── Bắt buộc pass security scan

5. /eng security scan:
   └── Manual full scan
```

---

## 🏗️ Implementation Phases

### Phase 1: Core Foundation (Week 1-2)
```
□ Project scaffolding (TypeScript + MCP SDK)
□ Universal project detection
□ Basic indexing (functions, errors, constants)
□ Security scanner (P0 patterns)
□ Session context preservation
□ Commands: init, scan, security
```

### Phase 2: Workflow Engine (Week 3)
```
□ Feature lifecycle (start, validate, done)
□ Checkpoint system
□ Knowledge extraction
□ Duplicate detection
□ Commands: start, validate, refactor, done
```

### Phase 3: Multi-Session (Week 4)
```
□ Session management
□ File-level locking
□ Discovery sharing
□ Conflict detection
□ Commands: session *
```

### Phase 4: Polish & Test (Week 5)
```
□ Cross-platform testing (Windows, Linux)
□ Project type testing (Embedded, .NET, Web)
□ Performance optimization
□ Documentation
□ Bug fixes
```

---

## 🧪 Test Scenarios

### Scenario 1: New C# ASP.NET Project
```bash
$ /eng init
# Auto-detects: ASP.NET Core project
# Creates .engineering/ with .NET-specific indexes
# Scans for secrets in appsettings.json, connection strings

$ /eng security scan
# Checks: connection strings, API keys, JWT secrets
# Reports any hardcoded credentials
```

### Scenario 2: Existing Embedded Project
```bash
$ /eng init
# Auto-detects: STM32CubeIDE project
# Creates hardware.yaml from .ioc file
# Indexes all functions, error codes

$ /eng start uart-driver
# Checks available UART ports
# Finds related patterns from knowledge base
```

### Scenario 3: React Web Application
```bash
$ /eng init
# Auto-detects: React + TypeScript
# Creates routes.yaml, components.yaml
# Scans for exposed API keys in .env

$ /eng validate
# Runs: ESLint, TypeScript check, bundle size, security scan
```

### Scenario 4: Multi-Session Development
```bash
# Terminal 1
$ /eng session start A
# Working on: API layer

# Terminal 2
$ /eng session start B
# Working on: UI components

# Both sessions can see each other's discoveries
# Automatic conflict prevention
```

---

## 📊 Success Metrics

| Metric | Target |
|--------|--------|
| Context recovery time | < 2 minutes |
| Secret detection rate | > 95% |
| False positive rate | < 5% |
| Duplicate detection accuracy | > 85% |
| Session resume accuracy | 100% |
| Cross-platform compatibility | Win/Linux/Mac |

---

## 🚀 Getting Started with Claude Code

### Prerequisites
```bash
# Node.js 18+
node --version

# TypeScript
npm install -g typescript

# MCP SDK
npm install @anthropic/mcp-sdk
```

### Initial Commands
```bash
# Clone/create project
mkdir mcp-engineering-server
cd mcp-engineering-server

# Initialize
npm init -y
npm install typescript @anthropic/mcp-sdk yaml glob tree-sitter

# Structure
mkdir -p src/{core,indexes,security,sessions,commands}
```

### First Implementation Order
1. `src/core/project-detector.ts` - Detect project types
2. `src/security/scanner.ts` - Security pattern matching
3. `src/core/config.ts` - Configuration management
4. `src/indexes/function-indexer.ts` - Function scanning
5. `src/sessions/context-manager.ts` - Session context
6. `src/commands/init.ts` - First command

---

## 📝 Notes

- Tất cả file YAML sử dụng UTF-8 encoding
- Security patterns có thể customize trong `security/patterns.yaml`
- Whitelist cho false positives trong `security/whitelist.yaml`
- Cross-platform paths được normalize tự động
- Session data không được commit (add to .gitignore)

---

**Ready to build! 🛠️**

# MCP Engineering Server

An MCP (Model Context Protocol) server that provides AI-assisted engineering workflow tools for Claude Code.

## Features

- **Auto-detect project type**: Supports 20+ project types (Node.js, .NET, Python, Rust, Go, Embedded, etc.)
- **Security scanning**: Detect secrets, API keys, and credentials before commit
- **Function indexing**: Index and search functions across TypeScript, Python, C#, Go, Rust, C/C++
- **Session management**: Checkpoints for context preservation across Claude sessions
- **Multi-session coordination**: Parallel Claude instances with file locking

## Requirements

- Node.js >= 18.0.0
- Claude Code (VS Code extension or CLI)

## Installation

### Option 1: Clone and Build

```bash
git clone https://github.com/liam1472/mcp-engineering-server.git
cd mcp-engineering-server
npm install
npm run build
```

### Option 2: npm (coming soon)

```bash
npm install -g mcp-engineering-server
```

## Setup with Claude Code

### VS Code Extension

Add to your Claude Code MCP settings:

```bash
claude mcp add engineering -s user -- node "/path/to/mcp-engineering-server/dist/index.js"
```

Or add manually to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "engineering": {
      "command": "node",
      "args": ["/path/to/mcp-engineering-server/dist/index.js"]
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add engineering -- node "/path/to/mcp-engineering-server/dist/index.js"
```

## Slash Commands

Copy the `.claude/commands/` folder to your project to enable slash commands:

| Command | Description |
|---------|-------------|
| `/eng-init` | Initialize project, auto-detect type |
| `/eng-scan` | Build function index |
| `/eng-security` | Scan for secrets and credentials |
| `/eng-start <feature>` | Start working on a feature |
| `/eng-validate` | Run validation pipeline |
| `/eng-done` | Complete and archive feature |
| `/eng-search <query>` | Search indexed functions |
| `/eng-checkpoint` | Save session checkpoint |
| `/eng-resume` | Resume from checkpoint |
| `/eng-session-start <A\|B\|C>` | Start parallel session |
| `/eng-session-status` | View active sessions |
| `/eng-lock <file>` | Lock file for editing |
| `/eng-unlock <file>` | Unlock file |

## Workflow

```
/eng-init          # Initialize project
    ↓
/eng-scan          # Index codebase
    ↓
/eng-start feature # Start feature
    ↓
  ... work ...
    ↓
/eng-validate      # Check security & index
    ↓
/eng-done          # Archive feature
```

## Generated Structure

After running `/eng-init`, a `.engineering/` directory is created:

```
.engineering/
├── config.yaml           # Project config
├── index/
│   └── functions.yaml    # Function index
├── sessions/             # Session data (add to .gitignore)
├── security/
│   ├── patterns.yaml     # Detection patterns
│   └── whitelist.yaml    # False positive whitelist
├── features/             # Active features
└── archive/              # Completed features
```

## Supported Project Types

| Type | Detection |
|------|-----------|
| `web-node` | package.json |
| `web-react` | package.json + react |
| `web-vue` | package.json + vue |
| `web-angular` | angular.json |
| `dotnet-aspnet` | *.csproj + ASP.NET |
| `dotnet-maui` | *.csproj + MAUI |
| `python-django` | manage.py |
| `python-fastapi` | main.py + fastapi |
| `rust` | Cargo.toml |
| `go` | go.mod |
| `embedded-stm32` | *.ioc |
| `embedded-esp` | sdkconfig |
| `mobile-flutter` | pubspec.yaml |
| `mobile-react-native` | react-native in package.json |

## Security Patterns

The security scanner detects:

- AWS Access Keys & Secret Keys
- GCP API Keys
- Azure Storage Keys
- OpenAI / Anthropic API Keys
- JWT Tokens
- Database connection strings (MongoDB, PostgreSQL, MySQL)
- RSA/SSH Private Keys
- Hardcoded passwords

## Configuration

Edit `.engineering/config.yaml`:

```yaml
version: 1.0.0
projectType: web-node
projectName: my-project
autoSaveInterval: 300
security:
  enabled: true
  customPatterns: []
  whitelist: []
indexes:
  functions: true
  errors: true
  constants: true
  dependencies: true
```

## License

MIT

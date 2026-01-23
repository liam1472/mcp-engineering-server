Manage architecture rules and enforce layer dependencies.

Usage: /eng-arch [options]

Options:
  --init     Create architecture.yaml template
  --check    Check for architecture violations
  --enforce  Enforce rules (fail on violations)

Examples:
  /eng-arch --init      # Create template
  /eng-arch --check     # Report violations
  /eng-arch --enforce   # Fail if violations exist

Architecture rules in .engineering/architecture.yaml:
```yaml
layers:
  - name: presentation
    patterns: ["src/ui/**", "src/components/**"]
    canImport: ["domain", "infrastructure"]
  - name: domain
    patterns: ["src/domain/**", "src/models/**"]
    canImport: []  # Domain should not import other layers
  - name: infrastructure
    patterns: ["src/infra/**", "src/services/**"]
    canImport: ["domain"]
```

Use to enforce clean architecture and prevent layer violations.

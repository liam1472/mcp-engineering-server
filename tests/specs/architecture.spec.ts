/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the behavioral contract for eng_arch (architecture enforcer).
 * If a test fails, FIX THE SOURCE CODE, not the test.
 *
 * @see ROADMAP-V2.md Phase 2.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ArchitectureEnforcer, ArchitectureConfig, ViolationReport } from '../../src/indexes/architecture-enforcer.js';

/**
 * SPEC: Architecture Template Creation
 *
 * REQUIREMENT: The enforcer MUST create architecture.yaml template on init.
 */
describe('[SPEC] ArchitectureEnforcer - Template Creation', () => {
  let tempDir: string;
  let enforcer: ArchitectureEnforcer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-arch-'));
    enforcer = new ArchitectureEnforcer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST create architecture.yaml on init
   */
  it('MUST create architecture.yaml on init', async () => {
    await enforcer.init();

    const configPath = path.join(tempDir, '.engineering', 'architecture.yaml');
    const exists = await fs
      .access(configPath)
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(true);
  });

  /**
   * GOLDEN TEST: Template MUST include layers section
   */
  it('Template MUST include layers section', async () => {
    await enforcer.init();

    const configPath = path.join(tempDir, '.engineering', 'architecture.yaml');
    const content = await fs.readFile(configPath, 'utf-8');

    expect(content).toContain('layers:');
  });

  /**
   * GOLDEN TEST: Template MUST include rules section
   */
  it('Template MUST include rules section', async () => {
    await enforcer.init();

    const configPath = path.join(tempDir, '.engineering', 'architecture.yaml');
    const content = await fs.readFile(configPath, 'utf-8');

    expect(content).toContain('rules:');
  });

  /**
   * GOLDEN TEST: MUST NOT overwrite existing architecture.yaml
   */
  it('MUST NOT overwrite existing architecture.yaml', async () => {
    const configPath = path.join(tempDir, '.engineering', 'architecture.yaml');
    await fs.mkdir(path.join(tempDir, '.engineering'), { recursive: true });
    await fs.writeFile(configPath, '# Custom config\nlayers: []', 'utf-8');

    const result = await enforcer.init();

    const content = await fs.readFile(configPath, 'utf-8');
    expect(content).toContain('# Custom config');
    expect(result.skipped).toBe(true);
  });
});

/**
 * SPEC: Layer Definition
 *
 * REQUIREMENT: The enforcer MUST support defining architectural layers.
 */
describe('[SPEC] ArchitectureEnforcer - Layer Definition', () => {
  let tempDir: string;
  let enforcer: ArchitectureEnforcer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-arch-layer-'));
    enforcer = new ArchitectureEnforcer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST parse layer definitions
   */
  it('MUST parse layer definitions from config', async () => {
    const config = `
layers:
  - name: presentation
    pattern: "src/ui/**"
    allowedDependencies: ["domain", "infrastructure"]
  - name: domain
    pattern: "src/domain/**"
    allowedDependencies: []
  - name: infrastructure
    pattern: "src/infra/**"
    allowedDependencies: ["domain"]
`;
    await fs.mkdir(path.join(tempDir, '.engineering'), { recursive: true });
    await fs.writeFile(path.join(tempDir, '.engineering', 'architecture.yaml'), config, 'utf-8');

    const result = await enforcer.loadConfig();

    expect(result.layers.length).toBe(3);
    expect(result.layers[0]?.name).toBe('presentation');
    expect(result.layers[0]?.allowedDependencies).toContain('domain');
  });

  /**
   * GOLDEN TEST: MUST identify file layer based on pattern
   */
  it('MUST identify file layer based on pattern', async () => {
    const config = `
layers:
  - name: ui
    pattern: "src/ui/**"
  - name: core
    pattern: "src/core/**"
`;
    await fs.mkdir(path.join(tempDir, '.engineering'), { recursive: true });
    await fs.writeFile(path.join(tempDir, '.engineering', 'architecture.yaml'), config, 'utf-8');

    await enforcer.loadConfig();

    const uiLayer = enforcer.getFileLayer('src/ui/components/Button.tsx');
    const coreLayer = enforcer.getFileLayer('src/core/utils.ts');

    expect(uiLayer).toBe('ui');
    expect(coreLayer).toBe('core');
  });
});

/**
 * SPEC: Violation Detection
 *
 * REQUIREMENT: The enforcer MUST detect dependency rule violations.
 */
describe('[SPEC] ArchitectureEnforcer - Violation Detection', () => {
  let tempDir: string;
  let enforcer: ArchitectureEnforcer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-arch-violation-'));
    enforcer = new ArchitectureEnforcer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST detect forbidden layer dependency
   */
  it('MUST detect forbidden layer dependency', async () => {
    const config = `
layers:
  - name: domain
    pattern: "src/domain/**"
    allowedDependencies: []
  - name: infrastructure
    pattern: "src/infra/**"
    allowedDependencies: ["domain"]
`;
    await fs.mkdir(path.join(tempDir, '.engineering'), { recursive: true });
    await fs.writeFile(path.join(tempDir, '.engineering', 'architecture.yaml'), config, 'utf-8');

    // Create violating file: domain imports from infrastructure
    await fs.mkdir(path.join(tempDir, 'src', 'domain'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'src', 'infra'), { recursive: true });

    await fs.writeFile(
      path.join(tempDir, 'src', 'domain', 'service.ts'),
      `import { db } from '../infra/database';\nexport class Service {}`,
      'utf-8'
    );
    await fs.writeFile(
      path.join(tempDir, 'src', 'infra', 'database.ts'),
      `export const db = {};`,
      'utf-8'
    );

    await enforcer.loadConfig();
    const report = await enforcer.check();

    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.violations[0]?.type).toBe('forbidden-dependency');
  });

  /**
   * GOLDEN TEST: MUST NOT report allowed dependencies
   */
  it('MUST NOT report allowed dependencies', async () => {
    const config = `
layers:
  - name: domain
    pattern: "src/domain/**"
    allowedDependencies: []
  - name: infrastructure
    pattern: "src/infra/**"
    allowedDependencies: ["domain"]
`;
    await fs.mkdir(path.join(tempDir, '.engineering'), { recursive: true });
    await fs.writeFile(path.join(tempDir, '.engineering', 'architecture.yaml'), config, 'utf-8');

    // Create valid file: infrastructure imports from domain (allowed)
    await fs.mkdir(path.join(tempDir, 'src', 'domain'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'src', 'infra'), { recursive: true });

    await fs.writeFile(
      path.join(tempDir, 'src', 'domain', 'entity.ts'),
      `export class Entity {}`,
      'utf-8'
    );
    await fs.writeFile(
      path.join(tempDir, 'src', 'infra', 'repository.ts'),
      `import { Entity } from '../domain/entity';\nexport class Repository {}`,
      'utf-8'
    );

    await enforcer.loadConfig();
    const report = await enforcer.check();

    expect(report.violations.length).toBe(0);
  });

  /**
   * GOLDEN TEST: MUST include file and line in violation
   */
  it('MUST include file and line in violation', async () => {
    const config = `
layers:
  - name: domain
    pattern: "src/domain/**"
    allowedDependencies: []
  - name: infrastructure
    pattern: "src/infra/**"
    allowedDependencies: ["domain"]
`;
    await fs.mkdir(path.join(tempDir, '.engineering'), { recursive: true });
    await fs.writeFile(path.join(tempDir, '.engineering', 'architecture.yaml'), config, 'utf-8');

    await fs.mkdir(path.join(tempDir, 'src', 'domain'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'src', 'infra'), { recursive: true });

    await fs.writeFile(
      path.join(tempDir, 'src', 'domain', 'service.ts'),
      `// comment\nimport { db } from '../infra/database';`,
      'utf-8'
    );
    await fs.writeFile(
      path.join(tempDir, 'src', 'infra', 'database.ts'),
      `export const db = {};`,
      'utf-8'
    );

    await enforcer.loadConfig();
    const report = await enforcer.check();

    expect(report.violations[0]?.file).toContain('domain/service.ts');
    expect(report.violations[0]?.line).toBe(2);
  });
});

/**
 * SPEC: Enforcement Mode
 *
 * REQUIREMENT: The enforcer MUST support enforce mode that blocks on violations.
 */
describe('[SPEC] ArchitectureEnforcer - Enforcement', () => {
  let tempDir: string;
  let enforcer: ArchitectureEnforcer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-arch-enforce-'));
    enforcer = new ArchitectureEnforcer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: enforce() MUST return failed:true when violations exist
   */
  it('enforce() MUST return failed:true when violations exist', async () => {
    const config = `
layers:
  - name: domain
    pattern: "src/domain/**"
    allowedDependencies: []
`;
    await fs.mkdir(path.join(tempDir, '.engineering'), { recursive: true });
    await fs.writeFile(path.join(tempDir, '.engineering', 'architecture.yaml'), config, 'utf-8');

    await fs.mkdir(path.join(tempDir, 'src', 'domain'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'src', 'infra'), { recursive: true });

    await fs.writeFile(
      path.join(tempDir, 'src', 'domain', 'service.ts'),
      `import { db } from '../infra/database';`,
      'utf-8'
    );
    await fs.writeFile(
      path.join(tempDir, 'src', 'infra', 'database.ts'),
      `export const db = {};`,
      'utf-8'
    );

    await enforcer.loadConfig();
    const result = await enforcer.enforce();

    expect(result.failed).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  /**
   * GOLDEN TEST: enforce() MUST return failed:false when clean
   */
  it('enforce() MUST return failed:false when clean', async () => {
    const config = `
layers:
  - name: domain
    pattern: "src/domain/**"
    allowedDependencies: []
`;
    await fs.mkdir(path.join(tempDir, '.engineering'), { recursive: true });
    await fs.writeFile(path.join(tempDir, '.engineering', 'architecture.yaml'), config, 'utf-8');

    await fs.mkdir(path.join(tempDir, 'src', 'domain'), { recursive: true });

    await fs.writeFile(
      path.join(tempDir, 'src', 'domain', 'entity.ts'),
      `export class Entity {}`,
      'utf-8'
    );

    await enforcer.loadConfig();
    const result = await enforcer.enforce();

    expect(result.failed).toBe(false);
    expect(result.violations.length).toBe(0);
  });
});

/**
 * SPEC: Result Structure
 *
 * REQUIREMENT: ViolationReport MUST contain all required fields.
 */
describe('[SPEC] ArchitectureEnforcer - Result Structure', () => {
  it('MUST return ViolationReport with all required fields', () => {
    const report: ViolationReport = {
      violations: [
        {
          type: 'forbidden-dependency',
          file: 'src/domain/service.ts',
          line: 1,
          from: 'domain',
          to: 'infrastructure',
          description: 'Domain layer cannot depend on infrastructure',
        },
      ],
      summary: '1 violation found',
      failed: true,
    };

    expect(report).toHaveProperty('violations');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('failed');
    expect(report.violations[0]).toHaveProperty('type');
    expect(report.violations[0]).toHaveProperty('file');
    expect(report.violations[0]).toHaveProperty('line');
  });

  it('MUST return ArchitectureConfig with all required fields', () => {
    const config: ArchitectureConfig = {
      layers: [
        {
          name: 'domain',
          pattern: 'src/domain/**',
          allowedDependencies: [],
        },
      ],
      rules: [],
    };

    expect(config).toHaveProperty('layers');
    expect(config).toHaveProperty('rules');
    expect(config.layers[0]).toHaveProperty('name');
    expect(config.layers[0]).toHaveProperty('pattern');
    expect(config.layers[0]).toHaveProperty('allowedDependencies');
  });
});

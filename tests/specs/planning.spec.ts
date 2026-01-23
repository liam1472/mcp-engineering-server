/**
 * GOLDEN SPECIFICATION TESTS - DO NOT MODIFY
 * ==========================================
 * These tests define the behavioral contract for eng_plan (planning phase).
 * If a test fails, FIX THE SOURCE CODE, not the test.
 *
 * @see ROADMAP-V2.md Phase 1.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PlanningManager, PlanResult } from '../../src/features/planner.js';

/**
 * SPEC: Plan Creation
 *
 * REQUIREMENT: The planning manager MUST create a PLAN.md file in the feature directory.
 */
describe('[SPEC] PlanningManager - Plan Creation', () => {
  let tempDir: string;
  let manager: PlanningManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-plan-'));
    manager = new PlanningManager(tempDir);

    // Create .engineering structure
    await fs.mkdir(path.join(tempDir, '.engineering', 'features', 'test-feature'), {
      recursive: true,
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST create PLAN.md in feature directory
   */
  it('MUST create PLAN.md in feature directory', async () => {
    const result = await manager.createPlan({ feature: 'test-feature' });

    const planPath = path.join(tempDir, '.engineering', 'features', 'test-feature', 'PLAN.md');
    const exists = await fs
      .access(planPath)
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(true);
    expect(result.planPath).toBe(planPath);
  });

  /**
   * GOLDEN TEST: MUST return error if feature directory doesn't exist
   */
  it('MUST return error if feature directory does not exist', async () => {
    const result = await manager.createPlan({ feature: 'nonexistent-feature' });

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
  });

  /**
   * GOLDEN TEST: MUST include feature name in plan header
   */
  it('MUST include feature name in plan header', async () => {
    await manager.createPlan({ feature: 'test-feature' });

    const planPath = path.join(tempDir, '.engineering', 'features', 'test-feature', 'PLAN.md');
    const content = await fs.readFile(planPath, 'utf-8');

    expect(content).toContain('# test-feature');
  });

  /**
   * GOLDEN TEST: MUST include standard sections in plan
   */
  it('MUST include standard sections in plan', async () => {
    await manager.createPlan({ feature: 'test-feature' });

    const planPath = path.join(tempDir, '.engineering', 'features', 'test-feature', 'PLAN.md');
    const content = await fs.readFile(planPath, 'utf-8');

    expect(content).toContain('## Objective');
    expect(content).toContain('## Tasks');
    expect(content).toContain('## Acceptance Criteria');
  });
});

/**
 * SPEC: Knowledge Injection
 *
 * REQUIREMENT: The planning manager MUST inject related knowledge into the plan.
 */
describe('[SPEC] PlanningManager - Knowledge Injection', () => {
  let tempDir: string;
  let manager: PlanningManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-plan-knowledge-'));
    manager = new PlanningManager(tempDir);

    // Create .engineering structure with knowledge
    await fs.mkdir(path.join(tempDir, '.engineering', 'features', 'test-feature'), {
      recursive: true,
    });
    await fs.mkdir(path.join(tempDir, '.engineering', 'knowledge', 'details'), {
      recursive: true,
    });

    // Create knowledge index
    const knowledgeIndex = `entries:
  - id: kb-001
    title: "GPIO Configuration Pattern"
    keywords: ["gpio", "pin", "embedded"]
    path: "details/kb-001.md"
  - id: kb-002
    title: "Error Handling Best Practice"
    keywords: ["error", "exception", "handling"]
    path: "details/kb-002.md"
`;
    await fs.writeFile(
      path.join(tempDir, '.engineering', 'knowledge', 'index.yaml'),
      knowledgeIndex,
      'utf-8'
    );

    // Create knowledge detail files
    await fs.writeFile(
      path.join(tempDir, '.engineering', 'knowledge', 'details', 'kb-001.md'),
      '# GPIO Configuration\nUse HAL_GPIO_Init for pin configuration.',
      'utf-8'
    );
    await fs.writeFile(
      path.join(tempDir, '.engineering', 'knowledge', 'details', 'kb-002.md'),
      '# Error Handling\nAlways check return values.',
      'utf-8'
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST search and include related knowledge
   */
  it('MUST search and include related knowledge based on feature name', async () => {
    // Feature name contains 'gpio' which should match kb-001
    await fs.mkdir(path.join(tempDir, '.engineering', 'features', 'add-gpio-driver'), {
      recursive: true,
    });

    const result = await manager.createPlan({
      feature: 'add-gpio-driver',
      injectKnowledge: true,
    });

    const planPath = path.join(tempDir, '.engineering', 'features', 'add-gpio-driver', 'PLAN.md');
    const content = await fs.readFile(planPath, 'utf-8');

    expect(result.knowledgeInjected.length).toBeGreaterThan(0);
    expect(content).toContain('## Related Knowledge');
    expect(content).toContain('GPIO Configuration');
  });

  /**
   * GOLDEN TEST: MUST return empty knowledge array if no matches
   */
  it('MUST return empty knowledge array if no matches', async () => {
    await fs.mkdir(path.join(tempDir, '.engineering', 'features', 'random-feature'), {
      recursive: true,
    });

    const result = await manager.createPlan({
      feature: 'random-feature',
      injectKnowledge: true,
    });

    expect(result.knowledgeInjected).toEqual([]);
  });
});

/**
 * SPEC: Manifesto Injection
 *
 * REQUIREMENT: The planning manager MUST inject manifesto rules into the plan.
 */
describe('[SPEC] PlanningManager - Manifesto Injection', () => {
  let tempDir: string;
  let manager: PlanningManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-plan-manifesto-'));
    manager = new PlanningManager(tempDir);

    // Create .engineering structure with manifesto
    await fs.mkdir(path.join(tempDir, '.engineering', 'features', 'test-feature'), {
      recursive: true,
    });

    // Create manifesto
    const manifesto = `# Engineering Manifesto

## Code Standards
- All functions must have error handling
- No magic numbers

## Security
- Never store credentials in code
`;
    await fs.writeFile(
      path.join(tempDir, '.engineering', 'manifesto.md'),
      manifesto,
      'utf-8'
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * GOLDEN TEST: MUST include manifesto reference in plan
   */
  it('MUST include manifesto reference in plan', async () => {
    const result = await manager.createPlan({
      feature: 'test-feature',
      injectManifesto: true,
    });

    const planPath = path.join(tempDir, '.engineering', 'features', 'test-feature', 'PLAN.md');
    const content = await fs.readFile(planPath, 'utf-8');

    expect(result.manifestoInjected).toBe(true);
    expect(content).toContain('## Manifesto Rules');
  });

  /**
   * GOLDEN TEST: MUST NOT fail if no manifesto exists
   */
  it('MUST NOT fail if no manifesto exists', async () => {
    // Remove manifesto
    await fs.unlink(path.join(tempDir, '.engineering', 'manifesto.md'));

    const result = await manager.createPlan({
      feature: 'test-feature',
      injectManifesto: true,
    });

    expect(result.manifestoInjected).toBe(false);
    expect(result.error).toBeUndefined();
  });
});

/**
 * SPEC: Plan Result Structure
 *
 * REQUIREMENT: PlanResult MUST contain all required fields.
 */
describe('[SPEC] PlanningManager - Result Structure', () => {
  /**
   * GOLDEN TEST: PlanResult MUST have required fields
   */
  it('MUST return PlanResult with all required fields', () => {
    const result: PlanResult = {
      feature: 'test-feature',
      planPath: '/path/to/PLAN.md',
      knowledgeInjected: ['kb-001'],
      manifestoInjected: true,
    };

    expect(result).toHaveProperty('feature');
    expect(result).toHaveProperty('planPath');
    expect(result).toHaveProperty('knowledgeInjected');
    expect(result).toHaveProperty('manifestoInjected');
  });

  /**
   * GOLDEN TEST: PlanResult MUST include error field when error occurs
   */
  it('MUST include error field when error occurs', () => {
    const result: PlanResult = {
      feature: 'test-feature',
      planPath: '',
      knowledgeInjected: [],
      manifestoInjected: false,
      error: 'Feature directory not found',
    };

    expect(result.error).toBeDefined();
  });
});

/**
 * SPEC: Plan Options
 *
 * REQUIREMENT: CreatePlanOptions MUST support all documented parameters.
 */
describe('[SPEC] PlanningManager - Options', () => {
  it('MUST support all required options', () => {
    // This test validates the interface at compile time
    const options: Parameters<PlanningManager['createPlan']>[0] = {
      feature: 'test-feature',
      injectKnowledge: true,
      injectManifesto: true,
      description: 'Add a new feature',
    };

    expect(options.feature).toBeDefined();
  });
});

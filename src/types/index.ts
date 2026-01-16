/**
 * Core type definitions for MCP Engineering Server
 */

import { z } from 'zod';

// Project type detection
export const ProjectTypeSchema = z.enum([
  'embedded-stm32',
  'embedded-esp32',
  'embedded-zephyr',
  'embedded-arduino',
  'dotnet-aspnet',
  'dotnet-wpf',
  'dotnet-maui',
  'dotnet-blazor',
  'dotnet-console',
  'web-react',
  'web-vue',
  'web-angular',
  'web-nextjs',
  'web-node',
  'native-cmake',
  'native-rust',
  'native-go',
  'python-django',
  'python-flask',
  'python-general',
  'unknown',
]);

export type ProjectType = z.infer<typeof ProjectTypeSchema>;

// Session state
export const SessionStateSchema = z.object({
  id: z.string(),
  projectType: ProjectTypeSchema,
  currentTask: z.string().optional(),
  decisions: z.array(z.string()),
  findings: z.array(z.string()),
  blockers: z.array(z.string()),
  nextSteps: z.array(z.string()),
  lastUpdated: z.string().datetime(),
});

export type SessionState = z.infer<typeof SessionStateSchema>;

// Security scan result
export const SecurityFindingSchema = z.object({
  type: z.enum(['secret', 'credential', 'key', 'token', 'password', 'pii']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  file: z.string(),
  line: z.number(),
  pattern: z.string(),
  match: z.string(),
  suggestion: z.string(),
});

export type SecurityFinding = z.infer<typeof SecurityFindingSchema>;

// Function index entry
export const FunctionIndexEntrySchema = z.object({
  name: z.string(),
  file: z.string(),
  line: z.number(),
  signature: z.string(),
  returnType: z.string().optional(),
  parameters: z.array(
    z.object({
      name: z.string(),
      type: z.string().optional(),
    })
  ),
  description: z.string().optional(),
});

export type FunctionIndexEntry = z.infer<typeof FunctionIndexEntrySchema>;

// Configuration
export const EngConfigSchema = z.object({
  version: z.string(),
  projectType: ProjectTypeSchema,
  projectName: z.string(),
  autoSaveInterval: z.number().default(300), // 5 minutes
  security: z.object({
    enabled: z.boolean().default(true),
    customPatterns: z.array(z.string()).default([]),
    whitelist: z.array(z.string()).default([]),
  }),
  indexes: z.object({
    functions: z.boolean().default(true),
    errors: z.boolean().default(true),
    constants: z.boolean().default(true),
    dependencies: z.boolean().default(true),
  }),
});

export type EngConfig = z.infer<typeof EngConfigSchema>;

// Knowledge entry (extracted on eng_done)
export const KnowledgeEntrySchema = z.object({
  id: z.string(),
  type: z.enum(['pattern', 'solution', 'bug', 'decision', 'tip']),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  source: z.object({
    feature: z.string(),
    files: z.array(z.string()),
    date: z.string(),
  }),
});

export type KnowledgeEntry = z.infer<typeof KnowledgeEntrySchema>;

// Knowledge base
export const KnowledgeBaseSchema = z.object({
  version: z.string(),
  entries: z.array(KnowledgeEntrySchema),
  lastUpdated: z.string(),
});

export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;

// Duplicate code detection
export const DuplicateBlockSchema = z.object({
  hash: z.string(),
  lines: z.number(),
  occurrences: z.array(
    z.object({
      file: z.string(),
      startLine: z.number(),
      endLine: z.number(),
    })
  ),
  preview: z.string(),
});

export type DuplicateBlock = z.infer<typeof DuplicateBlockSchema>;

// Project-specific index: Routes (for web projects)
export const RouteIndexEntrySchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'ALL']),
  path: z.string(),
  handler: z.string(),
  file: z.string(),
  line: z.number(),
  middleware: z.array(z.string()).optional(),
});

export type RouteIndexEntry = z.infer<typeof RouteIndexEntrySchema>;

// Project-specific index: Hardware (for embedded projects)
export const HardwareConfigSchema = z.object({
  peripherals: z.array(
    z.object({
      type: z.string(), // GPIO, UART, SPI, I2C, etc
      name: z.string(),
      pins: z.array(z.string()),
      file: z.string(),
      line: z.number(),
    })
  ),
  defines: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      file: z.string(),
      line: z.number(),
    })
  ),
});

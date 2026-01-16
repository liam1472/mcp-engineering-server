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

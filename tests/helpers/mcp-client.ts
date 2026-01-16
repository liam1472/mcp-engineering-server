/**
 * MCP Test Client
 * Simulates MCP protocol interactions for testing tools
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';

export interface MCPTestClientOptions {
  /** Working directory for the server */
  workingDir?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Server startup timeout in ms */
  timeout?: number;
}

export interface ToolCallOptions {
  /** Tool name */
  name: string;
  /** Tool arguments */
  args?: Record<string, unknown>;
}

/**
 * Test client for MCP Engineering Server
 */
export class MCPTestClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private serverProcess: ChildProcess | null = null;
  private connected = false;
  private workingDir: string;
  private env: Record<string, string>;
  private timeout: number;

  constructor(options: MCPTestClientOptions = {}) {
    this.workingDir = options.workingDir ?? process.cwd();
    this.env = options.env ?? {};
    this.timeout = options.timeout ?? 10000;
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const serverPath = path.join(__dirname, '../../dist/index.js');

    // Spawn server process
    this.serverProcess = spawn('node', [serverPath], {
      cwd: this.workingDir,
      env: {
        ...process.env,
        ...this.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Create transport
    this.transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      cwd: this.workingDir,
      env: {
        ...process.env,
        ...this.env,
      },
    });

    // Create client
    this.client = new Client(
      {
        name: 'mcp-test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Connect with timeout
    await Promise.race([
      this.client.connect(this.transport),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), this.timeout)
      ),
    ]);

    this.connected = true;
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.transport?.close();
    } catch {
      // Ignore close errors
    }

    try {
      this.serverProcess?.kill();
    } catch {
      // Ignore kill errors
    }

    this.client = null;
    this.transport = null;
    this.serverProcess = null;
    this.connected = false;
  }

  /**
   * Get list of available tools
   */
  async listTools(): Promise<Tool[]> {
    if (!this.client) {
      throw new Error('Not connected');
    }

    const result = await this.client.listTools();
    return result.tools;
  }

  /**
   * Call a tool
   */
  async callTool(options: ToolCallOptions): Promise<CallToolResult> {
    if (!this.client) {
      throw new Error('Not connected');
    }

    const result = await this.client.callTool({
      name: options.name,
      arguments: options.args ?? {},
    });

    return result;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get working directory
   */
  getWorkingDir(): string {
    return this.workingDir;
  }
}

/**
 * Create and connect a test client
 */
export async function createTestClient(
  options?: MCPTestClientOptions
): Promise<MCPTestClient> {
  const client = new MCPTestClient(options);
  await client.connect();
  return client;
}

/**
 * Helper to extract text content from tool result
 */
export function getToolResultText(result: CallToolResult): string {
  const content = result.content;
  if (Array.isArray(content)) {
    return content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }
  return '';
}

/**
 * Helper to check if tool result indicates success
 */
export function isToolSuccess(result: CallToolResult): boolean {
  return !result.isError;
}

/**
 * Helper to parse JSON from tool result
 */
export function parseToolResultJson<T>(result: CallToolResult): T | null {
  const text = getToolResultText(result);
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

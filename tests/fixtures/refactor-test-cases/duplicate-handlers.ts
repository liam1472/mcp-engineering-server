/**
 * FIXTURE: Duplicate code patterns across multiple functions
 * Used for Golden Spec testing of RefactorAnalyzer
 */

// DUPLICATE BLOCK 1: Request handling pattern (appears 3x)
export function handleUserRequest(req: any) {
  const validated = validateRequest(req);
  const sanitized = sanitizeInput(validated);
  const processed = processData(sanitized);
  const formatted = formatResponse(processed);
  return sendResponse(formatted);
}

export function handleOrderRequest(req: any) {
  const validated = validateRequest(req);
  const sanitized = sanitizeInput(validated);
  const processed = processData(sanitized);
  const formatted = formatResponse(processed);
  return sendResponse(formatted);
}

export function handlePaymentRequest(req: any) {
  const validated = validateRequest(req);
  const sanitized = sanitizeInput(validated);
  const processed = processData(sanitized);
  const formatted = formatResponse(processed);
  return sendResponse(formatted);
}

// DUPLICATE BLOCK 2: Error handling pattern (appears 3x)
export function safeParseJSON(data: string) {
  try {
    const parsed = JSON.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    console.error('Parse error:', error);
    return { success: false, error };
  }
}

export function safeParseXML(data: string) {
  try {
    const parsed = JSON.parse(data); // Pretend XML
    return { success: true, data: parsed };
  } catch (error) {
    console.error('Parse error:', error);
    return { success: false, error };
  }
}

export function safeParseYAML(data: string) {
  try {
    const parsed = JSON.parse(data); // Pretend YAML
    return { success: true, data: parsed };
  } catch (error) {
    console.error('Parse error:', error);
    return { success: false, error };
  }
}

// DUPLICATE BLOCK 3: File operations pattern (appears 3x)
export async function readConfigFile(filePath: string) {
  const fullPath = require('path').join(process.cwd(), filePath);
  const content = await require('fs/promises').readFile(fullPath, 'utf-8');
  const parsed = JSON.parse(content);
  return parsed;
}

export async function readDataFile(filePath: string) {
  const fullPath = require('path').join(process.cwd(), filePath);
  const content = await require('fs/promises').readFile(fullPath, 'utf-8');
  const parsed = JSON.parse(content);
  return parsed;
}

export async function readCacheFile(filePath: string) {
  const fullPath = require('path').join(process.cwd(), filePath);
  const content = await require('fs/promises').readFile(fullPath, 'utf-8');
  const parsed = JSON.parse(content);
  return parsed;
}

// Helper stubs
function validateRequest(x: any) { return x; }
function sanitizeInput(x: any) { return x; }
function processData(x: any) { return x; }
function formatResponse(x: any) { return x; }
function sendResponse(x: any) { return x; }

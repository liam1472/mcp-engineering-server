/**
 * FIXTURE: Clean code with no issues
 * Used for Golden Spec testing - should produce empty report
 */

const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;

export function processItem(item: Item): Result {
  const validated = validate(item);
  const transformed = transform(validated);
  return format(transformed);
}

export function handleError(error: Error): ErrorResult {
  return {
    success: false,
    message: error.message,
    code: 'ERR_UNKNOWN',
  };
}

interface Item {
  id: string;
  value: number;
}

interface Result {
  id: string;
  processed: boolean;
}

interface ErrorResult {
  success: boolean;
  message: string;
  code: string;
}

function validate(item: Item): Item {
  if (!item.id) throw new Error('Missing ID');
  return item;
}

function transform(item: Item): Item {
  return { ...item, value: item.value * 2 };
}

function format(item: Item): Result {
  return { id: item.id, processed: true };
}

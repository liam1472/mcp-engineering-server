/**
 * Sample file with magic numbers for testing refactor analyzer
 * These should be extracted to named constants
 */

// HTTP status codes as magic numbers
function handleResponse(status: number): string {
  if (status === 200) {
    return 'OK';
  } else if (status === 201) {
    return 'Created';
  } else if (status === 400) {
    return 'Bad Request';
  } else if (status === 401) {
    return 'Unauthorized';
  } else if (status === 403) {
    return 'Forbidden';
  } else if (status === 404) {
    return 'Not Found';
  } else if (status === 500) {
    return 'Internal Server Error';
  }
  return 'Unknown';
}

// Time constants as magic numbers
function calculateTimeout(retryCount: number): number {
  const baseDelay = 1000; // 1 second - should be named constant
  const maxDelay = 30000; // 30 seconds - should be named constant
  const multiplier = 2; // exponential backoff - should be named constant

  let delay = baseDelay * Math.pow(multiplier, retryCount);
  return Math.min(delay, maxDelay);
}

// Size limits as magic numbers
function validateFile(size: number): boolean {
  const maxFileSize = 10485760; // 10 MB - should be named constant
  const minFileSize = 1024; // 1 KB - should be named constant
  return size >= minFileSize && size <= maxFileSize;
}

// Pagination constants as magic numbers
function paginate<T>(items: T[], page: number): T[] {
  const pageSize = 25; // should be named constant
  const maxPage = 100; // should be named constant

  const safePage = Math.min(Math.max(1, page), maxPage);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  return items.slice(start, end);
}

// Rate limiting magic numbers
class RateLimiter {
  private requests: number[] = [];

  canMakeRequest(): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window - should be constant
    const maxRequests = 100; // max requests per window - should be constant

    // Clean old requests
    this.requests = this.requests.filter(time => now - time < windowMs);

    if (this.requests.length >= maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }
}

// Business logic magic numbers
function calculateDiscount(total: number, memberLevel: number): number {
  if (total >= 1000 && memberLevel >= 3) {
    return total * 0.2; // 20% discount - magic numbers
  } else if (total >= 500 && memberLevel >= 2) {
    return total * 0.15; // 15% discount
  } else if (total >= 100 && memberLevel >= 1) {
    return total * 0.1; // 10% discount
  } else if (total >= 50) {
    return total * 0.05; // 5% discount
  }
  return 0;
}

// Array indices as magic numbers
function parseCSVLine(line: string): { name: string; age: number; email: string } {
  const parts = line.split(',');
  return {
    name: parts[0] || '', // index 0
    age: parseInt(parts[1] || '0', 10), // index 1
    email: parts[2] || '', // index 2
  };
}

export {
  handleResponse,
  calculateTimeout,
  validateFile,
  paginate,
  RateLimiter,
  calculateDiscount,
  parseCSVLine,
};

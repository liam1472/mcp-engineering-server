/**
 * TypeScript function samples for testing function indexer
 */

// Regular function declaration
export function calculateSum(a: number, b: number): number {
  return a + b;
}

// Arrow function
export const multiply = (x: number, y: number): number => x * y;

// Async function
export async function fetchData(url: string): Promise<Response> {
  return fetch(url);
}

// Generic function
export function identity<T>(arg: T): T {
  return arg;
}

// Function with complex return type
export function createUser(
  name: string,
  age: number
): { name: string; age: number; id: string } {
  return {
    name,
    age,
    id: Math.random().toString(36).substring(7),
  };
}

// Class with methods
export class Calculator {
  private value: number = 0;

  constructor(initial: number = 0) {
    this.value = initial;
  }

  add(n: number): Calculator {
    this.value += n;
    return this;
  }

  subtract(n: number): Calculator {
    this.value -= n;
    return this;
  }

  getValue(): number {
    return this.value;
  }

  static create(initial: number): Calculator {
    return new Calculator(initial);
  }
}

// Interface
export interface DataProcessor<T> {
  process(data: T): T;
  validate(data: T): boolean;
}

// Type alias
export type UserRole = 'admin' | 'user' | 'guest';

// Enum
export enum Status {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
}

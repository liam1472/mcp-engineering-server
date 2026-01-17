# WEB ENGINEERING MANIFESTO
## Safety-Oriented Web Coding Rules

> **Project Type:** Web (Node.js, React, Vue, Angular, Next.js)
> **Objective:** Scalable, secure, maintainable web applications
> Inspired by OWASP Top 10, Secure Coding Practices, Barr-style enforceable rules

---

## ❌ FORBIDDEN (Production Code)

### 1. Unsafe Query Construction
- String concatenation for SQL/NoSQL queries with user input

**Rationale:**
Leads to SQL Injection / NoSQL Injection.

**Use instead:**
- Parameterized queries, prepared statements, or ORM APIs

---

### 2. Unsafe DOM Manipulation
- Rendering user input directly into HTML/JS/CSS without proper context-aware encoding

**Rationale:**
Leads to Cross-Site Scripting (XSS)

**Use instead:**
- Context-aware encoding: HTML, JS, URL, CSS

---

### 3. Hardcoded Secrets
- Passwords or API keys in source code

**Rationale:**
Credential leakage, supply-chain attack risk

**Use instead:**
- Environment variables
- Vault / secret manager
- Config file not committed to VCS

---

### 4. Blocking Main Thread
- Synchronous file I/O (`readFileSync`, `writeFileSync`)
- Heavy computation in main thread
- `alert()`, `prompt()` in production

**Rationale:**
Blocks event loop, causes poor UX, ANR (App Not Responding)

**Use instead:**
- Async/await with Promises
- Web Workers / Offload heavy computation

---

### 5. Callback Hell / Nested Callbacks
- More than 2 levels deep

**Rationale:**
Hard to read, maintain, and debug

**Use instead:**
- Async/await, Promises, or event emitters

---

### 6. Unsafe TypeScript Practices
- Using `any` without justification
- Disabling strict mode

**Rationale:**
Defeats type safety; runtime errors more likely

**Use instead:**
- Proper typing, generics, `unknown` + type guards

---

### 7. Reliance on Client-Side Validation Only
- Skipping server-side checks

**Rationale:**
Client can bypass validation → security hole

**Use instead:**
- Server-side whitelist validation, output encoding

---

## ✅ REQUIRED (Mandatory Practices)

### 1. Input Validation & Output Encoding
- Validate all user input at API boundary (server-side)
- Encode output according to context (HTML, JS, URL, CSS)

---

### 2. Authentication & Authorization
- JWT or session-based auth for protected routes
- Role-based access control (RBAC)
- HTTPS only in production

---

### 3. Logging & Rate Limiting
- Log security events: failed login, access denied, anomalies
- Rate limit sensitive endpoints

---

### 4. Dependency & Supply Chain Safety
- Scan third-party libraries for known vulnerabilities
- Remove unused dependencies

---

### 5. Error Handling
- Global error boundary in frontend
- Centralized error handler in backend
- All async operations wrapped in try/catch or `.catch()`

---

### 6. API & State Management
- RESTful or GraphQL conventions
- Versioning strategy (v1, v2)
- Single source of truth, immutable state updates, unidirectional data flow

---

### 7. Testing
- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical user flows

---

## ⚠️ STRONGLY RECOMMENDED / BEST PRACTICES

- ESLint + Prettier, pre-commit hooks (Husky)
- Code review for every PR
- Structured logging library (Winston, Pino)
- Content Security Policy (CSP), CORS, security headers (Helmet.js)
- Code splitting / lazy loading, image optimization, caching
- Monitor bundle size and performance metrics

---

## 📌 CODE PATTERNS (GOOD vs BAD)

### Async Operations
```typescript
// GOOD: Async/await with error handling
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    logger.error('Failed to fetch user', { id, error });
    throw new UserNotFoundError(id);
  }
}

// BAD: Callback hell
function fetchUser(id, callback) {
  api.get('/users/' + id, function(err, res) {
    if (err) callback(err);
    else db.save(res, function(err2, saved) {
      if (err2) callback(err2);
      else callback(null, saved);
    });
  });
}
```

### Input Validation
```typescript
// GOOD: Schema validation
import { z } from 'zod';
const UserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  age: z.number().min(18).optional(),
});
function createUser(input: unknown) {
  const validated = UserSchema.parse(input);
  // Safe to use validated data
}

// BAD: No validation
function createUser(input: any) {
  db.insert(input); // SQL injection risk
}
```

### Environment Variables
```typescript
// GOOD
const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error('API_KEY is required');

// BAD
const apiKey = 'sk-1234567890abcdef';
```

### Error Handling
```typescript
// GOOD: Centralized error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
  res.status(500).json({ error: 'Internal Server Error' });
});

// BAD: Silent failure
try { await riskyOperation(); } catch (e) { /* ignored */ }
```

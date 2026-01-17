# WEB OPERATIONS BLUEPRINT
## Deployment & Operations Standards for Web Applications

> **Project Type:** Web (Node.js, React, Vue, Next.js, Express, NestJS)
> **Objective:** Scalable, reliable, zero-downtime deployments
> **Inspired by:** 12-Factor App, Cloud Native principles

---

## 🐳 CONTAINERIZATION REQUIREMENTS

### 1. Dockerfile Best Practices
- [ ] Multi-stage build (builder + runtime)
- [ ] Non-root user in container
- [ ] Minimal base image (alpine, distroless)
- [ ] Layer caching optimization
- [ ] Health check instruction

### Sample Dockerfile (Node.js)
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runtime
WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Copy artifacts
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### docker-compose.yml (Development)
```yaml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://user:pass@db:5432/app
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./src:/app/src  # Hot reload

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=app
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d app"]
      interval: 5s
      timeout: 5s
      retries: 5
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

## ✅ HEALTH CHECK REQUIREMENTS

### 1. Health Endpoint Specification
- [ ] `GET /health` - Quick liveness check
- [ ] `GET /health/ready` - Readiness (dependencies OK)
- [ ] `GET /health/live` - Liveness (app running)

### Health Check Implementation
```typescript
// Express example
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '1.0.0',
  });
});

app.get('/health/ready', async (req, res) => {
  try {
    // Check dependencies
    await db.query('SELECT 1');
    await redis.ping();

    res.status(200).json({
      status: 'ready',
      checks: {
        database: 'ok',
        cache: 'ok',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      checks: {
        database: error.message,
      },
    });
  }
});
```

### Health Response Format
```yaml
# GET /health/ready
status: "ready"  # ready | not_ready
timestamp: "2026-01-17T10:00:00Z"
version: "2.1.0"
uptime_seconds: 86400

checks:
  database:
    status: "ok"
    latency_ms: 5
  cache:
    status: "ok"
    latency_ms: 1
  external_api:
    status: "degraded"
    latency_ms: 2500
    message: "High latency detected"

# Overall status rules:
# - "ready" if all critical checks pass
# - "degraded" if non-critical checks fail
# - "not_ready" if any critical check fails
```

---

## 🚀 ZERO-DOWNTIME DEPLOYMENT

### 1. Deployment Strategies
| Strategy | Use Case | Rollback |
|----------|----------|----------|
| Rolling | Standard deployments | Fast |
| Blue-Green | Critical apps | Instant |
| Canary | Risky changes | Gradual |

### 2. Kubernetes Deployment
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1

  selector:
    matchLabels:
      app: web-app

  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: app
          image: myregistry/web-app:v2.1.0
          ports:
            - containerPort: 3000

          # Probes for zero-downtime
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10

          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20

          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"

          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
```

### 3. Graceful Shutdown
```typescript
// Graceful shutdown handler
const server = app.listen(3000);

const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
  });

  // Wait for ongoing requests (max 30s)
  await new Promise((resolve) => setTimeout(resolve, 30000));

  // Close database connections
  await db.end();
  await redis.quit();

  console.log('Shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

## ⚙️ CONFIGURATION MANAGEMENT

### 1. Environment Variables (12-Factor)
- [ ] All config via environment variables
- [ ] No hardcoded values in code
- [ ] `.env.example` committed (no secrets)
- [ ] `.env` in `.gitignore`

### Required Environment Variables
```bash
# .env.example
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/app
DATABASE_POOL_SIZE=10

# Cache
REDIS_URL=redis://localhost:6379

# External Services
API_KEY=your-api-key-here
JWT_SECRET=your-jwt-secret-here

# Feature Flags
FEATURE_NEW_UI=false
```

### 2. Config Validation (Startup)
```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
});

// Validate on startup - fail fast
export const config = ConfigSchema.parse(process.env);
```

---

## 📊 LOGGING & MONITORING

### 1. Structured Logging
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Usage
logger.info({ userId: 123, action: 'login' }, 'User logged in');
logger.error({ err, requestId }, 'Request failed');
```

### Log Format (JSON)
```json
{
  "level": "info",
  "time": "2026-01-17T10:00:00.000Z",
  "requestId": "abc-123",
  "userId": 456,
  "action": "order_created",
  "orderId": 789,
  "msg": "Order created successfully"
}
```

### 2. Metrics (Prometheus)
```typescript
import { collectDefaultMetrics, Counter, Histogram } from 'prom-client';

collectDefaultMetrics();

// Custom metrics
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

// Expose /metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});
```

---

## 🔒 SECURITY CHECKLIST

### Infrastructure
- [ ] HTTPS only (TLS 1.2+)
- [ ] Security headers (Helmet.js)
- [ ] CORS configured properly
- [ ] Rate limiting on API endpoints
- [ ] WAF enabled (if applicable)

### Application
- [ ] Input validation on all endpoints
- [ ] Output encoding (XSS prevention)
- [ ] Parameterized queries (SQL injection)
- [ ] CSRF protection
- [ ] Secure session management

### Secrets
- [ ] No secrets in code or git
- [ ] Secrets in vault/secret manager
- [ ] Rotate secrets regularly
- [ ] Audit secret access

---

## 📋 CI/CD CHECKLIST

### Build Pipeline
- [ ] Lint & format check
- [ ] Unit tests
- [ ] Integration tests
- [ ] Security scan (npm audit, Snyk)
- [ ] Docker image build
- [ ] Image vulnerability scan

### Deployment Pipeline
- [ ] Deploy to staging first
- [ ] Smoke tests on staging
- [ ] Manual approval for production
- [ ] Canary deployment (optional)
- [ ] Health check verification
- [ ] Rollback on failure

### GitHub Actions Example
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: myregistry/app:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/web-app \
            app=myregistry/app:${{ github.sha }}
          kubectl rollout status deployment/web-app
```

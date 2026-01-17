# .NET / C# ENGINEERING MANIFESTO
## Safety-Oriented .NET Coding Rules

> Baseline rules for secure, maintainable .NET/C# applications.
> Inspired by Microsoft Secure Development Lifecycle (SDL), OWASP .NET Cheat Sheet, and enforceable practices.

---

## ❌ FORBIDDEN (In Production Code)

### 1. Async Void
- `async void` methods (except event handlers)

**Rationale:**
Exceptions cannot be caught, no way to await completion → unhandled exceptions crash app.

**Use instead:**
- `async Task` / `async Task<T>`
- Event handlers: wrap in try/catch

---

### 2. Thread.Sleep in Async Code
- `Thread.Sleep()` in async methods or UI thread

**Rationale:**
Blocks threads, can cause deadlocks, wastes resources.

**Use instead:**
- `await Task.Delay()`

---

### 3. Service Locator Pattern
- `ServiceLocator.GetService<T>()` or similar

**Rationale:**
Hides dependencies, makes testing difficult, violates Dependency Inversion Principle.

**Use instead:**
- Constructor injection
- IServiceProvider only in composition root

---

### 4. SQL String Concatenation
- Building SQL queries via string concatenation

**Rationale:**
SQL Injection risk.

**Use instead:**
- Parameterized queries, EF Core / Dapper, stored procedures

---

### 5. Catching Generic Exception
- `catch (Exception ex)` without specific handling

**Rationale:**
Swallows critical exceptions, hides bugs.

**Use instead:**
- Catch specific exceptions
- Re-throw with `throw;` (not `throw ex;`)

---

### 6. Hardcoded Connection Strings / Secrets
- Credentials in code or `appsettings.json` committed to VCS

**Rationale:**
Security breach risk, environment-specific values.

**Use instead:**
- User secrets (development)
- Azure Key Vault / AWS Secrets Manager / Environment variables

---

## ✅ REQUIRED (Mandatory Practices)

### 1. Dependency Injection
- All services registered in DI container
- Constructor injection for dependencies
- Explicit lifetime management (Singleton, Scoped, Transient)

---

### 2. Async All The Way
- Async methods return `Task` / `Task<T>`
- Avoid `.Result` / `.Wait()`
- Use `ConfigureAwait(false)` in library code

---

### 3. Structured Logging
- Use `ILogger<T>` from Microsoft.Extensions.Logging
- Log levels: Trace, Debug, Information, Warning, Error, Critical
- Structured parameters, not string interpolation

---

### 4. Input Validation
- Data annotations or FluentValidation
- Model binding validation in ASP.NET Core
- Validate at API boundary

---

### 5. Error Handling
- Global exception handler middleware
- ProblemDetails for API errors
- Custom exceptions for domain errors

---

### 6. Configuration
- IOptions<T> pattern for strongly-typed configuration
- Environment-specific `appsettings.{Environment}.json`
- Secrets in secure storage

---

## ⚠️ STRONGLY RECOMMENDED / BEST PRACTICES

### Architecture
- Clean Architecture / Onion Architecture
- CQRS for complex domains
- MediatR for decoupled handlers

### Performance
- Response caching / Output caching
- EF Core query optimization (avoid N+1)
- Async streams for large data

### Security
- Anti-forgery tokens (CSRF)
- CORS configuration
- Security headers
- Rate limiting

### Testing
- xUnit / NUnit for unit tests
- Integration tests with WebApplicationFactory
- Mocking with Moq / NSubstitute

---

## 📌 CODE PATTERNS (GOOD vs BAD)

### Async Methods
```csharp
// GOOD: Async Task
public async Task<User> GetUserAsync(int id)
{
    return await _repository.FindAsync(id);
}

// BAD: Async void
public async void GetUser(int id)
{
    var user = await _repository.FindAsync(id);
}
```

### Dependency Injection
```csharp
// GOOD: Constructor injection
public class OrderService
{
    private readonly IOrderRepository _repository;
    private readonly ILogger<OrderService> _logger;

    public OrderService(IOrderRepository repository, ILogger<OrderService> logger)
    {
        _repository = repository;
        _logger = logger;
    }
}

// BAD: Service locator
public class OrderService
{
    public void Process()
    {
        var repo = ServiceLocator.Get<IOrderRepository>(); // Hidden dependency
    }
}
```

### Exception Handling
```csharp
// GOOD: Specific exception + re-throw
try
{
    await _repository.SaveAsync(entity);
}
catch (DbUpdateException ex)
{
    _logger.LogError(ex, "Failed to save entity {Id}", entity.Id);
    throw; // Preserves stack trace
}

// BAD: Catch-all + throw ex
try
{
    await _repository.SaveAsync(entity);
}
catch (Exception ex)
{
    throw ex; // Loses stack trace
}
```

### Logging
```csharp
// GOOD: Structured logging
_logger.LogInformation("Processing order {OrderId} for customer {CustomerId}",
    order.Id, order.CustomerId);

// BAD: String interpolation
_logger.LogInformation($"Processing order {order.Id} for customer {order.CustomerId}");
```

### Configuration
```csharp
// GOOD: Options pattern
services.Configure<EmailSettings>(configuration.GetSection("Email"));

// BAD: Direct configuration access
var server = Configuration["Email:SmtpServer"];
```

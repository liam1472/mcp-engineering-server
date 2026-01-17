# .NET OPERATIONS BLUEPRINT
## Deployment & Operations Standards for .NET Applications

> **Project Type:** .NET (ASP.NET Core, WPF, MAUI, Blazor, Console, Windows Service)
> **Objective:** Reliable deployment, auto-updates, enterprise-grade operations
> **Inspired by:** Microsoft deployment best practices, Azure DevOps patterns

---

## 🔄 AUTO-UPDATE MECHANISMS

### 1. Desktop Apps (WPF/WinForms/MAUI)

#### Option A: Squirrel.Windows (Recommended)
- [ ] Self-contained deployment
- [ ] Delta updates (only changed files)
- [ ] Rollback support
- [ ] Offline installation

```csharp
// Update check on startup
using Squirrel;

public async Task CheckForUpdates()
{
    using var manager = await UpdateManager.GitHubUpdateManager(
        "https://github.com/yourorg/yourapp");

    var updateInfo = await manager.CheckForUpdate();

    if (updateInfo.ReleasesToApply.Any())
    {
        await manager.UpdateApp();
        UpdateManager.RestartApp();
    }
}
```

#### Option B: ClickOnce
- [ ] Automatic updates via manifest
- [ ] Partial trust deployment
- [ ] Online/offline modes

#### Option C: MSIX
- [ ] Modern packaging format
- [ ] Store or sideload distribution
- [ ] Auto-update via App Installer

### Update Manifest Format
```yaml
# update-manifest.yaml
application:
  name: "MyDesktopApp"
  current_version: "2.1.0"
  release_date: "2026-01-17"

updates:
  - version: "2.1.0"
    release_notes: "Bug fixes and performance improvements"
    mandatory: false
    download_url: "https://releases.example.com/v2.1.0/MyApp-Setup.exe"
    sha256: "abc123..."
    size_bytes: 52428800

  - version: "2.0.0"
    release_notes: "Major feature release"
    mandatory: true
    min_os_version: "10.0.19041"

channels:
  stable: "2.1.0"
  beta: "2.2.0-beta.1"
  canary: "2.3.0-alpha.5"
```

---

## 🏗️ CI/CD BUILD PIPELINE

### 1. Azure DevOps Pipeline
```yaml
# azure-pipelines.yml
trigger:
  - main
  - release/*

pool:
  vmImage: 'windows-latest'

variables:
  buildConfiguration: 'Release'
  dotnetVersion: '8.0.x'

stages:
  - stage: Build
    jobs:
      - job: BuildAndTest
        steps:
          - task: UseDotNet@2
            inputs:
              version: '$(dotnetVersion)'

          - task: DotNetCoreCLI@2
            displayName: 'Restore'
            inputs:
              command: 'restore'

          - task: DotNetCoreCLI@2
            displayName: 'Build'
            inputs:
              command: 'build'
              arguments: '--configuration $(buildConfiguration) --no-restore'

          - task: DotNetCoreCLI@2
            displayName: 'Test'
            inputs:
              command: 'test'
              arguments: '--configuration $(buildConfiguration) --no-build --collect:"XPlat Code Coverage"'

          - task: PublishCodeCoverageResults@1
            inputs:
              codeCoverageTool: 'Cobertura'
              summaryFileLocation: '$(Agent.TempDirectory)/**/coverage.cobertura.xml'

  - stage: Publish
    dependsOn: Build
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - job: PublishArtifacts
        steps:
          - task: DotNetCoreCLI@2
            displayName: 'Publish'
            inputs:
              command: 'publish'
              arguments: '--configuration $(buildConfiguration) --output $(Build.ArtifactStagingDirectory)'

          - task: PublishBuildArtifacts@1
            inputs:
              pathToPublish: '$(Build.ArtifactStagingDirectory)'
              artifactName: 'drop'
```

### 2. GitHub Actions
```yaml
# .github/workflows/dotnet.yml
name: .NET CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'

      - name: Restore
        run: dotnet restore

      - name: Build
        run: dotnet build --configuration Release --no-restore

      - name: Test
        run: dotnet test --configuration Release --no-build --verbosity normal

      - name: Publish
        if: github.ref == 'refs/heads/main'
        run: dotnet publish --configuration Release --output ./publish

      - name: Upload artifact
        if: github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: app-release
          path: ./publish
```

---

## 📊 CENTRALIZED LOGGING

### 1. Serilog Configuration
```csharp
// Program.cs
using Serilog;
using Serilog.Events;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Information)
    .Enrich.FromLogContext()
    .Enrich.WithMachineName()
    .Enrich.WithEnvironmentName()
    .WriteTo.Console(outputTemplate:
        "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.File("logs/app-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30)
    .WriteTo.Seq("http://seq-server:5341")  // Or Elasticsearch, Splunk
    .CreateLogger();

builder.Host.UseSerilog();
```

### 2. Structured Logging Usage
```csharp
public class OrderService
{
    private readonly ILogger<OrderService> _logger;

    public async Task<Order> CreateOrderAsync(CreateOrderRequest request)
    {
        using var _ = _logger.BeginScope(new Dictionary<string, object>
        {
            ["CorrelationId"] = request.CorrelationId,
            ["UserId"] = request.UserId
        });

        _logger.LogInformation("Creating order for {ProductCount} products",
            request.Products.Count);

        try
        {
            var order = await _repository.CreateAsync(request);

            _logger.LogInformation("Order {OrderId} created successfully",
                order.Id);

            return order;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create order for user {UserId}",
                request.UserId);
            throw;
        }
    }
}
```

### 3. Log Aggregation Targets
| Target | Use Case | Configuration |
|--------|----------|---------------|
| Seq | Development, small teams | `WriteTo.Seq()` |
| Elasticsearch | Large scale, Kibana dashboards | `WriteTo.Elasticsearch()` |
| Azure App Insights | Azure hosted apps | `WriteTo.ApplicationInsights()` |
| Splunk | Enterprise | `WriteTo.EventCollector()` |

---

## ✅ HEALTH CHECKS (ASP.NET Core)

### 1. Health Check Setup
```csharp
// Program.cs
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("database")
    .AddRedis(redisConnectionString, "redis")
    .AddUrlGroup(new Uri("https://external-api.com/health"), "external-api")
    .AddCheck<CustomHealthCheck>("custom");

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = WriteHealthCheckResponse
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = WriteHealthCheckResponse
});

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false  // Always returns healthy if app is running
});
```

### 2. Custom Health Check
```csharp
public class CustomHealthCheck : IHealthCheck
{
    private readonly IExternalService _service;

    public CustomHealthCheck(IExternalService service)
    {
        _service = service;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var isHealthy = await _service.PingAsync(cancellationToken);

            return isHealthy
                ? HealthCheckResult.Healthy("Service is responding")
                : HealthCheckResult.Degraded("Service is slow");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Service is down", ex);
        }
    }
}
```

### Health Response Format
```json
{
  "status": "Healthy",
  "totalDuration": "00:00:00.1234567",
  "entries": {
    "database": {
      "status": "Healthy",
      "duration": "00:00:00.0123456",
      "data": {}
    },
    "redis": {
      "status": "Healthy",
      "duration": "00:00:00.0012345",
      "data": {}
    },
    "external-api": {
      "status": "Degraded",
      "duration": "00:00:02.5000000",
      "description": "High latency"
    }
  }
}
```

---

## 🐳 CONTAINERIZATION (.NET)

### Dockerfile
```dockerfile
# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["MyApp.csproj", "./"]
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Security: non-root user
RUN adduser --disabled-password --gecos "" appuser
USER appuser

COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "MyApp.dll"]
```

---

## 🔒 SECURITY CHECKLIST

### Application Security
- [ ] Input validation (FluentValidation)
- [ ] Output encoding
- [ ] Anti-forgery tokens (CSRF)
- [ ] Secure headers (SecurityHeaders NuGet)
- [ ] Rate limiting

### Authentication & Authorization
- [ ] ASP.NET Core Identity or Azure AD
- [ ] JWT validation configured
- [ ] Role-based access control
- [ ] Claims-based authorization

### Secrets Management
- [ ] User Secrets for development
- [ ] Azure Key Vault for production
- [ ] No secrets in `appsettings.json`
- [ ] Connection strings encrypted

---

## 📋 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All tests passing
- [ ] Code review approved
- [ ] Security scan clean
- [ ] Performance baseline established
- [ ] Rollback plan documented

### Deployment
- [ ] Database migrations run
- [ ] Health checks pass
- [ ] Smoke tests pass
- [ ] Monitoring alerts configured

### Post-Deployment
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify logging working
- [ ] Notify stakeholders

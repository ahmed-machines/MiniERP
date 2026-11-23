using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using MiniErp.Api.Common;
using MiniErp.Api.Data;
using MiniErp.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

// ---------- Database ----------
builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlServer(
    cfg.GetConnectionString("Default"),
    // Compatibility level 120 keeps generated SQL valid on SQL Server 2014+ (no OPENJSON requirement).
    sql => sql.UseCompatibilityLevel(cfg.GetValue("Database:CompatibilityLevel", 120))));

// ---------- Auth ----------
var jwt = cfg.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (string.IsNullOrWhiteSpace(jwt.Key) || jwt.Key.Length < 32)
    throw new InvalidOperationException("Jwt:Key must be configured with at least 32 characters (use user-secrets or an environment variable).");
builder.Services.Configure<JwtOptions>(cfg.GetSection("Jwt"));
builder.Services.AddSingleton<TokenService>();
builder.Services.AddScoped<InvoiceService>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidIssuer = jwt.Issuer,
        ValidateAudience = true, ValidAudience = jwt.Audience,
        ValidateIssuerSigningKey = true, IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
        ValidateLifetime = true, ClockSkew = TimeSpan.FromMinutes(1),
        RoleClaimType = System.Security.Claims.ClaimTypes.Role, NameClaimType = System.Security.Claims.ClaimTypes.Name
    };
    // Reject tokens of users that were disabled after the token was issued.
    o.Events = new JwtBearerEvents
    {
        OnTokenValidated = async ctx =>
        {
            var idStr = ctx.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
            if (!int.TryParse(idStr, out var id) || !await db.Users.AsNoTracking().AnyAsync(u => u.Id == id && u.IsActive))
                ctx.Fail("user_disabled");
        }
    };
});
builder.Services.AddAuthorization();

// Brute-force protection on login.
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = cfg.GetValue("RateLimit:LoginPerMinute", 10), Window = TimeSpan.FromMinutes(1) }));
});

// ---------- MVC / validation ----------
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
    .ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = ctx =>
    {
        static string Camel(string k) => string.Join('.', k.Split('.').Select(s => s.Length == 0 ? s : char.ToLowerInvariant(s[0]) + s[1..]));
        var known = new HashSet<string> { "required", "maxLength", "minLength", "length", "range", "email", "pattern", "itemsRequired" };
        var errors = ctx.ModelState.Where(kv => kv.Value!.Errors.Count > 0).ToDictionary(
            kv => Camel(kv.Key.TrimStart('$', '.')),
            kv => kv.Value!.Errors.Select(e => known.Contains(e.ErrorMessage) ? e.ErrorMessage : "invalid").Distinct().ToArray());
        return new BadRequestObjectResult(new { status = 400, code = "validation", errors, traceId = ctx.HttpContext.TraceIdentifier });
    });

var origins = cfg.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:4200"];
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Mini ERP API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT", In = ParameterLocation.Header, Description = "Paste the JWT token"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = []
    });
});

var app = builder.Build();

app.UseMiddleware<ErrorHandlingMiddleware>();
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else app.UseHsts();

app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", time = DateTime.UtcNow })).AllowAnonymous();

// ---------- Migrate + seed ----------
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (cfg.GetValue("Database:AutoMigrate", true)) await db.Database.MigrateAsync();
    await DbSeeder.SeedAsync(db, cfg.GetValue("Seed:DemoData", false), cfg);
}

app.Run();

public partial class Program;

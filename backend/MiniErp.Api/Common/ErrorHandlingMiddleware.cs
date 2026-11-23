using System.Text.Json;
using MiniErp.Api.Common;

namespace MiniErp.Api.Common;

/// <summary>Maps exceptions to a consistent JSON error shape: { status, code, args?, traceId }.</summary>
public class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> log)
{
    public async Task Invoke(HttpContext ctx)
    {
        try { await next(ctx); }
        catch (BusinessException ex)
        {
            await Write(ctx, ex.Status, ex.Code, ex.Args);
        }
        catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested)
        {
            ctx.Response.StatusCode = 499;
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Unhandled exception for {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
            await Write(ctx, 500, "server_error", null);
        }
    }

    private static Task Write(HttpContext ctx, int status, string code, Dictionary<string, object?>? args)
    {
        if (ctx.Response.HasStarted) return Task.CompletedTask;
        ctx.Response.Clear();
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/json";
        return ctx.Response.WriteAsync(JsonSerializer.Serialize(
            new { status, code, args, traceId = ctx.TraceIdentifier },
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
    }
}

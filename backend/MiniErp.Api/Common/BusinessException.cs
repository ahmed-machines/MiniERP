namespace MiniErp.Api.Common;

/// <summary>
/// A business-rule violation. <see cref="Code"/> is a stable machine-readable key
/// (e.g. "insufficient_stock") that the frontend translates; <see cref="Args"/> carries interpolation values.
/// </summary>
public class BusinessException(string code, int status = 400, Dictionary<string, object?>? args = null) : Exception(code)
{
    public string Code { get; } = code;
    public int Status { get; } = status;
    public Dictionary<string, object?>? Args { get; } = args;

    public static BusinessException NotFound(string code = "not_found") => new(code, 404);
    public static BusinessException Conflict(string code) => new(code, 409);
}

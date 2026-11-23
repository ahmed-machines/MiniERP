using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using MiniErp.Api.Entities;

namespace MiniErp.Api.Services;

public class JwtOptions
{
    public string Issuer { get; set; } = "MiniErp";
    public string Audience { get; set; } = "MiniErp.Client";
    public string Key { get; set; } = "";
    public int ExpiryMinutes { get; set; } = 480;
}

public class TokenService(Microsoft.Extensions.Options.IOptions<JwtOptions> opt)
{
    private readonly JwtOptions _o = opt.Value;

    public (string token, DateTime expires) Create(User user)
    {
        var expires = DateTime.UtcNow.AddMinutes(_o.ExpiryMinutes);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim("username", user.Username),
            new Claim(ClaimTypes.Role, user.Role.ToString())
        };
        var creds = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_o.Key)), SecurityAlgorithms.HmacSha256);
        var jwt = new JwtSecurityToken(_o.Issuer, _o.Audience, claims, expires: expires, signingCredentials: creds);
        return (new JwtSecurityTokenHandler().WriteToken(jwt), expires);
    }
}

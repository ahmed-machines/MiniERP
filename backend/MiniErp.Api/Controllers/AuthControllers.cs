using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Data;
using MiniErp.Api.Dtos;
using MiniErp.Api.Entities;
using MiniErp.Api.Services;

namespace MiniErp.Api.Controllers;

public static class ControllerExtensions
{
    public static int UserId(this ControllerBase c) =>
        int.Parse(c.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new BusinessException("unauthorized", 401));
    public static bool IsAdmin(this ControllerBase c) => c.User.IsInRole(nameof(UserRole.Admin));
    public static UserInfo ToInfo(this User u) => new(u.Id, u.FullName, u.Username, u.Email, u.Role.ToString(), u.IsActive);
}

[ApiController, Route("api/auth")]
public class AuthController(AppDbContext db, TokenService tokens) : ControllerBase
{
    [HttpPost("login"), AllowAnonymous, EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == req.Username.Trim());
        // Same error for unknown user / wrong password / disabled account to avoid user enumeration.
        if (user is null || !user.IsActive || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            throw new BusinessException("invalid_credentials", 401);
        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        var (token, exp) = tokens.Create(user);
        return new LoginResponse(token, exp, user.ToInfo());
    }

    [HttpGet("me"), Authorize]
    public async Task<ActionResult<UserInfo>> Me()
    {
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == this.UserId() && x.IsActive)
                ?? throw new BusinessException("unauthorized", 401);
        return u.ToInfo();
    }

    [HttpPost("change-password"), Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest req)
    {
        var u = await db.Users.FirstAsync(x => x.Id == this.UserId());
        if (!BCrypt.Net.BCrypt.Verify(req.CurrentPassword, u.PasswordHash)) throw new BusinessException("wrong_password", 400);
        u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        await db.SaveChangesAsync();
        return NoContent();
    }
}

[ApiController, Route("api/users"), Authorize(Roles = "Admin")]
public class UsersController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<UserInfo>> List() =>
        (await db.Users.AsNoTracking().OrderBy(u => u.FullName).ToListAsync()).Select(u => u.ToInfo()).ToList();

    [HttpPost]
    public async Task<ActionResult<UserInfo>> Create(UserSaveRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Password)) throw new BusinessException("password_required");
        var username = req.Username.Trim();
        if (await db.Users.AnyAsync(u => u.Username == username)) throw BusinessException.Conflict("username_taken");
        var u = new User
        {
            FullName = req.FullName.Trim(), Username = username, Email = req.Email.Trim(), Role = req.Role,
            IsActive = req.IsActive, PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password)
        };
        db.Users.Add(u);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(List), u.ToInfo());
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<UserInfo>> Update(int id, UserSaveRequest req)
    {
        var u = await db.Users.FindAsync(id) ?? throw BusinessException.NotFound("user_not_found");
        var username = req.Username.Trim();
        if (await db.Users.AnyAsync(x => x.Username == username && x.Id != id)) throw BusinessException.Conflict("username_taken");
        if (id == this.UserId() && (!req.IsActive || req.Role != UserRole.Admin)) throw new BusinessException("cannot_modify_self");
        // Never leave the system without an active admin.
        if (u.Role == UserRole.Admin && (req.Role != UserRole.Admin || !req.IsActive)
            && !await db.Users.AnyAsync(x => x.Id != id && x.Role == UserRole.Admin && x.IsActive))
            throw new BusinessException("last_admin");
        u.FullName = req.FullName.Trim(); u.Username = username; u.Email = req.Email.Trim();
        u.Role = req.Role; u.IsActive = req.IsActive;
        if (!string.IsNullOrWhiteSpace(req.Password)) u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);
        await db.SaveChangesAsync();
        return u.ToInfo();
    }
}

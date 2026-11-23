using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Data;
using MiniErp.Api.Dtos;
using MiniErp.Api.Entities;

namespace MiniErp.Api.Controllers;

[ApiController, Route("api/products"), Authorize]
public class ProductsController(AppDbContext db) : ControllerBase
{
    private ProductDto Map(Product p) => new(p.Id, p.Name, p.Sku, p.Category, p.Description, p.Price,
        this.IsAdmin() ? p.Cost : 0m, // cost price is confidential: hidden from cashiers
        p.StockQuantity, p.LowStockThreshold, p.IsActive, p.StockQuantity <= p.LowStockThreshold, p.CreatedAt);

    [HttpGet]
    public async Task<PagedResult<ProductDto>> List([FromQuery] string? search, [FromQuery] string? category,
        [FromQuery] string? status, [FromQuery] string? sortBy, [FromQuery] bool desc = false,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var q = db.Products.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(p => p.Name.Contains(s) || p.Sku.Contains(s) || (p.Category != null && p.Category.Contains(s)));
        }
        if (!string.IsNullOrWhiteSpace(category)) q = q.Where(p => p.Category == category);
        q = status switch
        {
            "active" => q.Where(p => p.IsActive),
            "inactive" => q.Where(p => !p.IsActive),
            "low" => q.Where(p => p.StockQuantity <= p.LowStockThreshold),
            "out" => q.Where(p => p.StockQuantity == 0),
            _ => q
        };
        IOrderedQueryable<Product> ordered = (sortBy?.ToLowerInvariant()) switch
        {
            "sku" => desc ? q.OrderByDescending(p => p.Sku) : q.OrderBy(p => p.Sku),
            "price" => desc ? q.OrderByDescending(p => p.Price) : q.OrderBy(p => p.Price),
            "stock" => desc ? q.OrderByDescending(p => p.StockQuantity) : q.OrderBy(p => p.StockQuantity),
            "category" => desc ? q.OrderByDescending(p => p.Category) : q.OrderBy(p => p.Category),
            _ => desc ? q.OrderByDescending(p => p.Name) : q.OrderBy(p => p.Name)
        };
        var total = await q.CountAsync();
        var items = await ordered.ThenBy(p => p.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return new PagedResult<ProductDto>(items.Select(Map).ToList(), total, page, pageSize);
    }

    [HttpGet("categories")]
    public async Task<IReadOnlyList<string>> Categories() =>
        await db.Products.AsNoTracking().Where(p => p.Category != null && p.Category != "")
            .Select(p => p.Category!).Distinct().OrderBy(c => c).ToListAsync();

    [HttpGet("{id:int}")]
    public async Task<ProductDto> Get(int id) =>
        Map(await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id) ?? throw BusinessException.NotFound("product_not_found"));

    [HttpPost, Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProductDto>> Create(ProductSaveRequest req)
    {
        var sku = req.Sku.Trim();
        if (await db.Products.AnyAsync(p => p.Sku == sku)) throw BusinessException.Conflict("sku_taken");
        var p = new Product
        {
            Name = req.Name.Trim(), Sku = sku, Category = Clean(req.Category), Description = Clean(req.Description),
            Price = req.Price, Cost = req.Cost, StockQuantity = req.StockQuantity, LowStockThreshold = req.LowStockThreshold,
            IsActive = req.IsActive
        };
        db.Products.Add(p);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException)
        {
            // Lost a race on the unique SKU index.
            db.ChangeTracker.Clear();
            if (await db.Products.AnyAsync(x => x.Sku == sku)) throw BusinessException.Conflict("sku_taken");
            throw;
        }
        if (p.StockQuantity > 0)
        {
            db.StockMovements.Add(new StockMovement
            {
                ProductId = p.Id, Type = StockMovementType.Initial, QuantityChange = p.StockQuantity,
                BalanceAfter = p.StockQuantity, UserId = this.UserId()
            });
            await db.SaveChangesAsync();
        }
        return CreatedAtAction(nameof(Get), new { id = p.Id }, Map(p));
    }

    /// <summary>Stock quantity is deliberately NOT editable here; use adjust-stock so every change is audited.</summary>
    [HttpPut("{id:int}"), Authorize(Roles = "Admin")]
    public async Task<ProductDto> Update(int id, ProductSaveRequest req)
    {
        var p = await db.Products.FindAsync(id) ?? throw BusinessException.NotFound("product_not_found");
        var sku = req.Sku.Trim();
        if (await db.Products.AnyAsync(x => x.Sku == sku && x.Id != id)) throw BusinessException.Conflict("sku_taken");
        p.Name = req.Name.Trim(); p.Sku = sku; p.Category = Clean(req.Category); p.Description = Clean(req.Description);
        p.Price = req.Price; p.Cost = req.Cost; p.LowStockThreshold = req.LowStockThreshold; p.IsActive = req.IsActive;
        p.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Map(p);
    }

    [HttpDelete("{id:int}"), Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var p = await db.Products.FindAsync(id) ?? throw BusinessException.NotFound("product_not_found");
        p.IsDeleted = true; p.DeletedAt = DateTime.UtcNow; p.IsActive = false;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/adjust-stock"), Authorize(Roles = "Admin")]
    public async Task<ProductDto> AdjustStock(int id, StockAdjustRequest req)
    {
        if (req.Change == 0) throw new BusinessException("invalid_adjustment");
        await using var tx = await db.Database.BeginTransactionAsync();
        var affected = await db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE Products SET StockQuantity = StockQuantity + {req.Change}, UpdatedAt = SYSUTCDATETIME() WHERE Id = {id} AND IsDeleted = 0 AND StockQuantity + {req.Change} >= 0");
        if (affected == 0)
        {
            if (!await db.Products.AnyAsync(p => p.Id == id)) throw BusinessException.NotFound("product_not_found");
            throw new BusinessException("stock_cannot_be_negative");
        }
        var p = await db.Products.AsNoTracking().FirstAsync(x => x.Id == id);
        db.StockMovements.Add(new StockMovement
        {
            ProductId = id, Type = StockMovementType.Adjustment, QuantityChange = req.Change, BalanceAfter = p.StockQuantity,
            Note = Clean(req.Note), UserId = this.UserId()
        });
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Map(p);
    }

    [HttpGet("{id:int}/movements")]
    public async Task<IReadOnlyList<StockMovementDto>> Movements(int id) =>
        await db.StockMovements.AsNoTracking().Where(m => m.ProductId == id).OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Take(100).Select(m => new StockMovementDto(m.Id, m.Type.ToString(), m.QuantityChange, m.BalanceAfter, m.Reference, m.Note, m.CreatedAt))
            .ToListAsync();

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

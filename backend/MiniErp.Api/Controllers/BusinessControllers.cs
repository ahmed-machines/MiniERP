using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Data;
using MiniErp.Api.Dtos;
using MiniErp.Api.Entities;
using MiniErp.Api.Services;

namespace MiniErp.Api.Controllers;

[ApiController, Route("api/customers"), Authorize]
public class CustomersController(AppDbContext db) : ControllerBase
{
    private IQueryable<CustomerDto> Projection(IQueryable<Customer> q) => q.Select(c => new CustomerDto(
        c.Id, c.Name, c.Email, c.Phone, c.Address, c.TaxNumber, c.Notes, c.CreatedAt,
        c.Invoices.Count(i => i.Status == InvoiceStatus.Paid),
        c.Invoices.Where(i => i.Status == InvoiceStatus.Paid).Sum(i => (decimal?)i.Total) ?? 0m));

    [HttpGet]
    public async Task<PagedResult<CustomerDto>> List([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var q = db.Customers.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(c => c.Name.Contains(s) || (c.Email != null && c.Email.Contains(s)) || (c.Phone != null && c.Phone.Contains(s)));
        }
        var total = await q.CountAsync();
        var items = await Projection(q.OrderBy(c => c.Name).ThenBy(c => c.Id).Skip((page - 1) * pageSize).Take(pageSize)).ToListAsync();
        return new PagedResult<CustomerDto>(items, total, page, pageSize);
    }

    [HttpGet("{id:int}")]
    public async Task<CustomerDetailDto> Get(int id)
    {
        var c = await Projection(db.Customers.AsNoTracking().Where(x => x.Id == id)).FirstOrDefaultAsync()
                ?? throw BusinessException.NotFound("customer_not_found");
        var invoices = await db.Invoices.AsNoTracking().Where(i => i.CustomerId == id).OrderByDescending(i => i.Date)
            .Select(i => new InvoiceSummaryDto(i.Id, i.InvoiceNumber, i.Date, i.CustomerId, i.CustomerName, i.Status.ToString(),
                i.PaymentMethod.ToString(), i.Total, i.CurrencySymbol)).ToListAsync();
        return new CustomerDetailDto(c, invoices);
    }

    [HttpPost]
    public async Task<ActionResult<CustomerDto>> Create(CustomerSaveRequest req)
    {
        var c = new Customer();
        Apply(c, req);
        db.Customers.Add(c);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = c.Id }, (await Get(c.Id)).Customer);
    }

    [HttpPut("{id:int}")]
    public async Task<CustomerDto> Update(int id, CustomerSaveRequest req)
    {
        var c = await db.Customers.FindAsync(id) ?? throw BusinessException.NotFound("customer_not_found");
        Apply(c, req);
        c.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return (await Get(id)).Customer;
    }

    [HttpDelete("{id:int}"), Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var c = await db.Customers.FindAsync(id) ?? throw BusinessException.NotFound("customer_not_found");
        c.IsDeleted = true; c.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static void Apply(Customer c, CustomerSaveRequest r)
    {
        static string? N(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
        c.Name = r.Name.Trim(); c.Email = N(r.Email); c.Phone = N(r.Phone); c.Address = N(r.Address);
        c.TaxNumber = N(r.TaxNumber); c.Notes = N(r.Notes);
    }
}

[ApiController, Route("api/invoices"), Authorize]
public class InvoicesController(AppDbContext db, InvoiceService service) : ControllerBase
{
    [HttpGet]
    public async Task<PagedResult<InvoiceSummaryDto>> List([FromQuery] string? search, [FromQuery] string? status,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int? customerId,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var q = db.Invoices.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(i => i.InvoiceNumber.Contains(s) || i.CustomerName.Contains(s));
        }
        if (Enum.TryParse<InvoiceStatus>(status, true, out var st)) q = q.Where(i => i.Status == st);
        if (from.HasValue) q = q.Where(i => i.Date >= from.Value);
        if (to.HasValue) q = q.Where(i => i.Date < to.Value);
        if (customerId.HasValue) q = q.Where(i => i.CustomerId == customerId);
        var total = await q.CountAsync();
        var items = await q.OrderByDescending(i => i.Date).ThenByDescending(i => i.Id).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(i => new InvoiceSummaryDto(i.Id, i.InvoiceNumber, i.Date, i.CustomerId, i.CustomerName, i.Status.ToString(),
                i.PaymentMethod.ToString(), i.Total, i.CurrencySymbol)).ToListAsync();
        return new PagedResult<InvoiceSummaryDto>(items, total, page, pageSize);
    }

    [HttpGet("{id:int}")]
    public async Task<InvoiceDetailDto> Get(int id)
    {
        var i = await db.Invoices.IgnoreQueryFilters().AsNoTracking().Include(x => x.Items).Include(x => x.Customer).Include(x => x.CreatedBy)
                    .AsSplitQuery().FirstOrDefaultAsync(x => x.Id == id)
                ?? throw BusinessException.NotFound("invoice_not_found");
        return new InvoiceDetailDto(i.Id, i.InvoiceNumber, i.Date, i.CustomerId, i.CustomerName, i.Customer?.Address, i.Customer?.Phone,
            i.Customer?.TaxNumber, i.CreatedBy?.FullName ?? "", i.Status.ToString(), i.PaymentMethod.ToString(), i.Subtotal,
            i.DiscountType.ToString(), i.DiscountValue, i.DiscountAmount, i.TaxRate, i.TaxAmount, i.Total, i.CurrencyCode,
            i.CurrencySymbol, i.Notes, i.CancelledAt, i.CancelReason,
            i.Items.OrderBy(x => x.Id).Select(x => new InvoiceItemDto(x.Id, x.ProductId, x.ProductName, x.Sku, x.UnitPrice, x.Quantity,
                x.DiscountPercent, x.LineTotal)).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<InvoiceDetailDto>> Create(InvoiceCreateRequest req, CancellationToken ct)
    {
        var id = await service.CreateAsync(req, this.UserId(), ct);
        return CreatedAtAction(nameof(Get), new { id }, await Get(id));
    }

    /// <summary>Preview of the server-side calculation so the UI never has to own the business rules.</summary>
    [HttpPost("preview")]
    public async Task<object> Preview(InvoiceCreateRequest req)
    {
        var ids = req.Items.Select(x => x.ProductId).ToList();
        var prices = await db.Products.AsNoTracking().Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Price);
        var s = await db.Settings.AsNoTracking().FirstAsync();
        var rate = s.TaxEnabled ? s.TaxRate : 0m;
        var t = InvoiceCalculator.Calculate(
            req.Items.Where(i => prices.ContainsKey(i.ProductId)).Select(i => new CalcLine(prices[i.ProductId], i.Quantity, i.DiscountPercent)),
            req.DiscountType, req.DiscountValue, rate);
        return new { t.LineTotals, t.Subtotal, t.DiscountAmount, taxRate = rate, t.TaxAmount, t.Total };
    }

    [HttpPost("{id:int}/cancel"), Authorize(Roles = "Admin")]
    public async Task<InvoiceDetailDto> Cancel(int id, InvoiceCancelRequest req, CancellationToken ct)
    {
        await service.CancelAsync(id, req.Reason, this.UserId(), ct);
        return await Get(id);
    }
}

[ApiController, Route("api/settings"), Authorize]
public class SettingsController(AppDbContext db) : ControllerBase
{
    private static readonly string[] AllowedLogoTypes = ["image/png", "image/jpeg", "image/webp"];
    private const int MaxLogoBytes = 1024 * 1024;

    private static SettingsDto Map(AppSettings s) => new(s.BusinessName, s.BusinessNameAr, s.Address, s.Phone, s.Email, s.TaxNumber,
        s.Logo is { Length: > 0 }, s.LogoUpdatedAt, s.CurrencyCode, s.CurrencySymbol, s.TaxEnabled, s.TaxRate, s.InvoicePrefix,
        s.NextInvoiceNumber, s.InvoiceFooter);

    [HttpGet("public"), AllowAnonymous]
    public async Task<object> Public()
    {
        var s = await db.Settings.AsNoTracking()
            .Select(x => new { x.BusinessName, x.BusinessNameAr, HasLogo = x.Logo != null && x.Logo.Length > 0, x.LogoUpdatedAt })
            .FirstAsync();
        return s;
    }

    [HttpGet]
    public async Task<SettingsDto> Get() => Map(await db.Settings.AsNoTracking().FirstAsync());

    [HttpPut, Authorize(Roles = "Admin")]
    public async Task<SettingsDto> Update(SettingsSaveRequest r)
    {
        var s = await db.Settings.FirstAsync();
        static string? N(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
        s.BusinessName = r.BusinessName.Trim(); s.BusinessNameAr = N(r.BusinessNameAr); s.Address = N(r.Address);
        s.Phone = N(r.Phone); s.Email = N(r.Email); s.TaxNumber = N(r.TaxNumber);
        s.CurrencyCode = r.CurrencyCode.Trim().ToUpperInvariant(); s.CurrencySymbol = r.CurrencySymbol.Trim();
        s.TaxEnabled = r.TaxEnabled; s.TaxRate = r.TaxRate; s.InvoicePrefix = r.InvoicePrefix.Trim(); s.InvoiceFooter = N(r.InvoiceFooter);
        // Never allow the counter to go backwards onto an already-used number.
        s.NextInvoiceNumber = Math.Max(r.NextInvoiceNumber, s.NextInvoiceNumber);
        await db.SaveChangesAsync();
        return Map(s);
    }

    [HttpPost("logo"), Authorize(Roles = "Admin"), RequestSizeLimit(MaxLogoBytes + 4096)]
    public async Task<SettingsDto> UploadLogo(IFormFile file)
    {
        if (file is null || file.Length == 0) throw new BusinessException("file_required");
        if (file.Length > MaxLogoBytes) throw new BusinessException("file_too_large");
        if (!AllowedLogoTypes.Contains(file.ContentType)) throw new BusinessException("invalid_file_type");
        await using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var bytes = ms.ToArray();
        if (!HasImageSignature(bytes)) throw new BusinessException("invalid_file_type");
        var s = await db.Settings.FirstAsync();
        s.Logo = bytes; s.LogoContentType = file.ContentType; s.LogoUpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Map(s);
    }

    [HttpDelete("logo"), Authorize(Roles = "Admin")]
    public async Task<SettingsDto> DeleteLogo()
    {
        var s = await db.Settings.FirstAsync();
        s.Logo = null; s.LogoContentType = null; s.LogoUpdatedAt = null;
        await db.SaveChangesAsync();
        return Map(s);
    }

    /// <summary>Anonymous so it can be used by &lt;img&gt; tags (login page, print view).</summary>
    [HttpGet("logo"), AllowAnonymous]
    public async Task<IActionResult> Logo()
    {
        var s = await db.Settings.AsNoTracking().Select(x => new { x.Logo, x.LogoContentType }).FirstAsync();
        if (s.Logo is not { Length: > 0 }) return NotFound();
        Response.Headers.CacheControl = "public,max-age=300";
        return File(s.Logo, s.LogoContentType ?? "image/png");
    }

    private static bool HasImageSignature(byte[] b) =>
        b.Length > 12 && (
            (b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) ||            // PNG
            (b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) ||                            // JPEG
            (b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P'));
}

[ApiController, Route("api/dashboard"), Authorize]
public class DashboardController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<DashboardDto> Get()
    {
        var paid = db.Invoices.AsNoTracking().Where(i => i.Status == InvoiceStatus.Paid);
        var today = DateTime.UtcNow.Date;
        var since = today.AddDays(-29);

        var totalSales = await paid.SumAsync(i => (decimal?)i.Total) ?? 0m;
        var todaySales = await paid.Where(i => i.Date >= today).SumAsync(i => (decimal?)i.Total) ?? 0m;
        var invoiceCount = await paid.CountAsync();
        var cancelled = await db.Invoices.CountAsync(i => i.Status == InvoiceStatus.Cancelled);
        var productCount = await db.Products.CountAsync();
        var customerCount = await db.Customers.CountAsync();

        var lowQ = db.Products.AsNoTracking().Where(p => p.IsActive && p.StockQuantity <= p.LowStockThreshold);
        var lowCount = await lowQ.CountAsync();
        var low = await lowQ.OrderBy(p => p.StockQuantity).Take(8)
            .Select(p => new LowStockDto(p.Id, p.Name, p.Sku, p.StockQuantity, p.LowStockThreshold)).ToListAsync();

        var recent = await db.Invoices.AsNoTracking().OrderByDescending(i => i.Date).ThenByDescending(i => i.Id).Take(6)
            .Select(i => new InvoiceSummaryDto(i.Id, i.InvoiceNumber, i.Date, i.CustomerId, i.CustomerName, i.Status.ToString(),
                i.PaymentMethod.ToString(), i.Total, i.CurrencySymbol)).ToListAsync();

        var grouped = await paid.Where(i => i.Date >= since)
            .GroupBy(i => i.Date.Date).Select(g => new { Day = g.Key, Total = g.Sum(x => x.Total), Count = g.Count() }).ToListAsync();
        var series = Enumerable.Range(0, 30).Select(n => since.AddDays(n))
            .Select(d => { var g = grouped.FirstOrDefault(x => x.Day == d); return new DailySalesDto(d, g?.Total ?? 0m, g?.Count ?? 0); })
            .ToList();

        var top = (await db.InvoiceItems.AsNoTracking().Where(i => i.Invoice!.Status == InvoiceStatus.Paid)
            .GroupBy(i => new { i.ProductId, i.ProductName })
            .Select(g => new { g.Key.ProductId, g.Key.ProductName, Quantity = g.Sum(x => x.Quantity), Revenue = g.Sum(x => x.LineTotal) })
            .OrderByDescending(x => x.Revenue).Take(5).ToListAsync())
            .Select(x => new TopProductDto(x.ProductId, x.ProductName, x.Quantity, x.Revenue)).ToList();

        var symbol = await db.Settings.AsNoTracking().Select(s => s.CurrencySymbol).FirstAsync();
        return new DashboardDto(totalSales, todaySales, invoiceCount, cancelled, productCount, customerCount, lowCount, symbol,
            low, recent, series, top);
    }
}

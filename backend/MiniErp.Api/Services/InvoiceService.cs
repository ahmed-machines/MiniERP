using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Common;
using MiniErp.Api.Data;
using MiniErp.Api.Dtos;
using MiniErp.Api.Entities;

namespace MiniErp.Api.Services;

public class InvoiceService(AppDbContext db, ILogger<InvoiceService> log)
{
    public async Task<int> CreateAsync(InvoiceCreateRequest req, int userId, CancellationToken ct = default)
    {
        // ---- Cheap validation first (no DB round trips) ----
        if (req.Items.Count == 0) throw new BusinessException("items_required");
        if (req.Items.GroupBy(i => i.ProductId).Any(g => g.Count() > 1)) throw new BusinessException("duplicate_product");
        if (req.DiscountType == DiscountType.Percent && req.DiscountValue > 100) throw new BusinessException("invalid_discount");
        if (req.DiscountType == DiscountType.None && req.DiscountValue != 0) req.DiscountValue = 0;

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        string customerName = "";
        if (req.CustomerId is int cid)
        {
            customerName = await db.Customers.Where(c => c.Id == cid).Select(c => c.Name).FirstOrDefaultAsync(ct)
                           ?? throw new BusinessException("customer_not_found", 404);
        }

        var ids = req.Items.Select(i => i.ProductId).ToList();
        // Query filter hides soft-deleted products, so they cannot be sold. No tracking: stock is changed atomically in SQL.
        var products = await db.Products.AsNoTracking().Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        foreach (var item in req.Items)
        {
            if (!products.TryGetValue(item.ProductId, out var p) || !p.IsActive)
                throw new BusinessException("product_unavailable", 400, new() { ["id"] = item.ProductId });
        }

        // Settings row is locked by this UPDATE until commit, serialising invoice-number generation.
        var settingsRows = await db.Database.ExecuteSqlRawAsync(
            "UPDATE Settings SET NextInvoiceNumber = NextInvoiceNumber + 1 WHERE Id = 1", ct);
        if (settingsRows == 0) throw new BusinessException("settings_missing", 500);
        var settings = await db.Settings.AsNoTracking().FirstAsync(ct);
        var number = settings.NextInvoiceNumber - 1;
        var taxRate = settings.TaxEnabled ? settings.TaxRate : 0m;

        // Authoritative prices come from the DB, never from the client.
        var totals = InvoiceCalculator.Calculate(
            req.Items.Select(i => new CalcLine(products[i.ProductId].Price, i.Quantity, i.DiscountPercent)),
            req.DiscountType, req.DiscountValue, taxRate);

        var invoice = new Invoice
        {
            InvoiceNumber = $"{settings.InvoicePrefix}{number:D5}",
            Date = DateTime.UtcNow,
            CustomerId = req.CustomerId,
            CustomerName = customerName,
            CreatedByUserId = userId,
            PaymentMethod = req.PaymentMethod,
            Status = InvoiceStatus.Paid,
            Subtotal = totals.Subtotal,
            DiscountType = req.DiscountType,
            DiscountValue = req.DiscountValue,
            DiscountAmount = totals.DiscountAmount,
            TaxRate = taxRate,
            TaxAmount = totals.TaxAmount,
            Total = totals.Total,
            CurrencyCode = settings.CurrencyCode,
            CurrencySymbol = settings.CurrencySymbol,
            Notes = req.Notes?.Trim()
        };

        for (var i = 0; i < req.Items.Count; i++)
        {
            var it = req.Items[i];
            var p = products[it.ProductId];
            invoice.Items.Add(new InvoiceItem
            {
                ProductId = p.Id, ProductName = p.Name, Sku = p.Sku, UnitPrice = p.Price, // price snapshot
                Quantity = it.Quantity, DiscountPercent = it.DiscountPercent, LineTotal = totals.LineTotals[i]
            });
        }

        // Atomic conditional decrement: succeeds only if enough stock remains, safe under concurrent sales.
        foreach (var it in req.Items)
        {
            var affected = await db.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE Products SET StockQuantity = StockQuantity - {it.Quantity}, UpdatedAt = SYSUTCDATETIME() WHERE Id = {it.ProductId} AND IsDeleted = 0 AND StockQuantity >= {it.Quantity}", ct);
            if (affected == 0)
            {
                var available = await db.Products.AsNoTracking().Where(p => p.Id == it.ProductId).Select(p => p.StockQuantity).FirstOrDefaultAsync(ct);
                throw new BusinessException("insufficient_stock", 409, new()
                {
                    ["product"] = products[it.ProductId].Name, ["available"] = available, ["requested"] = it.Quantity
                });
            }
        }

        db.Invoices.Add(invoice);
        await db.SaveChangesAsync(ct);

        foreach (var it in req.Items)
        {
            var balance = await db.Products.AsNoTracking().Where(p => p.Id == it.ProductId).Select(p => p.StockQuantity).FirstAsync(ct);
            db.StockMovements.Add(new StockMovement
            {
                ProductId = it.ProductId, Type = StockMovementType.Sale, QuantityChange = -it.Quantity, BalanceAfter = balance,
                Reference = invoice.InvoiceNumber, UserId = userId
            });
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        log.LogInformation("Invoice {Number} created by user {User}, total {Total}", invoice.InvoiceNumber, userId, invoice.Total);
        return invoice.Id;
    }

    public async Task CancelAsync(int invoiceId, string? reason, int userId, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var invoice = await db.Invoices.AsNoTracking().Where(i => i.Id == invoiceId)
            .Select(i => new { i.InvoiceNumber, i.Status }).FirstOrDefaultAsync(ct)
            ?? throw BusinessException.NotFound("invoice_not_found");
        if (invoice.Status == InvoiceStatus.Cancelled) throw new BusinessException("invoice_already_cancelled", 409);

        // Conditional update guards against two simultaneous cancellations restoring stock twice.
        var flipped = await db.Invoices.Where(i => i.Id == invoiceId && i.Status == InvoiceStatus.Paid)
            .ExecuteUpdateAsync(s => s
                .SetProperty(i => i.Status, InvoiceStatus.Cancelled)
                .SetProperty(i => i.CancelledAt, DateTime.UtcNow)
                .SetProperty(i => i.CancelledByUserId, userId)
                .SetProperty(i => i.CancelReason, string.IsNullOrWhiteSpace(reason) ? null : reason.Trim()), ct);
        if (flipped == 0) throw new BusinessException("invoice_already_cancelled", 409);

        var items = await db.InvoiceItems.AsNoTracking().Where(i => i.InvoiceId == invoiceId)
            .Select(i => new { i.ProductId, i.Quantity }).ToListAsync(ct);

        foreach (var it in items)
        {
            // Raw SQL bypasses the soft-delete filter on purpose: stock of deleted products is restored too.
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE Products SET StockQuantity = StockQuantity + {it.Quantity}, UpdatedAt = SYSUTCDATETIME() WHERE Id = {it.ProductId}", ct);
            var balance = await db.Products.IgnoreQueryFilters().AsNoTracking().Where(p => p.Id == it.ProductId)
                .Select(p => p.StockQuantity).FirstAsync(ct);
            db.StockMovements.Add(new StockMovement
            {
                ProductId = it.ProductId, Type = StockMovementType.SaleCancellation, QuantityChange = it.Quantity,
                BalanceAfter = balance, Reference = invoice.InvoiceNumber, Note = reason, UserId = userId
            });
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        log.LogInformation("Invoice {Number} cancelled by user {User}", invoice.InvoiceNumber, userId);
    }
}

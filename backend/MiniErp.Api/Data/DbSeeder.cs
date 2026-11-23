using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Entities;
using MiniErp.Api.Services;

namespace MiniErp.Api.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db, bool demoData, IConfiguration cfg)
    {
        if (!await db.Settings.AnyAsync())
        {
            db.Settings.Add(new AppSettings
            {
                BusinessName = "Acme Trading Co.", BusinessNameAr = "شركة أكمي للتجارة", Address = "123 Market Street, Riyadh",
                Phone = "+966 11 000 0000", Email = "info@acme.example", TaxNumber = "300000000000003",
                CurrencyCode = "USD", CurrencySymbol = "$", TaxEnabled = true, TaxRate = 15, InvoicePrefix = "INV-", NextInvoiceNumber = 1,
                InvoiceFooter = "Thank you for your business! / شكراً لتعاملكم معنا"
            });
            await db.SaveChangesAsync();
        }

        if (!await db.Users.AnyAsync())
        {
            var adminPwd = cfg["Seed:AdminPassword"] ?? "Admin@123";
            var cashierPwd = cfg["Seed:CashierPassword"] ?? "Cashier@123";
            db.Users.AddRange(
                new User { FullName = "System Administrator", Username = "admin", Email = "admin@minierp.local", Role = UserRole.Admin, PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPwd) },
                new User { FullName = "Sara Cashier", Username = "cashier", Email = "cashier@minierp.local", Role = UserRole.Cashier, PasswordHash = BCrypt.Net.BCrypt.HashPassword(cashierPwd) });
            await db.SaveChangesAsync();
        }

        if (demoData && !await db.Products.IgnoreQueryFilters().AnyAsync()) await SeedDemoAsync(db);
    }

    private static async Task SeedDemoAsync(AppDbContext db)
    {
        var rnd = new Random(42);
        (string n, string sku, string cat, decimal price, decimal cost, int stock, int low)[] defs =
        [
            ("Wireless Mouse", "ELC-001", "Electronics", 19.99m, 9.50m, 120, 20),
            ("Mechanical Keyboard", "ELC-002", "Electronics", 74.90m, 41m, 45, 10),
            ("USB-C Hub 7-in-1", "ELC-003", "Electronics", 39.00m, 20m, 60, 15),
            ("27\" 4K Monitor", "ELC-004", "Electronics", 329.00m, 240m, 14, 5),
            ("Noise Cancelling Headphones", "ELC-005", "Electronics", 159.00m, 98m, 8, 10),
            ("Webcam 1080p", "ELC-006", "Electronics", 49.50m, 26m, 35, 10),
            ("Laptop Stand", "ACC-001", "Accessories", 29.90m, 12m, 70, 15),
            ("Laptop Sleeve 15\"", "ACC-002", "Accessories", 24.00m, 9m, 55, 10),
            ("HDMI Cable 2m", "ACC-003", "Accessories", 9.99m, 3m, 200, 40),
            ("Phone Case", "ACC-004", "Accessories", 12.50m, 4m, 4, 25),
            ("A4 Copy Paper (500)", "OFF-001", "Office Supplies", 6.75m, 4.1m, 300, 50),
            ("Ballpoint Pens (12)", "OFF-002", "Office Supplies", 4.20m, 1.8m, 180, 30),
            ("Stapler", "OFF-003", "Office Supplies", 8.90m, 4m, 40, 10),
            ("Sticky Notes Pack", "OFF-004", "Office Supplies", 3.50m, 1.2m, 90, 20),
            ("Whiteboard Markers (4)", "OFF-005", "Office Supplies", 5.80m, 2.3m, 0, 15),
            ("Ergonomic Office Chair", "FUR-001", "Furniture", 189.00m, 120m, 12, 4),
            ("Standing Desk", "FUR-002", "Furniture", 449.00m, 310m, 6, 3),
            ("Desk Lamp LED", "FUR-003", "Furniture", 34.00m, 17m, 25, 8),
            ("Filing Cabinet", "FUR-004", "Furniture", 119.00m, 75m, 9, 3),
            ("Printer Ink Black", "PRT-001", "Printing", 27.50m, 15m, 33, 10),
            ("Printer Ink Color", "PRT-002", "Printing", 32.00m, 18m, 7, 10),
            ("Photo Paper (50)", "PRT-003", "Printing", 14.90m, 7m, 48, 10),
        ];
        var products = defs.Select(d => new Product { Name = d.n, Sku = d.sku, Category = d.cat, Price = d.price, Cost = d.cost,
            StockQuantity = d.stock, LowStockThreshold = d.low, Description = $"{d.n} - {d.cat}" }).ToList();
        db.Products.AddRange(products);

        var customers = new[]
        {
            new Customer { Name = "Al Noor Stationery", Email = "orders@alnoor.example", Phone = "+966 50 111 2233", Address = "Olaya St, Riyadh", TaxNumber = "310111222300003" },
            new Customer { Name = "Fatima Al-Zahra", Email = "fatima@example.com", Phone = "+966 55 222 3344", Address = "Jeddah" },
            new Customer { Name = "Global Tech Solutions", Email = "procurement@globaltech.example", Phone = "+971 4 555 0101", Address = "Dubai Silicon Oasis", TaxNumber = "100200300400003" },
            new Customer { Name = "Omar Hassan", Email = "omar.h@example.com", Phone = "+20 100 123 4567", Address = "Cairo" },
            new Customer { Name = "Bright Minds School", Email = "admin@brightminds.example", Phone = "+966 11 456 7890", Address = "Dammam" },
            new Customer { Name = "Layla Mansour", Email = "layla@example.com", Phone = "+962 79 000 1111", Address = "Amman" },
            new Customer { Name = "Horizon Offices LLC", Email = "ops@horizon.example", Phone = "+966 12 333 4444", Address = "Jeddah Corniche", TaxNumber = "300999888700003" },
            new Customer { Name = "John Smith", Email = "john.smith@example.com", Phone = "+1 202 555 0143", Address = "Washington DC" },
        };
        db.Customers.AddRange(customers);
        await db.SaveChangesAsync();

        var admin = await db.Users.FirstAsync(u => u.Role == UserRole.Admin);
        var cashier = await db.Users.FirstAsync(u => u.Role == UserRole.Cashier);
        var settings = await db.Settings.FirstAsync();

        foreach (var p in products.Where(p => p.StockQuantity > 0))
            db.StockMovements.Add(new StockMovement { ProductId = p.Id, Type = StockMovementType.Initial, QuantityChange = p.StockQuantity,
                BalanceAfter = p.StockQuantity, UserId = admin.Id, CreatedAt = DateTime.UtcNow.AddDays(-31) });

        // Historical invoices over the last 29 days so the dashboard has meaningful charts.
        // Invoice prefixes/numbers go through the same settings counter used by the real flow.
        var methods = Enum.GetValues<PaymentMethod>();
        var movements = new List<StockMovement>();
        for (var day = 29; day >= 0; day--)
        {
            var perDay = rnd.Next(0, 4);
            for (var k = 0; k < perDay; k++)
            {
                var available = products.Where(p => p.StockQuantity > 15).OrderBy(_ => rnd.Next()).Take(rnd.Next(1, 4)).ToList();
                if (available.Count == 0) continue;
                var lines = available.Select(p => (p, qty: rnd.Next(1, 4))).ToList();
                var discType = rnd.Next(5) == 0 ? DiscountType.Percent : DiscountType.None;
                var discVal = discType == DiscountType.Percent ? 5m : 0m;
                var t = InvoiceCalculator.Calculate(lines.Select(l => new CalcLine(l.p.Price, l.qty, 0)), discType, discVal, settings.TaxRate);
                var date = DateTime.UtcNow.Date.AddDays(-day).AddHours(8 + rnd.Next(0, 10)).AddMinutes(rnd.Next(60));
                if (date > DateTime.UtcNow) date = DateTime.UtcNow.AddMinutes(-5);
                var cust = rnd.Next(4) == 0 ? null : customers[rnd.Next(customers.Length)];
                var number = settings.NextInvoiceNumber++;
                var inv = new Invoice
                {
                    InvoiceNumber = $"{settings.InvoicePrefix}{number:D5}", Date = date, CustomerId = cust?.Id, CustomerName = cust?.Name ?? "",
                    CreatedByUserId = rnd.Next(2) == 0 ? admin.Id : cashier.Id, PaymentMethod = methods[rnd.Next(methods.Length)],
                    Subtotal = t.Subtotal, DiscountType = discType, DiscountValue = discVal, DiscountAmount = t.DiscountAmount,
                    TaxRate = settings.TaxRate, TaxAmount = t.TaxAmount, Total = t.Total,
                    CurrencyCode = settings.CurrencyCode, CurrencySymbol = settings.CurrencySymbol
                };
                for (var i = 0; i < lines.Count; i++)
                {
                    var (p, qty) = lines[i];
                    inv.Items.Add(new InvoiceItem { ProductId = p.Id, ProductName = p.Name, Sku = p.Sku, UnitPrice = p.Price, Quantity = qty, LineTotal = t.LineTotals[i] });
                    p.StockQuantity -= qty;
                    movements.Add(new StockMovement { ProductId = p.Id, Type = StockMovementType.Sale, QuantityChange = -qty,
                        BalanceAfter = p.StockQuantity, Reference = inv.InvoiceNumber, UserId = inv.CreatedByUserId, CreatedAt = date });
                }
                // One cancelled invoice for demo purposes (stock is restored below)
                if (day == 12 && k == 0)
                {
                    inv.Status = InvoiceStatus.Cancelled; inv.CancelledAt = date.AddHours(1); inv.CancelledByUserId = admin.Id; inv.CancelReason = "Customer changed their mind";
                    foreach (var it in inv.Items)
                    {
                        var p = products.First(x => x.Id == it.ProductId);
                        p.StockQuantity += it.Quantity;
                        movements.Add(new StockMovement { ProductId = p.Id, Type = StockMovementType.SaleCancellation, QuantityChange = it.Quantity,
                            BalanceAfter = p.StockQuantity, Reference = inv.InvoiceNumber, UserId = admin.Id, CreatedAt = date.AddHours(1) });
                    }
                }
                db.Invoices.Add(inv);
            }
        }
        db.StockMovements.AddRange(movements);
        await db.SaveChangesAsync();
    }
}

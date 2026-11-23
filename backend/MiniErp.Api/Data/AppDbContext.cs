using Microsoft.EntityFrameworkCore;
using MiniErp.Api.Entities;

namespace MiniErp.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<AppSettings> Settings => Set<AppSettings>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.HasIndex(x => x.Username).IsUnique();
            e.Property(x => x.FullName).HasMaxLength(150);
            e.Property(x => x.Username).HasMaxLength(50);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.Role).HasConversion<string>().HasMaxLength(20);
        });

        b.Entity<Product>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Sku).HasMaxLength(50);
            e.Property(x => x.Category).HasMaxLength(100);
            e.Property(x => x.Description).HasMaxLength(2000);
            e.Property(x => x.Price).HasPrecision(18, 2);
            e.Property(x => x.Cost).HasPrecision(18, 2);
            // SKU is unique among non-deleted products (soft-deleted rows free up the SKU).
            e.HasIndex(x => x.Sku).IsUnique().HasFilter("[IsDeleted] = 0");
            e.HasIndex(x => x.Name);
            e.HasQueryFilter(x => !x.IsDeleted);
            e.ToTable(t => t.HasCheckConstraint("CK_Product_Stock", "[StockQuantity] >= 0"));
        });

        b.Entity<Customer>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.Phone).HasMaxLength(50);
            e.Property(x => x.Address).HasMaxLength(500);
            e.Property(x => x.TaxNumber).HasMaxLength(50);
            e.Property(x => x.Notes).HasMaxLength(1000);
            e.HasIndex(x => x.Name);
            e.HasQueryFilter(x => !x.IsDeleted);
        });

        b.Entity<Invoice>(e =>
        {
            e.HasIndex(x => x.InvoiceNumber).IsUnique();
            e.HasIndex(x => x.Date);
            e.Property(x => x.InvoiceNumber).HasMaxLength(50);
            e.Property(x => x.CustomerName).HasMaxLength(200);
            e.Property(x => x.CurrencyCode).HasMaxLength(10);
            e.Property(x => x.CurrencySymbol).HasMaxLength(10);
            e.Property(x => x.Notes).HasMaxLength(1000);
            e.Property(x => x.CancelReason).HasMaxLength(500);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.PaymentMethod).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.DiscountType).HasConversion<string>().HasMaxLength(20);
            foreach (var p in new[] { nameof(Invoice.Subtotal), nameof(Invoice.DiscountValue), nameof(Invoice.DiscountAmount),
                                      nameof(Invoice.TaxAmount), nameof(Invoice.Total) })
                e.Property(p).HasPrecision(18, 2);
            e.Property(x => x.TaxRate).HasPrecision(5, 2);
            // Customers/products are soft-deleted, so these relationships must never cascade.
            e.HasOne(x => x.Customer).WithMany(c => c.Invoices).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.Items).WithOne(i => i.Invoice).HasForeignKey(i => i.InvoiceId).OnDelete(DeleteBehavior.Cascade);
            e.Navigation(x => x.Customer).AutoInclude(false);
        });

        b.Entity<InvoiceItem>(e =>
        {
            e.Property(x => x.ProductName).HasMaxLength(200);
            e.Property(x => x.Sku).HasMaxLength(50);
            e.Property(x => x.UnitPrice).HasPrecision(18, 2);
            e.Property(x => x.DiscountPercent).HasPrecision(5, 2);
            e.Property(x => x.LineTotal).HasPrecision(18, 2);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
            // Matches the Product filter so required-navigation warnings do not appear.
            e.Navigation(x => x.Product).AutoInclude(false);
        });

        b.Entity<StockMovement>(e =>
        {
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Reference).HasMaxLength(100);
            e.Property(x => x.Note).HasMaxLength(500);
            e.HasIndex(x => new { x.ProductId, x.CreatedAt });
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<AppSettings>(e =>
        {
            e.ToTable("Settings");
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.BusinessName).HasMaxLength(200);
            e.Property(x => x.BusinessNameAr).HasMaxLength(200);
            e.Property(x => x.Address).HasMaxLength(500);
            e.Property(x => x.Phone).HasMaxLength(50);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.TaxNumber).HasMaxLength(50);
            e.Property(x => x.LogoContentType).HasMaxLength(100);
            e.Property(x => x.CurrencyCode).HasMaxLength(10);
            e.Property(x => x.CurrencySymbol).HasMaxLength(10);
            e.Property(x => x.TaxRate).HasPrecision(5, 2);
            e.Property(x => x.InvoicePrefix).HasMaxLength(20);
            e.Property(x => x.InvoiceFooter).HasMaxLength(1000);
        });
    }
}

namespace MiniErp.Api.Entities;

public enum UserRole { Admin = 1, Cashier = 2 }
public enum InvoiceStatus { Paid = 1, Cancelled = 2 }
public enum DiscountType { None = 0, Percent = 1, Fixed = 2 }
public enum PaymentMethod { Cash = 1, Card = 2, Transfer = 3 }
public enum StockMovementType { Initial = 1, Sale = 2, SaleCancellation = 3, Adjustment = 4 }

public class User
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
    public string Username { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
}

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Sku { get; set; } = "";
    public string? Category { get; set; }
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public decimal Cost { get; set; }
    public int StockQuantity { get; set; }
    public int LowStockThreshold { get; set; } = 10;
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public class Customer
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? TaxNumber { get; set; }
    public string? Notes { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public List<Invoice> Invoices { get; set; } = new();
}

public class Invoice
{
    public int Id { get; set; }
    public string InvoiceNumber { get; set; } = "";
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    /// <summary>Snapshot of the customer name so historical invoices never change.</summary>
    public string CustomerName { get; set; } = "";
    public int CreatedByUserId { get; set; }
    public User? CreatedBy { get; set; }
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Paid;
    public decimal Subtotal { get; set; }
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TaxRate { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal Total { get; set; }
    public string CurrencyCode { get; set; } = "USD";
    public string CurrencySymbol { get; set; } = "$";
    public string? Notes { get; set; }
    public DateTime? CancelledAt { get; set; }
    public int? CancelledByUserId { get; set; }
    public string? CancelReason { get; set; }
    public List<InvoiceItem> Items { get; set; } = new();
}

public class InvoiceItem
{
    public int Id { get; set; }
    public int InvoiceId { get; set; }
    public Invoice? Invoice { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    // Snapshots: historical values preserved even if the product changes later.
    public string ProductName { get; set; } = "";
    public string Sku { get; set; } = "";
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal LineTotal { get; set; }
}

public class StockMovement
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public StockMovementType Type { get; set; }
    /// <summary>Signed quantity change (negative when stock leaves).</summary>
    public int QuantityChange { get; set; }
    public int BalanceAfter { get; set; }
    public string? Reference { get; set; }
    public string? Note { get; set; }
    public int? UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AppSettings
{
    public int Id { get; set; } = 1;
    public string BusinessName { get; set; } = "My Business";
    public string? BusinessNameAr { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? TaxNumber { get; set; }
    public byte[]? Logo { get; set; }
    public string? LogoContentType { get; set; }
    public DateTime? LogoUpdatedAt { get; set; }
    public string CurrencyCode { get; set; } = "USD";
    public string CurrencySymbol { get; set; } = "$";
    public bool TaxEnabled { get; set; } = true;
    public decimal TaxRate { get; set; } = 15;
    public string InvoicePrefix { get; set; } = "INV-";
    public int NextInvoiceNumber { get; set; } = 1;
    public string? InvoiceFooter { get; set; }
}

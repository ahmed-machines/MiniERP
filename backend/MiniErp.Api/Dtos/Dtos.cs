using System.ComponentModel.DataAnnotations;
using MiniErp.Api.Entities;

namespace MiniErp.Api.Dtos;

// NOTE: ErrorMessage values are stable error codes ("required", "maxLength", ...) that the
// Angular client translates into the active language.

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

// ---------- Auth / Users ----------
public class LoginRequest
{
    [Required(ErrorMessage = "required")] public string Username { get; set; } = "";
    [Required(ErrorMessage = "required")] public string Password { get; set; } = "";
}
public record UserInfo(int Id, string FullName, string Username, string Email, string Role, bool IsActive);
public record LoginResponse(string Token, DateTime ExpiresAt, UserInfo User);
public class ChangePasswordRequest
{
    [Required(ErrorMessage = "required")] public string CurrentPassword { get; set; } = "";
    [Required(ErrorMessage = "required"), MinLength(8, ErrorMessage = "minLength")] public string NewPassword { get; set; } = "";
}
public class UserSaveRequest
{
    [Required(ErrorMessage = "required"), StringLength(150, ErrorMessage = "maxLength")] public string FullName { get; set; } = "";
    [Required(ErrorMessage = "required"), StringLength(50, MinimumLength = 3, ErrorMessage = "length")]
    [RegularExpression(@"^[A-Za-z0-9._-]+$", ErrorMessage = "pattern")] public string Username { get; set; } = "";
    [Required(ErrorMessage = "required"), EmailAddress(ErrorMessage = "email"), StringLength(200, ErrorMessage = "maxLength")] public string Email { get; set; } = "";
    [Required(ErrorMessage = "required")] public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    /// <summary>Required on create; optional on update (blank keeps the current password).</summary>
    [MinLength(8, ErrorMessage = "minLength")] public string? Password { get; set; }
}

// ---------- Products ----------
public record ProductDto(int Id, string Name, string Sku, string? Category, string? Description, decimal Price, decimal Cost,
    int StockQuantity, int LowStockThreshold, bool IsActive, bool IsLowStock, DateTime CreatedAt);
public class ProductSaveRequest
{
    [Required(ErrorMessage = "required"), StringLength(200, ErrorMessage = "maxLength")] public string Name { get; set; } = "";
    [Required(ErrorMessage = "required"), StringLength(50, ErrorMessage = "maxLength")] public string Sku { get; set; } = "";
    [StringLength(100, ErrorMessage = "maxLength")] public string? Category { get; set; }
    [StringLength(2000, ErrorMessage = "maxLength")] public string? Description { get; set; }
    [Range(0, 1_000_000_000, ErrorMessage = "range")] public decimal Price { get; set; }
    [Range(0, 1_000_000_000, ErrorMessage = "range")] public decimal Cost { get; set; }
    [Range(0, 100_000_000, ErrorMessage = "range")] public int StockQuantity { get; set; }
    [Range(0, 100_000_000, ErrorMessage = "range")] public int LowStockThreshold { get; set; } = 10;
    public bool IsActive { get; set; } = true;
}
public class StockAdjustRequest
{
    /// <summary>Signed change; negative removes stock.</summary>
    [Range(-100_000_000, 100_000_000, ErrorMessage = "range")] public int Change { get; set; }
    [StringLength(500, ErrorMessage = "maxLength")] public string? Note { get; set; }
}
public record StockMovementDto(int Id, string Type, int QuantityChange, int BalanceAfter, string? Reference, string? Note, DateTime CreatedAt);

// ---------- Customers ----------
public record CustomerDto(int Id, string Name, string? Email, string? Phone, string? Address, string? TaxNumber, string? Notes,
    DateTime CreatedAt, int InvoiceCount, decimal TotalPurchases);
public class CustomerSaveRequest
{
    [Required(ErrorMessage = "required"), StringLength(200, ErrorMessage = "maxLength")] public string Name { get; set; } = "";
    [EmailAddress(ErrorMessage = "email"), StringLength(200, ErrorMessage = "maxLength")] public string? Email { get; set; }
    [StringLength(50, ErrorMessage = "maxLength")] public string? Phone { get; set; }
    [StringLength(500, ErrorMessage = "maxLength")] public string? Address { get; set; }
    [StringLength(50, ErrorMessage = "maxLength")] public string? TaxNumber { get; set; }
    [StringLength(1000, ErrorMessage = "maxLength")] public string? Notes { get; set; }
}
public record CustomerDetailDto(CustomerDto Customer, IReadOnlyList<InvoiceSummaryDto> Invoices);

// ---------- Invoices ----------
public class InvoiceItemRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "required")] public int ProductId { get; set; }
    [Range(1, 1_000_000, ErrorMessage = "range")] public int Quantity { get; set; }
    [Range(0, 100, ErrorMessage = "range")] public decimal DiscountPercent { get; set; }
}
public class InvoiceCreateRequest
{
    public int? CustomerId { get; set; }
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;
    public DiscountType DiscountType { get; set; } = DiscountType.None;
    [Range(0, 1_000_000_000, ErrorMessage = "range")] public decimal DiscountValue { get; set; }
    [StringLength(1000, ErrorMessage = "maxLength")] public string? Notes { get; set; }
    [Required(ErrorMessage = "required"), MinLength(1, ErrorMessage = "itemsRequired")] public List<InvoiceItemRequest> Items { get; set; } = new();
}
public class InvoiceCancelRequest
{
    [StringLength(500, ErrorMessage = "maxLength")] public string? Reason { get; set; }
}
public record InvoiceSummaryDto(int Id, string InvoiceNumber, DateTime Date, int? CustomerId, string CustomerName, string Status,
    string PaymentMethod, decimal Total, string CurrencySymbol);
public record InvoiceItemDto(int Id, int ProductId, string ProductName, string Sku, decimal UnitPrice, int Quantity,
    decimal DiscountPercent, decimal LineTotal);
public record InvoiceDetailDto(int Id, string InvoiceNumber, DateTime Date, int? CustomerId, string CustomerName, string? CustomerAddress,
    string? CustomerPhone, string? CustomerTaxNumber, string CreatedBy, string Status, string PaymentMethod, decimal Subtotal,
    string DiscountType, decimal DiscountValue, decimal DiscountAmount, decimal TaxRate, decimal TaxAmount, decimal Total,
    string CurrencyCode, string CurrencySymbol, string? Notes, DateTime? CancelledAt, string? CancelReason,
    IReadOnlyList<InvoiceItemDto> Items);

// ---------- Settings ----------
public record SettingsDto(string BusinessName, string? BusinessNameAr, string? Address, string? Phone, string? Email, string? TaxNumber,
    bool HasLogo, DateTime? LogoUpdatedAt, string CurrencyCode, string CurrencySymbol, bool TaxEnabled, decimal TaxRate,
    string InvoicePrefix, int NextInvoiceNumber, string? InvoiceFooter);
public class SettingsSaveRequest
{
    [Required(ErrorMessage = "required"), StringLength(200, ErrorMessage = "maxLength")] public string BusinessName { get; set; } = "";
    [StringLength(200, ErrorMessage = "maxLength")] public string? BusinessNameAr { get; set; }
    [StringLength(500, ErrorMessage = "maxLength")] public string? Address { get; set; }
    [StringLength(50, ErrorMessage = "maxLength")] public string? Phone { get; set; }
    [EmailAddress(ErrorMessage = "email"), StringLength(200, ErrorMessage = "maxLength")] public string? Email { get; set; }
    [StringLength(50, ErrorMessage = "maxLength")] public string? TaxNumber { get; set; }
    [Required(ErrorMessage = "required"), StringLength(10, ErrorMessage = "maxLength")] public string CurrencyCode { get; set; } = "USD";
    [Required(ErrorMessage = "required"), StringLength(10, ErrorMessage = "maxLength")] public string CurrencySymbol { get; set; } = "$";
    public bool TaxEnabled { get; set; }
    [Range(0, 100, ErrorMessage = "range")] public decimal TaxRate { get; set; }
    [Required(ErrorMessage = "required"), StringLength(20, ErrorMessage = "maxLength")] public string InvoicePrefix { get; set; } = "INV-";
    [Range(1, int.MaxValue, ErrorMessage = "range")] public int NextInvoiceNumber { get; set; } = 1;
    [StringLength(1000, ErrorMessage = "maxLength")] public string? InvoiceFooter { get; set; }
}

// ---------- Dashboard ----------
public record DailySalesDto(DateTime Date, decimal Total, int Invoices);
public record TopProductDto(int ProductId, string Name, int Quantity, decimal Revenue);
public record LowStockDto(int Id, string Name, string Sku, int StockQuantity, int LowStockThreshold);
public record DashboardDto(decimal TotalSales, decimal TodaySales, int InvoiceCount, int CancelledCount, int ProductCount,
    int CustomerCount, int LowStockCount, string CurrencySymbol, IReadOnlyList<LowStockDto> LowStock,
    IReadOnlyList<InvoiceSummaryDto> RecentInvoices, IReadOnlyList<DailySalesDto> SalesLast30Days,
    IReadOnlyList<TopProductDto> TopProducts);

using MiniErp.Api.Entities;

namespace MiniErp.Api.Services;

public record CalcLine(decimal UnitPrice, int Quantity, decimal DiscountPercent);
public record CalcLineResult(decimal LineTotal);
public record InvoiceTotals(IReadOnlyList<decimal> LineTotals, decimal Subtotal, decimal DiscountAmount, decimal TaxableAmount,
    decimal TaxAmount, decimal Total);

/// <summary>
/// Pure, side-effect-free financial calculation. The server is the single source of truth for all amounts.
/// Order of operations: line discount -> subtotal -> invoice discount -> tax on the discounted amount -> total.
/// All amounts are rounded to 2 decimals (away from zero) at every monetary step.
/// </summary>
public static class InvoiceCalculator
{
    public static decimal Round(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    public static InvoiceTotals Calculate(IEnumerable<CalcLine> lines, DiscountType discountType, decimal discountValue, decimal taxRate)
    {
        var lineTotals = lines
            .Select(l => Round(l.UnitPrice * l.Quantity * (1 - l.DiscountPercent / 100m)))
            .ToList();
        var subtotal = Round(lineTotals.Sum());

        var discount = discountType switch
        {
            DiscountType.Percent => Round(subtotal * Math.Min(discountValue, 100m) / 100m),
            DiscountType.Fixed => Round(Math.Min(discountValue, subtotal)),
            _ => 0m
        };

        var taxable = subtotal - discount;
        var tax = Round(taxable * taxRate / 100m);
        return new InvoiceTotals(lineTotals, subtotal, discount, taxable, tax, taxable + tax);
    }
}

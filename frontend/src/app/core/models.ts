export type Role = 'Admin' | 'Cashier';
export type InvoiceStatus = 'Paid' | 'Cancelled';
export type DiscountType = 'None' | 'Percent' | 'Fixed';
export type PaymentMethod = 'Cash' | 'Card' | 'Transfer';

export interface PagedResult<T> { items: T[]; total: number; page: number; pageSize: number; }

export interface UserInfo { id: number; fullName: string; username: string; email: string; role: Role; isActive: boolean; }
export interface LoginResponse { token: string; expiresAt: string; user: UserInfo; }
export interface UserSave { fullName: string; username: string; email: string; role: Role; isActive: boolean; password?: string | null; }

export interface Product {
  id: number; name: string; sku: string; category: string | null; description: string | null; price: number; cost: number;
  stockQuantity: number; lowStockThreshold: number; isActive: boolean; isLowStock: boolean; createdAt: string;
}
export interface ProductSave {
  name: string; sku: string; category: string | null; description: string | null; price: number; cost: number;
  stockQuantity: number; lowStockThreshold: number; isActive: boolean;
}
export interface StockMovement {
  id: number; type: string; quantityChange: number; balanceAfter: number; reference: string | null; note: string | null; createdAt: string;
}

export interface Customer {
  id: number; name: string; email: string | null; phone: string | null; address: string | null; taxNumber: string | null;
  notes: string | null; createdAt: string; invoiceCount: number; totalPurchases: number;
}
export interface CustomerSave { name: string; email: string | null; phone: string | null; address: string | null; taxNumber: string | null; notes: string | null; }
export interface CustomerDetail { customer: Customer; invoices: InvoiceSummary[]; }

export interface InvoiceSummary {
  id: number; invoiceNumber: string; date: string; customerId: number | null; customerName: string; status: InvoiceStatus;
  paymentMethod: PaymentMethod; total: number; currencySymbol: string;
}
export interface InvoiceItem { id: number; productId: number; productName: string; sku: string; unitPrice: number; quantity: number; discountPercent: number; lineTotal: number; }
export interface InvoiceDetail {
  id: number; invoiceNumber: string; date: string; customerId: number | null; customerName: string; customerAddress: string | null;
  customerPhone: string | null; customerTaxNumber: string | null; createdBy: string; status: InvoiceStatus; paymentMethod: PaymentMethod;
  subtotal: number; discountType: DiscountType; discountValue: number; discountAmount: number; taxRate: number; taxAmount: number;
  total: number; currencyCode: string; currencySymbol: string; notes: string | null; cancelledAt: string | null; cancelReason: string | null;
  items: InvoiceItem[];
}
export interface InvoiceCreate {
  customerId: number | null; paymentMethod: PaymentMethod; discountType: DiscountType; discountValue: number; notes: string | null;
  items: { productId: number; quantity: number; discountPercent: number }[];
}
export interface InvoicePreview { lineTotals: number[]; subtotal: number; discountAmount: number; taxRate: number; taxAmount: number; total: number; }

export interface Settings {
  businessName: string; businessNameAr: string | null; address: string | null; phone: string | null; email: string | null;
  taxNumber: string | null; hasLogo: boolean; logoUpdatedAt: string | null; currencyCode: string; currencySymbol: string;
  taxEnabled: boolean; taxRate: number; invoicePrefix: string; nextInvoiceNumber: number; invoiceFooter: string | null;
}

export interface PublicSettings {
  businessName: string; businessNameAr: string | null; hasLogo: boolean; logoUpdatedAt: string | null;
}

export interface Dashboard {
  totalSales: number; todaySales: number; invoiceCount: number; cancelledCount: number; productCount: number; customerCount: number;
  lowStockCount: number; currencySymbol: string;
  lowStock: { id: number; name: string; sku: string; stockQuantity: number; lowStockThreshold: number }[];
  recentInvoices: InvoiceSummary[];
  salesLast30Days: { date: string; total: number; invoices: number }[];
  topProducts: { productId: number; name: string; quantity: number; revenue: number }[];
}

export interface ApiError { status: number; code: string; args?: Record<string, unknown>; errors?: Record<string, string[]>; }

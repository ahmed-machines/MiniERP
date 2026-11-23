import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import * as M from './models';

type Query = Record<string, string | number | boolean | null | undefined>;

function params(q?: Query): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(q ?? {})) if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  return p;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  get logoUrl() { return `${this.base}/settings/logo`; }

  // auth
  login(username: string, password: string) { return this.http.post<M.LoginResponse>(`${this.base}/auth/login`, { username, password }); }
  me() { return this.http.get<M.UserInfo>(`${this.base}/auth/me`); }
  changePassword(currentPassword: string, newPassword: string) { return this.http.post<void>(`${this.base}/auth/change-password`, { currentPassword, newPassword }); }

  // users
  users() { return this.http.get<M.UserInfo[]>(`${this.base}/users`); }
  createUser(u: M.UserSave) { return this.http.post<M.UserInfo>(`${this.base}/users`, u); }
  updateUser(id: number, u: M.UserSave) { return this.http.put<M.UserInfo>(`${this.base}/users/${id}`, u); }

  // products
  products(q: Query) { return this.http.get<M.PagedResult<M.Product>>(`${this.base}/products`, { params: params(q) }); }
  categories() { return this.http.get<string[]>(`${this.base}/products/categories`); }
  createProduct(p: M.ProductSave) { return this.http.post<M.Product>(`${this.base}/products`, p); }
  updateProduct(id: number, p: M.ProductSave) { return this.http.put<M.Product>(`${this.base}/products/${id}`, p); }
  deleteProduct(id: number) { return this.http.delete<void>(`${this.base}/products/${id}`); }
  adjustStock(id: number, change: number, note: string | null) { return this.http.post<M.Product>(`${this.base}/products/${id}/adjust-stock`, { change, note }); }
  movements(id: number) { return this.http.get<M.StockMovement[]>(`${this.base}/products/${id}/movements`); }

  // customers
  customers(q: Query) { return this.http.get<M.PagedResult<M.Customer>>(`${this.base}/customers`, { params: params(q) }); }
  customer(id: number) { return this.http.get<M.CustomerDetail>(`${this.base}/customers/${id}`); }
  createCustomer(c: M.CustomerSave) { return this.http.post<M.Customer>(`${this.base}/customers`, c); }
  updateCustomer(id: number, c: M.CustomerSave) { return this.http.put<M.Customer>(`${this.base}/customers/${id}`, c); }
  deleteCustomer(id: number) { return this.http.delete<void>(`${this.base}/customers/${id}`); }

  // invoices
  invoices(q: Query) { return this.http.get<M.PagedResult<M.InvoiceSummary>>(`${this.base}/invoices`, { params: params(q) }); }
  invoice(id: number) { return this.http.get<M.InvoiceDetail>(`${this.base}/invoices/${id}`); }
  createInvoice(i: M.InvoiceCreate) { return this.http.post<M.InvoiceDetail>(`${this.base}/invoices`, i); }
  previewInvoice(i: M.InvoiceCreate) { return this.http.post<M.InvoicePreview>(`${this.base}/invoices/preview`, i); }
  cancelInvoice(id: number, reason: string | null) { return this.http.post<M.InvoiceDetail>(`${this.base}/invoices/${id}/cancel`, { reason }); }

  // settings & dashboard
  publicSettings() { return this.http.get<M.PublicSettings>(`${this.base}/settings/public`); }
  settings() { return this.http.get<M.Settings>(`${this.base}/settings`); }
  saveSettings(s: Partial<M.Settings>) { return this.http.put<M.Settings>(`${this.base}/settings`, s); }
  uploadLogo(file: File) { const f = new FormData(); f.append('file', file); return this.http.post<M.Settings>(`${this.base}/settings/logo`, f); }
  deleteLogo() { return this.http.delete<M.Settings>(`${this.base}/settings/logo`); }
  dashboard() { return this.http.get<M.Dashboard>(`${this.base}/dashboard`); }
}

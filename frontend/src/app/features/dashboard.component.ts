import { Component, ElementRef, OnDestroy, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../core/api.service';
import { I18nService } from '../core/i18n/i18n.service';
import { LocalDatePipe, MoneyPipe, NumberPipe, TranslatePipe } from '../core/i18n/pipes';
import { Dashboard } from '../core/models';
import { ToastService } from '../core/toast.service';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, TranslatePipe, MoneyPipe, LocalDatePipe, NumberPipe],
  template: `
    <div class="page-header">
      <div><h1>{{ 'dash.title' | t }}</h1><p>{{ 'dash.subtitle' | t }}</p></div>
      <a class="btn btn-primary" routerLink="/invoices/new"><i class="bi bi-plus-lg me-1"></i>{{ 'nav.newInvoice' | t }}</a>
    </div>

    @if (!d()) {
      <div class="spinner-wrap"><div class="spinner-border text-primary"></div></div>
    } @else {
      @let x = d()!;
      <div class="row g-3 mb-3">
        <div class="col-12 col-sm-6 col-xl-3"><div class="card-x kpi i-indigo"><div class="kpi-icon"><i class="bi bi-cash-stack"></i></div>
          <div><div class="kpi-label">{{ 'dash.totalSales' | t }}</div><div class="kpi-value">{{ x.totalSales | money: x.currencySymbol }}</div>
          <small>{{ 'dash.todaySales' | t: { amount: (x.todaySales | money: x.currencySymbol) } }}</small></div></div></div>
        <div class="col-12 col-sm-6 col-xl-3"><div class="card-x kpi i-green"><div class="kpi-icon"><i class="bi bi-receipt"></i></div>
          <div><div class="kpi-label">{{ 'dash.invoices' | t }}</div><div class="kpi-value">{{ x.invoiceCount | num }}</div>
          <small>{{ 'dash.cancelled' | t: { n: x.cancelledCount } }}</small></div></div></div>
        <div class="col-12 col-sm-6 col-xl-3"><div class="card-x kpi i-sky"><div class="kpi-icon"><i class="bi bi-box-seam"></i></div>
          <div><div class="kpi-label">{{ 'dash.products' | t }}</div><div class="kpi-value">{{ x.productCount | num }}</div>
          <small>{{ x.customerCount | num }} {{ 'dash.customers' | t }}</small></div></div></div>
        <div class="col-12 col-sm-6 col-xl-3"><a routerLink="/products" [queryParams]="{ status: 'low' }" class="text-decoration-none text-reset"><div class="card-x kpi i-rose"><div class="kpi-icon"><i class="bi bi-exclamation-triangle"></i></div>
          <div><div class="kpi-label">{{ 'dash.lowStock' | t }}</div><div class="kpi-value">{{ x.lowStockCount | num }}</div>
          <small>{{ 'dash.lowStockItems' | t }}</small></div></div></a></div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-xl-8"><div class="card-x h-100">
          <div class="card-x-header"><h6>{{ 'dash.salesChart' | t }}</h6></div>
          <div class="card-x-body"><div class="chart-box"><canvas #salesCanvas></canvas></div></div>
        </div></div>
        <div class="col-12 col-xl-4"><div class="card-x h-100">
          <div class="card-x-header"><h6>{{ 'dash.topProducts' | t }}</h6></div>
          <div class="card-x-body">
            @if (x.topProducts.length === 0) { <div class="empty"><i class="bi bi-bar-chart"></i>{{ 'dash.noSales' | t }}</div> }
            @else { <div class="chart-box"><canvas #topCanvas></canvas></div> }
          </div>
        </div></div>
      </div>

      <div class="row g-3">
        <div class="col-12 col-xl-7"><div class="card-x h-100">
          <div class="card-x-header"><h6>{{ 'dash.recentInvoices' | t }}</h6><a routerLink="/invoices" class="small">{{ 'dash.viewAll' | t }}</a></div>
          <div class="table-responsive"><table class="table table-x">
            <thead><tr><th>{{ 'inv.number' | t }}</th><th>{{ 'inv.customer' | t }}</th><th>{{ 'common.date' | t }}</th><th>{{ 'common.status' | t }}</th><th class="text-end-x">{{ 'common.total' | t }}</th></tr></thead>
            <tbody>
              @for (i of x.recentInvoices; track i.id) {
                <tr>
                  <td><a [routerLink]="['/invoices', i.id]" class="fw-semibold text-decoration-none">{{ i.invoiceNumber }}</a></td>
                  <td>{{ i.customerName || ('common.walkIn' | t) }}</td>
                  <td>{{ i.date | ldate }}</td>
                  <td><span class="badge" [class]="i.status === 'Paid' ? 'b-soft-success' : 'b-soft-danger'">{{ 'status.' + i.status | t }}</span></td>
                  <td class="text-end-x fw-semibold">{{ i.total | money: i.currencySymbol }}</td>
                </tr>
              } @empty { <tr><td colspan="5"><div class="empty">{{ 'common.noData' | t }}</div></td></tr> }
            </tbody></table></div>
        </div></div>
        <div class="col-12 col-xl-5"><div class="card-x h-100">
          <div class="card-x-header"><h6>{{ 'dash.lowStockAlerts' | t }}</h6><a routerLink="/products" [queryParams]="{ status: 'low' }" class="small">{{ 'dash.viewAll' | t }}</a></div>
          <div>
            @for (p of x.lowStock; track p.id) {
              <div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
                <div><div class="fw-semibold">{{ p.name }}</div><small class="text-muted mono">{{ p.sku }}</small></div>
                <div class="text-end"><span class="badge" [class]="p.stockQuantity === 0 ? 'b-soft-danger' : 'b-soft-warning'">{{ 'dash.units' | t: { n: p.stockQuantity } }}</span>
                  <div><small class="text-muted">{{ 'dash.threshold' | t: { n: p.lowStockThreshold } }}</small></div></div>
              </div>
            } @empty { <div class="empty">{{ 'dash.allGood' | t }}</div> }
          </div>
        </div></div>
      </div>
    }
  `
})
export class DashboardComponent implements OnDestroy {
  private api = inject(ApiService);
  private i18n = inject(I18nService);
  private toast = inject(ToastService);
  d = signal<Dashboard | null>(null);
  private salesCanvas = viewChild<ElementRef<HTMLCanvasElement>>('salesCanvas');
  private topCanvas = viewChild<ElementRef<HTMLCanvasElement>>('topCanvas');
  private charts: Chart[] = [];

  constructor() {
    this.api.dashboard().subscribe({ next: (d) => this.d.set(d), error: (e) => this.toast.httpError(e) });
    // Re-render charts when data, canvases or language change (labels, number formats and axis direction).
    effect(() => {
      const d = this.d(), s = this.salesCanvas(), t = this.topCanvas();
      this.i18n.lang();
      if (d && s) this.render(d, s.nativeElement, t?.nativeElement);
    });
  }

  private render(d: Dashboard, sales: HTMLCanvasElement, top?: HTMLCanvasElement) {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
    const loc = this.i18n.locale();
    const rtl = this.i18n.isRtl();
    const fmt = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
    const moneyFmt = new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const moneyStr = (v: number) => rtl ? `${moneyFmt.format(v)} ${d.currencySymbol}` : `${d.currencySymbol}${moneyFmt.format(v)}`;
    const day = new Intl.DateTimeFormat(loc, { month: 'short', day: 'numeric' });
    const font = { family: rtl ? 'Cairo' : 'Inter' };

    const g = sales.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, 'rgba(79,70,229,0.35)'); grad.addColorStop(1, 'rgba(79,70,229,0.02)');
    const series = rtl ? [...d.salesLast30Days].reverse() : d.salesLast30Days; // keep time flowing in reading direction
    const toUtc = (iso: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + 'Z');
    this.charts.push(new Chart(sales, {
      type: 'line',
      data: {
        labels: series.map((p) => day.format(toUtc(p.date))),
        datasets: [{ label: this.i18n.t('dash.sales'), data: series.map((p) => p.total), borderColor: '#4f46e5', backgroundColor: grad, fill: true, tension: 0.35, pointRadius: 2, pointHoverRadius: 5 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { rtl, textDirection: rtl ? 'rtl' : 'ltr', bodyFont: font, titleFont: font, callbacks: { label: (c) => ` ${moneyStr(c.parsed.y ?? 0)}` } } },
        scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font } }, y: { beginAtZero: true, position: rtl ? 'right' : 'left', ticks: { callback: (v) => fmt.format(+v), font }, grid: { color: '#eef1f7' } } }
      }
    }));
    if (top && d.topProducts.length) {
      this.charts.push(new Chart(top, {
        type: 'doughnut',
        data: { labels: d.topProducts.map((p) => p.name), datasets: [{ data: d.topProducts.map((p) => p.revenue), backgroundColor: ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', rtl, labels: { font, boxWidth: 10, usePointStyle: true } }, tooltip: { rtl, bodyFont: font, callbacks: { label: (c) => ` ${c.label}: ${moneyStr(c.parsed)}` } } } }
      }));
    }
  }

  ngOnDestroy() { this.charts.forEach((c) => c.destroy()); }
}

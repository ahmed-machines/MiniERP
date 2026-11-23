import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TranslatePipe } from '../core/i18n/pipes';
import { Role, UserInfo } from '../core/models';
import { ToastService } from '../core/toast.service';
import { ErrComponent, ModalComponent } from '../shared/components';

@Component({
  selector: 'app-users',
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, ErrComponent],
  template: `
    <div class="page-header">
      <div><h1>{{ 'users.title' | t }}</h1><p>{{ 'users.subtitle' | t }}</p></div>
      <button class="btn btn-primary" (click)="open(null)"><i class="bi bi-plus-lg me-1"></i>{{ 'users.new' | t }}</button>
    </div>
    <div class="card-x"><div class="table-responsive"><table class="table table-x">
      <thead><tr><th>{{ 'users.fullName' | t }}</th><th>{{ 'auth.username' | t }}</th><th>{{ 'common.email' | t }}</th><th>{{ 'users.role' | t }}</th><th>{{ 'common.status' | t }}</th><th class="text-end-x">{{ 'common.actions' | t }}</th></tr></thead>
      <tbody>
        @for (u of users(); track u.id) {
          <tr>
            <td class="fw-semibold">{{ u.fullName }} @if (u.id === auth.user()?.id) { <span class="badge b-soft-primary">{{ 'users.you' | t }}</span> }</td>
            <td class="mono">{{ u.username }}</td><td>{{ u.email }}</td>
            <td><span class="badge" [class]="u.role === 'Admin' ? 'b-soft-primary' : 'b-soft-info'">{{ 'role.' + u.role | t }}</span></td>
            <td><span class="badge" [class]="u.isActive ? 'b-soft-success' : 'b-soft-secondary'">{{ (u.isActive ? 'common.active' : 'common.inactive') | t }}</span></td>
            <td class="text-end-x"><button class="btn btn-light btn-icon" (click)="open(u)"><i class="bi bi-pencil"></i></button></td>
          </tr>
        } @empty { <tr><td colspan="6"><div class="empty">{{ 'common.noData' | t }}</div></td></tr> }
      </tbody></table></div></div>

    @if (formOpen()) {
      <app-modal [title]="(editing() ? 'users.edit' : 'users.new') | t" (closed)="formOpen.set(false)">
        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          <div class="modal-body"><div class="row g-3">
            <div class="col-12"><label class="form-label">{{ 'users.fullName' | t }} *</label><input class="form-control" formControlName="fullName" /><app-err [c]="form.controls.fullName" /></div>
            <div class="col-md-6"><label class="form-label">{{ 'auth.username' | t }} *</label><input class="form-control" formControlName="username" autocomplete="off" /><app-err [c]="form.controls.username" /></div>
            <div class="col-md-6"><label class="form-label">{{ 'common.email' | t }} *</label><input class="form-control" type="email" formControlName="email" /><app-err [c]="form.controls.email" /></div>
            <div class="col-md-6"><label class="form-label">{{ 'users.role' | t }}</label>
              <select class="form-select" formControlName="role"><option value="Admin">{{ 'role.Admin' | t }}</option><option value="Cashier">{{ 'role.Cashier' | t }}</option></select></div>
            <div class="col-md-6 d-flex align-items-end"><div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="ua" formControlName="isActive" /><label class="form-check-label" for="ua">{{ 'common.active' | t }}</label></div></div>
            <div class="col-12"><label class="form-label">{{ 'users.password' | t }} @if (!editing()) { * }</label>
              <input class="form-control" type="password" formControlName="password" autocomplete="new-password" />
              @if (editing()) { <div class="form-text">{{ 'users.passwordHint' | t }}</div> }
              <app-err [c]="form.controls.password" /></div>
          </div></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-light" (click)="formOpen.set(false)">{{ 'common.cancel' | t }}</button>
            <button class="btn btn-primary" [disabled]="saving()">{{ (saving() ? 'common.saving' : 'common.save') | t }}</button>
          </div>
        </form>
      </app-modal>
    }
  `
})
export class UsersComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  users = signal<UserInfo[]>([]);
  formOpen = signal(false); editing = signal<UserInfo | null>(null); saving = signal(false);
  form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50), Validators.pattern(/^[A-Za-z0-9._-]+$/)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['Cashier' as Role],
    isActive: [true],
    password: ['']
  });

  ngOnInit() { this.load(); }
  load() { this.api.users().subscribe({ next: (u) => this.users.set(u), error: (e) => this.toast.httpError(e) }); }
  open(u: UserInfo | null) {
    this.editing.set(u);
    this.form.reset({ fullName: u?.fullName ?? '', username: u?.username ?? '', email: u?.email ?? '', role: u?.role ?? 'Cashier', isActive: u?.isActive ?? true, password: '' });
    const pw = this.form.controls.password;
    pw.setValidators(u ? [Validators.minLength(8)] : [Validators.required, Validators.minLength(8)]);
    pw.updateValueAndValidity();
    this.formOpen.set(true);
  }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const body = { ...v, password: v.password || null };
    const e = this.editing();
    this.saving.set(true);
    (e ? this.api.updateUser(e.id, body) : this.api.createUser(body)).subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.toast.success('users.saved'); this.load(); },
      error: (err) => { this.saving.set(false); this.toast.httpError(err); }
    });
  }
}

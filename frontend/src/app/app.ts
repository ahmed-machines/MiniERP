import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { I18nService } from './core/i18n/i18n.service';
import { ConfirmHostComponent, ToastsComponent } from './shared/components';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastsComponent, ConfirmHostComponent],
  template: `<router-outlet /><app-toasts /><app-confirm />`
})
export class App {
  // Injecting the service at the root applies saved language/direction before first render.
  private i18n = inject(I18nService);
}

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../core/i18n/pipes';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, TranslatePipe],
  template: `<div class="empty card-x py-5"><i class="bi bi-compass"></i><h4>{{ 'common.pageNotFound' | t }}</h4><p>{{ 'common.pageNotFoundText' | t }}</p><a routerLink="/dashboard" class="btn btn-primary">{{ 'common.goHome' | t }}</a></div>`
})
export class NotFoundComponent {}

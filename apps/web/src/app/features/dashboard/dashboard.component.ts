import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <main style="padding: 32px">
      <h1>Welcome to Gusto</h1>
      <p>Signed in as {{ auth.user()?.phone }} ({{ auth.user()?.roles?.join(', ') }})</p>
      <p>Chef onboarding &amp; order management land here in Phase 1+.</p>
      <button (click)="logout()">Sign out</button>
    </main>
  `,
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}

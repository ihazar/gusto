import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  template: `
    <main class="wrap">
      <div class="brand"><span class="logo">🍳</span><span class="word">Gusto</span></div>
      <h1>Coming soon</h1>
      <p class="lede">
        You're on the list. We're cooking up something great — home-chefs near you, very soon.
      </p>
      <p class="who">Signed in as <strong>{{ auth.user()?.phone }}</strong></p>
      <button (click)="signOut()">Sign out</button>
    </main>
  `,
  styles: [
    `
      .wrap {
        min-height: 100vh; display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 14px; text-align: center; padding: 24px;
        background:
          radial-gradient(900px 500px at 50% 0%, #ffe9d6 0%, transparent 60%), #faf7f2;
      }
      .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
      .logo { font-size: 30px; }
      .word { font-size: 26px; font-weight: 800; color: var(--gusto); }
      h1 { font-size: clamp(40px, 8vw, 76px); margin: 0; letter-spacing: -2px; color: #1d1b16; }
      .lede { font-size: 18px; color: #6b6457; max-width: 460px; margin: 0; }
      .who { color: #8a8275; font-size: 14px; margin-top: 8px; }
      button {
        margin-top: 8px; padding: 11px 20px; border: 1px solid #e3ddd2; border-radius: 12px;
        background: #fff; color: #6b6457; font-weight: 600; cursor: pointer;
      }
    `,
  ],
})
export class ComingSoonComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async signOut(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/']);
  }
}

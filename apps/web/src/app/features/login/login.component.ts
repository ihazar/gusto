import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

type Step = 'phone' | 'code';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="card">
      <h1>Hearth</h1>
      <p class="sub">Chef &amp; ops portal</p>

      @if (step() === 'phone') {
        <label for="phone">Phone number</label>
        <input id="phone" name="phone" [(ngModel)]="phone" placeholder="+14155552671" />
        <button [disabled]="busy()" (click)="sendCode()">Send code</button>
      } @else {
        <label for="code">Enter the 6-digit code sent to {{ phone }}</label>
        <input id="code" name="code" [(ngModel)]="code" inputmode="numeric" maxlength="6" />
        <button [disabled]="busy()" (click)="verify()">Verify &amp; sign in</button>
        <button class="link" (click)="step.set('phone')">Use a different number</button>
      }

      @if (error()) { <p class="error">{{ error() }}</p> }
    </main>
  `,
  styles: [
    `
      .card { max-width: 340px; margin: 12vh auto; display: flex; flex-direction: column; gap: 10px; padding: 28px; background: #fff; border-radius: 16px; box-shadow: 0 6px 30px rgba(0,0,0,.08); }
      h1 { color: var(--hearth); margin: 0; }
      .sub { margin: 0 0 12px; color: #6b6457; }
      input { padding: 10px 12px; border: 1px solid #ddd; border-radius: 10px; font-size: 16px; }
      button { padding: 11px; border: 0; border-radius: 10px; background: var(--hearth); color: #fff; font-weight: 600; cursor: pointer; }
      button.link { background: none; color: #6b6457; font-weight: 400; }
      .error { color: #b3261e; }
    `,
  ],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  step = signal<Step>('phone');
  busy = signal(false);
  error = signal<string | null>(null);
  phone = '';
  code = '';

  async sendCode(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      await this.auth.requestOtp(this.phone.trim());
      this.step.set('code');
    } catch {
      this.error.set('Could not send a code. Check the number and try again.');
    } finally {
      this.busy.set(false);
    }
  }

  async verify(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      await this.auth.verifyOtp(this.phone.trim(), this.code.trim());
      await this.router.navigate(['/dashboard']);
    } catch {
      this.error.set('That code did not work. Try again.');
    } finally {
      this.busy.set(false);
    }
  }
}

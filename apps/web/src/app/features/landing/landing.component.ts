import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OtpChannel } from '@gusto/contracts';
import { AuthService } from '../../core/auth/auth.service';

type Step = 'phone' | 'code';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="page">
      <section class="hero">
        <div class="brand">
          <span class="logo">🍳</span>
          <span class="word">Gusto</span>
        </div>
        <h1>Home-cooked meals from chefs near you.</h1>
        <p class="lede">
          Real food, made by real people in their own kitchens — and brought to your door.
        </p>
        <ul class="points">
          <li>👩‍🍳 Order from vetted home-chefs</li>
          <li>🔒 Secure phone login — SMS or WhatsApp</li>
          <li>🛵 Your courier, <strong>Gus</strong>, on the way</li>
        </ul>
      </section>

      <section class="card">
        @if (step() === 'phone') {
          <h2>Log in</h2>
          <p class="sub">We'll text you a one-time code.</p>

          <div class="seg" role="group" aria-label="Delivery channel">
            <button
              type="button"
              [class.active]="channel() === 'sms'"
              (click)="channel.set('sms')"
            >SMS</button>
            <button
              type="button"
              [class.active]="channel() === 'whatsapp'"
              (click)="channel.set('whatsapp')"
            >WhatsApp</button>
          </div>

          <label for="phone">Phone number</label>
          <input
            id="phone"
            name="phone"
            [(ngModel)]="phone"
            placeholder="+14155552671"
            inputmode="tel"
            autocomplete="tel"
          />
          <button class="primary" [disabled]="busy() || !phone" (click)="sendCode()">
            {{ busy() ? 'Sending…' : 'Log in' }}
          </button>
        } @else {
          <h2>Enter your code</h2>
          <p class="sub">Sent via {{ channel() === 'whatsapp' ? 'WhatsApp' : 'SMS' }} to {{ phone }}</p>

          <label for="code">6-digit code</label>
          <input
            id="code"
            name="code"
            [(ngModel)]="code"
            placeholder="123456"
            inputmode="numeric"
            maxlength="6"
            autocomplete="one-time-code"
          />
          <button class="primary" [disabled]="busy() || code.length < 6" (click)="verify()">
            {{ busy() ? 'Verifying…' : 'Verify & enter' }}
          </button>
          <button class="link" (click)="reset()">Use a different number</button>
        }

        @if (error()) { <p class="error">{{ error() }}</p> }
      </section>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .page {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 40px;
        align-items: center;
        padding: 6vh 7vw;
        box-sizing: border-box;
        background:
          radial-gradient(1200px 600px at 0% 0%, #ffe9d6 0%, transparent 55%),
          radial-gradient(1000px 700px at 100% 100%, #ffd9cc 0%, transparent 50%),
          #faf7f2;
      }
      .hero { max-width: 560px; }
      .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
      .logo { font-size: 34px; }
      .word { font-size: 30px; font-weight: 800; color: var(--gusto); letter-spacing: -0.5px; }
      h1 { font-size: clamp(30px, 4vw, 52px); line-height: 1.05; margin: 0 0 16px; letter-spacing: -1px; }
      .lede { font-size: 18px; color: #6b6457; margin: 0 0 28px; max-width: 460px; }
      .points { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; color: #44403a; font-size: 16px; }

      .card {
        justify-self: end;
        width: 100%;
        max-width: 380px;
        background: #fff;
        border-radius: 20px;
        padding: 30px;
        box-shadow: 0 18px 50px rgba(120, 60, 30, 0.14);
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      h2 { margin: 0; font-size: 24px; }
      .sub { margin: 0 0 6px; color: #6b6457; font-size: 14px; }
      label { font-size: 13px; font-weight: 600; color: #44403a; }
      input {
        padding: 13px 14px; border: 1px solid #e3ddd2; border-radius: 12px; font-size: 17px;
        outline: none; transition: border-color .15s;
      }
      input:focus { border-color: var(--gusto); }
      .seg { display: flex; background: #f1ece3; border-radius: 12px; padding: 4px; gap: 4px; }
      .seg button {
        flex: 1; padding: 9px; border: 0; border-radius: 9px; background: transparent;
        color: #6b6457; font-weight: 600; cursor: pointer; font-size: 14px;
      }
      .seg button.active { background: #fff; color: var(--gusto); box-shadow: 0 1px 4px rgba(0,0,0,.08); }
      .primary {
        margin-top: 4px; padding: 13px; border: 0; border-radius: 12px;
        background: var(--gusto); color: #fff; font-weight: 700; font-size: 16px; cursor: pointer;
      }
      .primary:disabled { opacity: .55; cursor: default; }
      .link { background: none; border: 0; color: #6b6457; cursor: pointer; font-size: 14px; }
      .error { color: #b3261e; font-size: 14px; margin: 4px 0 0; }

      @media (max-width: 820px) {
        .page { grid-template-columns: 1fr; padding: 5vh 6vw; }
        .card { justify-self: stretch; }
      }
    `,
  ],
})
export class LandingComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  step = signal<Step>('phone');
  channel = signal<OtpChannel>('sms');
  busy = signal(false);
  error = signal<string | null>(null);
  phone = '';
  code = '';

  async sendCode(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      await this.auth.requestOtp(this.phone.trim(), this.channel());
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
      await this.router.navigate(['/coming-soon']);
    } catch {
      this.error.set('That code did not work. Try again.');
    } finally {
      this.busy.set(false);
    }
  }

  reset(): void {
    this.code = '';
    this.error.set(null);
    this.step.set('phone');
  }
}

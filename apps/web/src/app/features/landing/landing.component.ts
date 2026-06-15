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
        <div class="page">
            <!-- HERO -->
            <section class="hero">
                <div class="intro">
                    <div class="brand"><span class="logo">🍳</span><span class="word">Gusto</span></div>
                    <h1>Home-cooked meals from chefs near you.</h1>
                    <p class="lede">
                        Real food, made by real people in their own kitchens — and brought to your door by your courier,
                        <strong>Gus</strong>.
                    </p>
                    <ul class="points">
                        <li>👩‍🍳 Vetted home-chefs, real menus</li>
                        <li>🔒 Secure phone login — SMS or WhatsApp</li>
                        <li>🛵 Fresh from their kitchen to your door</li>
                    </ul>
                </div>

                <div class="card">
                    @if (step() === 'phone') {
                        <h2>Log in</h2>
                        <p class="sub">We'll send you a one-time code.</p>
                        <div class="seg" role="group" aria-label="Delivery channel">
                            <button type="button" [class.active]="channel() === 'sms'" (click)="channel.set('sms')">
                                SMS
                            </button>
                            <button
                                type="button"
                                [class.active]="channel() === 'whatsapp'"
                                (click)="channel.set('whatsapp')"
                            >
                                WhatsApp
                            </button>
                        </div>
                        <label for="phone">Phone number</label>
                        <div class="phone-row">
                            <select name="cc" [(ngModel)]="countryCode" aria-label="Country code">
                                @for (c of countries; track c.dial) {
                                    <option [value]="c.dial">{{ c.flag }} {{ c.dial }}</option>
                                }
                            </select>
                            <input
                                id="phone"
                                name="phone"
                                [(ngModel)]="nationalNumber"
                                placeholder="54 595 3217"
                                inputmode="tel"
                                autocomplete="tel"
                            />
                        </div>
                        @if (nationalNumber) {
                            <p class="preview">
                                📲 Code will be sent to <strong>{{ e164Preview }}</strong>
                            </p>
                        }
                        <button class="primary" [disabled]="busy() || !nationalNumber" (click)="sendCode()">
                            {{ busy() ? 'Sending…' : 'Log in' }}
                        </button>
                    } @else {
                        <h2>Enter your code</h2>
                        <p class="sub">
                            Sent via {{ channel() === 'whatsapp' ? 'WhatsApp' : 'SMS' }} to {{ submittedPhone }}
                        </p>
                        <label for="code">6-digit code</label>
                        <input
                            id="code"
                            name="code"
                            class="otp"
                            [(ngModel)]="code"
                            placeholder="------"
                            inputmode="numeric"
                            maxlength="6"
                            autocomplete="one-time-code"
                        />
                        <button class="primary" [disabled]="busy() || code.length < 6" (click)="verify()">
                            {{ busy() ? 'Verifying…' : 'Verify & enter' }}
                        </button>
                        <button class="link" (click)="reset()">Use a different number</button>
                    }
                    @if (error()) {
                        <p class="error">{{ error() }}</p>
                    }
                </div>
            </section>

            <!-- HOW IT WORKS -->
            <section class="band">
                <h3 class="band-title">How Gusto works</h3>
                <div class="steps">
                    <article>
                        <span class="step-ico">📱</span>
                        <h4>Sign in with your phone</h4>
                        <p>Quick, password-free login with a one-time code over SMS or WhatsApp.</p>
                    </article>
                    <article>
                        <span class="step-ico">🍲</span>
                        <h4>Pick a home-chef</h4>
                        <p>Browse vetted neighbourhood cooks and the dishes they're making today.</p>
                    </article>
                    <article>
                        <span class="step-ico">🛵</span>
                        <h4>Gus brings it over</h4>
                        <p>Your order is cooked to order and delivered warm, straight to your door.</p>
                    </article>
                </div>
            </section>

            <!-- CUISINES -->
            <section class="cuisines">
                <h3 class="band-title">Kitchens in your neighbourhood</h3>
                <p class="cuisines-sub">A taste of what home-chefs on Gusto are cooking.</p>
                <div class="chips">
                    @for (c of cuisines; track c) {
                        <span class="chip">{{ c }}</span>
                    }
                </div>
            </section>

            <!-- CALLOUT -->
            <section class="callout">
                <h3>Made by neighbours, not factories.</h3>
                <p>Every dish on Gusto comes from a home kitchen down the street — not a ghost kitchen.</p>
            </section>

            <footer class="foot">
                <span class="brand small"><span class="logo">🍳</span><span class="word">Gusto</span></span>
                <span class="muted">Home-cooked, delivered by Gus · © 2026 Gusto</span>
            </footer>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
            }
            .page {
                background: #faf7f2;
                color: #1d1b16;
            }

            .hero {
                display: grid;
                grid-template-columns: 1.1fr 0.9fr;
                gap: 40px;
                align-items: center;
                padding: 6vh 7vw;
                box-sizing: border-box;
                background: radial-gradient(1200px 600px at 0% 0%, #ffe9d6 0%, transparent 55%),
                    radial-gradient(1000px 700px at 100% 100%, #ffd9cc 0%, transparent 50%), #faf7f2;
            }
            .intro {
                max-width: 560px;
            }
            .brand {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 24px;
            }
            .brand.small {
                margin: 0;
            }
            .logo {
                font-size: 32px;
            }
            .word {
                font-size: 28px;
                font-weight: 800;
                color: var(--gusto);
                letter-spacing: -0.5px;
            }
            h1 {
                font-size: clamp(30px, 4vw, 52px);
                line-height: 1.05;
                margin: 0 0 16px;
                letter-spacing: -1px;
            }
            .lede {
                font-size: 18px;
                color: #6b6457;
                margin: 0 0 28px;
                max-width: 460px;
            }
            .points {
                list-style: none;
                padding: 0;
                margin: 0;
                display: grid;
                gap: 12px;
                color: #44403a;
                font-size: 16px;
            }

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
            h2 {
                margin: 0;
                font-size: 24px;
            }
            .sub {
                margin: 0 0 6px;
                color: #6b6457;
                font-size: 14px;
            }
            label {
                font-size: 13px;
                font-weight: 600;
                color: #44403a;
            }
            input {
                padding: 13px 14px;
                border: 1px solid #e3ddd2;
                border-radius: 12px;
                font-size: 17px;
                outline: none;
                transition: border-color 0.15s;
            }
            input:focus {
                border-color: var(--gusto);
            }
            .phone-row {
                display: flex;
                gap: 8px;
            }
            .phone-row select {
                border: 1px solid #e3ddd2;
                border-radius: 12px;
                padding: 0 8px;
                font-size: 15px;
                background: #fff;
                color: #1d1b16;
                cursor: pointer;
            }
            .phone-row input {
                flex: 1;
                min-width: 0;
            }
            .preview {
                margin: 2px 0 0;
                font-size: 13px;
                color: #6b6457;
            }
            .otp {
                text-align: center;
                letter-spacing: 10px;
                font-size: 22px;
                font-weight: 700;
                padding-left: 10px;
            }
            .otp::placeholder {
                letter-spacing: 10px;
                color: #ccc4b6;
            }
            .seg {
                display: flex;
                background: #f1ece3;
                border-radius: 12px;
                padding: 4px;
                gap: 4px;
            }
            .seg button {
                flex: 1;
                padding: 9px;
                border: 0;
                border-radius: 9px;
                background: transparent;
                color: #6b6457;
                font-weight: 600;
                cursor: pointer;
                font-size: 14px;
            }
            .seg button.active {
                background: #fff;
                color: var(--gusto);
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
            }
            .primary {
                margin-top: 4px;
                padding: 13px;
                border: 0;
                border-radius: 12px;
                background: var(--gusto);
                color: #fff;
                font-weight: 700;
                font-size: 16px;
                cursor: pointer;
            }
            .primary:disabled {
                opacity: 0.55;
                cursor: default;
            }
            .link {
                background: none;
                border: 0;
                color: #6b6457;
                cursor: pointer;
                font-size: 14px;
            }
            .error {
                color: #b3261e;
                font-size: 14px;
                margin: 4px 0 0;
            }

            .band-title {
                font-size: clamp(22px, 2.6vw, 30px);
                text-align: center;
                margin: 0 0 28px;
                letter-spacing: -0.5px;
            }
            .band {
                padding: 8vh 7vw;
            }
            .steps {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 22px;
                max-width: 1000px;
                margin: 0 auto;
            }
            .steps article {
                background: #fff;
                border: 1px solid #f0e9dd;
                border-radius: 16px;
                padding: 26px;
            }
            .step-ico {
                font-size: 30px;
            }
            .steps h4 {
                margin: 14px 0 8px;
                font-size: 18px;
            }
            .steps p {
                margin: 0;
                color: #6b6457;
                font-size: 15px;
                line-height: 1.5;
            }

            .cuisines {
                padding: 2vh 7vw 8vh;
                text-align: center;
            }
            .cuisines-sub {
                color: #6b6457;
                margin: 0 0 22px;
            }
            .chips {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                justify-content: center;
                max-width: 760px;
                margin: 0 auto;
            }
            .chip {
                background: #fff;
                border: 1px solid #ecdfd0;
                color: #7a4a36;
                border-radius: 999px;
                padding: 9px 16px;
                font-weight: 600;
                font-size: 14px;
            }

            .callout {
                text-align: center;
                padding: 9vh 7vw;
                color: #fff;
                background: linear-gradient(120deg, #d2553a, #e0764f);
            }
            .callout h3 {
                font-size: clamp(24px, 3vw, 38px);
                margin: 0 0 10px;
                letter-spacing: -0.5px;
            }
            .callout p {
                margin: 0;
                opacity: 0.92;
                font-size: 17px;
            }

            .foot {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 10px;
                padding: 28px 7vw;
            }
            .muted {
                color: #8a8275;
                font-size: 14px;
            }

            @media (max-width: 860px) {
                .hero {
                    grid-template-columns: 1fr;
                    padding: 5vh 6vw;
                }
                .card {
                    justify-self: stretch;
                }
                .steps {
                    grid-template-columns: 1fr;
                }
            }
        `,
    ],
})
export class LandingComponent {
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);

    readonly cuisines = [
        'Levantine',
        'Georgian',
        'Yemenite',
        'Persian',
        'Ethiopian',
        'Italian',
        'Thai',
        'Mexican',
        'Moroccan',
        'Indian',
    ];

    readonly countries = [
        { dial: '+972', flag: '🇮🇱' },
        { dial: '+1', flag: '🇺🇸' },
        { dial: '+44', flag: '🇬🇧' },
        { dial: '+49', flag: '🇩🇪' },
        { dial: '+33', flag: '🇫🇷' },
        { dial: '+39', flag: '🇮🇹' },
        { dial: '+91', flag: '🇮🇳' },
    ];

    step = signal<Step>('phone');
    channel = signal<OtpChannel>('sms');
    busy = signal(false);
    error = signal<string | null>(null);
    countryCode = '+972';
    nationalNumber = '';
    /** The composed E.164 number actually sent to the API. */
    submittedPhone = '';
    code = '';

    /** Combine country code + national part into E.164, dropping spaces and a leading 0. */
    private toE164(): string {
        const cc = this.countryCode.replace(/\D/g, ''); // e.g. "972"
        const trimmed = this.nationalNumber.trim();

        // If the user pasted a full international number, respect it as-is.
        if (trimmed.startsWith('+')) {
            return '+' + trimmed.replace(/\D/g, '');
        }

        let digits = trimmed.replace(/\D/g, '');
        if (digits.startsWith('00')) digits = digits.slice(2); // 00-prefixed international form
        if (cc && digits.startsWith(cc)) digits = digits.slice(cc.length); // doubled country code
        digits = digits.replace(/^0+/, ''); // national trunk 0

        return `+${cc}${digits}`;
    }

    /** Live preview of the exact E.164 number that will be sent to Twilio. */
    get e164Preview(): string {
        return this.toE164();
    }

    async sendCode(): Promise<void> {
        const phone = this.toE164();
        if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
            this.error.set('Enter a valid phone number (digits only).');
            return;
        }
        this.error.set(null);
        this.busy.set(true);
        try {
            await this.auth.requestOtp(phone, this.channel());
            this.submittedPhone = phone;
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
            await this.auth.verifyOtp(this.submittedPhone, this.code.trim());
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

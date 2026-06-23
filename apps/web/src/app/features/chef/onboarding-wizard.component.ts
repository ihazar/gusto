import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Diet } from '@gusto/contracts';
import { ChefService } from '../../core/chef/chef.service';

/** Short, human labels for each diet badge. */
const DIET_LABEL: Record<Diet, string> = {
    [Diet.VEGETARIAN]: '🥗 Vegetarian',
    [Diet.VEGAN]: '🌱 Vegan',
    [Diet.PESCATARIAN]: '🐟 Pescatarian',
    [Diet.PALEO]: '🍖 Paleo',
    [Diet.KETO]: '🥑 Keto',
    [Diet.GLUTEN_FREE]: '🌾 Gluten-free',
    [Diet.DAIRY_FREE]: '🥛 Dairy-free',
    [Diet.NUT_FREE]: '🥜 Nut-free',
    [Diet.HALAL]: '☪️ Halal',
    [Diet.KOSHER]: '✡️ Kosher',
};

const STEPS = ['About', 'Photos', 'Location', 'First dish', 'Review'];

@Component({
    selector: 'app-onboarding-wizard',
    standalone: true,
    imports: [FormsModule],
    template: `
        <div class="wrap">
            <header class="head">
                <div class="brand"><span class="logo">🍳</span><span class="word">Gusto</span></div>
                <button class="link" type="button" (click)="prefill()">Use sample data</button>
            </header>

            <div class="card">
                <div class="intro">
                    <h1>Set up your kitchen</h1>
                    <p>A few quick steps and your page goes live.</p>
                </div>

                <ol class="steps">
                    @for (s of stepNames; track s; let i = $index) {
                        <li [class.done]="i < step()" [class.active]="i === step()">
                            <span class="dot">{{ i < step() ? '✓' : i + 1 }}</span>
                            <span class="lbl">{{ s }}</span>
                        </li>
                    }
                </ol>

                <!-- STEP 1: ABOUT -->
                @if (step() === 0) {
                    <section class="step">
                        <label for="kitchen">Kitchen name</label>
                        <input id="kitchen" [(ngModel)]="data.kitchenName" placeholder="e.g. Maya’s Levantine Table" />
                        <label for="name">Your name</label>
                        <input id="name" [(ngModel)]="data.name" placeholder="e.g. Maya Cohen" />
                        <label for="bio">Bio</label>
                        <textarea
                            id="bio"
                            rows="4"
                            [(ngModel)]="data.bio"
                            placeholder="Tell customers about your cooking…"
                        ></textarea>
                    </section>
                }

                <!-- STEP 2: PHOTOS -->
                @if (step() === 1) {
                    <section class="step">
                        <label>Profile photo (your selfie)</label>
                        <div class="photo-row">
                            <div
                                class="avatar"
                                [style.background-image]="data.selfieUrl ? 'url(' + data.selfieUrl + ')' : ''"
                            ></div>
                            <div class="photo-inputs">
                                <input type="file" accept="image/*" (change)="onPhoto($event, 'selfieUrl')" />
                                <input [(ngModel)]="data.selfieUrl" placeholder="…or paste an image URL" />
                            </div>
                        </div>
                        <label>Cover photo (your timeline)</label>
                        <div
                            class="cover"
                            [style.background-image]="data.timelineUrl ? 'url(' + data.timelineUrl + ')' : ''"
                        ></div>
                        <div class="photo-inputs">
                            <input type="file" accept="image/*" (change)="onPhoto($event, 'timelineUrl')" />
                            <input [(ngModel)]="data.timelineUrl" placeholder="…or paste an image URL" />
                        </div>
                    </section>
                }

                <!-- STEP 3: LOCATION -->
                @if (step() === 2) {
                    <section class="step">
                        <p class="hint">We use your kitchen’s location to match you with nearby customers.</p>
                        <label for="line1">Street address</label>
                        <input id="line1" [(ngModel)]="data.line1" placeholder="14 Vital St" />
                        <div class="row">
                            <div>
                                <label for="city">City</label>
                                <input id="city" [(ngModel)]="data.city" placeholder="Tel Aviv-Yafo" />
                            </div>
                            <div>
                                <label for="postal">Postal code</label>
                                <input id="postal" [(ngModel)]="data.postalCode" />
                            </div>
                        </div>
                        <div class="row">
                            <div>
                                <label for="region">Region</label>
                                <input id="region" [(ngModel)]="data.region" />
                            </div>
                            <div>
                                <label for="country">Country</label>
                                <input id="country" [(ngModel)]="data.country" maxlength="2" placeholder="IL" />
                            </div>
                        </div>
                        <div class="row">
                            <div>
                                <label for="lat">Latitude</label>
                                <input id="lat" type="number" step="0.0001" [(ngModel)]="data.lat" />
                            </div>
                            <div>
                                <label for="lng">Longitude</label>
                                <input id="lng" type="number" step="0.0001" [(ngModel)]="data.lng" />
                            </div>
                        </div>
                    </section>
                }

                <!-- STEP 4: FIRST DISH -->
                @if (step() === 3) {
                    <section class="step">
                        <p class="hint">Add your first dish now, or skip and add it later from the Meals tab.</p>
                        <label for="dname">Dish name</label>
                        <input id="dname" [(ngModel)]="dish.name" placeholder="e.g. Green shakshuka" />
                        <label for="ddesc">Description</label>
                        <textarea
                            id="ddesc"
                            rows="2"
                            [(ngModel)]="dish.description"
                            placeholder="What’s in it, how it’s served…"
                        ></textarea>
                        <label for="dprice">Price</label>
                        <div class="price-row">
                            <input class="cur" [(ngModel)]="dish.currency" maxlength="3" aria-label="Currency" />
                            <input id="dprice" type="number" min="1" [(ngModel)]="dish.price" placeholder="39" />
                        </div>
                        <label>Diets it appeals to</label>
                        <div class="diet-picker">
                            @for (d of allDiets; track d) {
                                <button
                                    type="button"
                                    class="diet-opt"
                                    [class.on]="dish.diets.includes(d)"
                                    (click)="toggleDiet(d)"
                                >
                                    {{ dietLabel(d) }}
                                </button>
                            }
                        </div>
                        <label>Photo</label>
                        <div class="photo-row">
                            <div
                                class="thumb"
                                [style.background-image]="dish.imageUrl ? 'url(' + dish.imageUrl + ')' : ''"
                            ></div>
                            <div class="photo-inputs">
                                <input type="file" accept="image/*" (change)="onDishPhoto($event)" />
                                <input [(ngModel)]="dish.imageUrl" placeholder="…or paste an image URL" />
                            </div>
                        </div>
                    </section>
                }

                <!-- STEP 5: REVIEW -->
                @if (step() === 4) {
                    <section class="step review">
                        <div class="preview">
                            <div
                                class="pv-cover"
                                [style.background-image]="data.timelineUrl ? 'url(' + data.timelineUrl + ')' : ''"
                            ></div>
                            <div class="pv-bar">
                                <div
                                    class="pv-avatar"
                                    [style.background-image]="data.selfieUrl ? 'url(' + data.selfieUrl + ')' : ''"
                                ></div>
                                <div>
                                    <strong>{{ data.kitchenName || 'Your kitchen' }}</strong>
                                    <span class="pv-by">by {{ data.name || 'you' }} · {{ data.city || '—' }}</span>
                                </div>
                            </div>
                        </div>
                        <dl class="summary">
                            <div>
                                <dt>Kitchen</dt>
                                <dd>{{ data.kitchenName || '—' }}</dd>
                            </div>
                            <div>
                                <dt>Chef</dt>
                                <dd>{{ data.name || '—' }}</dd>
                            </div>
                            <div>
                                <dt>Address</dt>
                                <dd>{{ summaryAddress() }}</dd>
                            </div>
                            <div>
                                <dt>First dish</dt>
                                <dd>{{ dish.name.trim() ? dish.name : 'None yet' }}</dd>
                            </div>
                        </dl>
                        <p class="finish-note">Publishing makes your page live and starts accepting orders.</p>
                    </section>
                }

                @if (error()) {
                    <p class="error">{{ error() }}</p>
                }

                <div class="nav">
                    @if (step() > 0) {
                        <button class="ghost" type="button" (click)="back()">← Back</button>
                    }
                    <span class="spacer"></span>
                    @if (step() < stepNames.length - 1) {
                        <button class="primary" type="button" [disabled]="!canProceed()" (click)="next()">
                            Continue →
                        </button>
                    } @else {
                        <button class="primary" type="button" [disabled]="busy()" (click)="publish()">
                            {{ busy() ? 'Publishing…' : 'Publish my page 🎉' }}
                        </button>
                    }
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
            }
            .wrap {
                min-height: 100vh;
                background: radial-gradient(900px 500px at 50% 0%, #ffe9d6 0%, transparent 60%), #faf7f2;
                padding: 0 0 60px;
            }
            .head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 18px 7vw;
            }
            .brand {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .logo {
                font-size: 26px;
            }
            .word {
                font-size: 22px;
                font-weight: 800;
                color: var(--gusto);
            }
            .link {
                background: none;
                border: 0;
                color: #6b6457;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                text-decoration: underline;
            }
            .card {
                max-width: 560px;
                margin: 8px auto 0;
                background: #fff;
                border: 1px solid #f0e9dd;
                border-radius: 20px;
                padding: 30px;
                box-shadow: 0 18px 50px rgba(120, 60, 30, 0.12);
            }
            .intro h1 {
                margin: 0;
                font-size: 26px;
                letter-spacing: -0.5px;
            }
            .intro p {
                margin: 6px 0 0;
                color: #6b6457;
            }

            .steps {
                list-style: none;
                display: flex;
                gap: 6px;
                padding: 0;
                margin: 22px 0 24px;
            }
            .steps li {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                color: #b6ab99;
                font-size: 12px;
                font-weight: 600;
                position: relative;
            }
            .steps li::before {
                content: '';
                position: absolute;
                top: 13px;
                left: -50%;
                width: 100%;
                height: 2px;
                background: #ece4d7;
                z-index: 0;
            }
            .steps li:first-child::before {
                display: none;
            }
            .steps li.done::before,
            .steps li.active::before {
                background: #f1c3ac;
            }
            .dot {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: #f1ece3;
                color: #8a8275;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                z-index: 1;
            }
            .steps li.active .dot {
                background: var(--gusto);
                color: #fff;
            }
            .steps li.done .dot {
                background: #e6f4ec;
                color: #1d7a4a;
            }
            .steps li.active,
            .steps li.done {
                color: #44403a;
            }

            .step {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            label {
                font-size: 13px;
                font-weight: 600;
                color: #44403a;
                margin-top: 6px;
            }
            input,
            textarea {
                padding: 11px 13px;
                border: 1px solid #e3ddd2;
                border-radius: 10px;
                font-size: 15px;
                font-family: inherit;
                outline: none;
            }
            input:focus,
            textarea:focus {
                border-color: var(--gusto);
            }
            .hint {
                margin: 0 0 4px;
                color: #6b6457;
                font-size: 14px;
            }
            .row {
                display: flex;
                gap: 12px;
            }
            .row > div {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .price-row {
                display: flex;
                gap: 8px;
            }
            .price-row .cur {
                width: 64px;
                text-align: center;
                text-transform: uppercase;
            }
            .price-row input[type='number'] {
                flex: 1;
            }

            .photo-row {
                display: flex;
                gap: 14px;
                align-items: center;
            }
            .photo-inputs {
                display: flex;
                flex-direction: column;
                gap: 8px;
                flex: 1;
            }
            .avatar {
                width: 84px;
                height: 84px;
                border-radius: 50%;
                background: #f1ece3 center/cover;
                flex: none;
                border: 3px solid #fff;
                box-shadow: 0 4px 12px rgba(120, 60, 30, 0.15);
            }
            .cover {
                height: 130px;
                border-radius: 12px;
                background: #f1ece3 center/cover;
            }
            .thumb {
                width: 90px;
                height: 70px;
                border-radius: 10px;
                background: #f1ece3 center/cover;
                flex: none;
            }
            .diet-picker {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .diet-opt {
                border: 1px solid #ecdfd0;
                background: #fff;
                color: #7a4a36;
                border-radius: 999px;
                padding: 6px 12px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
            }
            .diet-opt.on {
                background: #fff0e8;
                border-color: var(--gusto);
                color: var(--gusto);
            }

            /* review */
            .preview {
                border: 1px solid #f0e9dd;
                border-radius: 14px;
                overflow: hidden;
            }
            .pv-cover {
                height: 110px;
                background: #f1ece3 center/cover;
            }
            .pv-bar {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 0 16px 14px;
                margin-top: -24px;
            }
            .pv-avatar {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: #e9e2d6 center/cover;
                border: 3px solid #fff;
                flex: none;
            }
            .pv-bar strong {
                display: block;
                font-size: 16px;
            }
            .pv-by {
                color: #6b6457;
                font-size: 13px;
            }
            .summary {
                margin: 18px 0 0;
            }
            .summary > div {
                display: flex;
                justify-content: space-between;
                gap: 16px;
                padding: 8px 0;
                border-bottom: 1px solid #f3eee5;
            }
            .summary dt {
                color: #8a8275;
                font-size: 14px;
                margin: 0;
            }
            .summary dd {
                margin: 0;
                font-weight: 600;
                text-align: right;
            }
            .finish-note {
                color: #6b6457;
                font-size: 14px;
                margin: 16px 0 0;
            }

            .error {
                color: #b3261e;
                font-size: 14px;
                margin: 14px 0 0;
            }
            .nav {
                display: flex;
                align-items: center;
                margin-top: 26px;
            }
            .spacer {
                flex: 1;
            }
            .ghost {
                border: 1px solid #e3ddd2;
                background: #fff;
                color: #6b6457;
                font-weight: 600;
                padding: 11px 18px;
                border-radius: 12px;
                cursor: pointer;
            }
            .primary {
                padding: 12px 22px;
                border: 0;
                border-radius: 12px;
                background: var(--gusto);
                color: #fff;
                font-weight: 700;
                font-size: 15px;
                cursor: pointer;
            }
            .primary:disabled {
                opacity: 0.5;
                cursor: default;
            }
            @media (max-width: 520px) {
                .row {
                    flex-direction: column;
                }
            }
        `,
    ],
})
export class OnboardingWizardComponent {
    private readonly chefService = inject(ChefService);
    private readonly router = inject(Router);

    readonly stepNames = STEPS;
    readonly allDiets = Object.values(Diet);
    readonly step = signal(0);
    readonly error = signal<string | null>(null);
    readonly busy = signal(false);

    data = {
        name: '',
        kitchenName: '',
        bio: '',
        selfieUrl: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&h=400&fit=crop',
        timelineUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1600&h=500&fit=crop',
        line1: '',
        city: '',
        region: '',
        postalCode: '',
        country: 'IL',
        lat: 32.0853,
        lng: 34.7818,
    };

    dish = {
        name: '',
        description: '',
        price: null as number | null,
        currency: 'ILS',
        imageUrl: '',
        available: true,
        diets: [] as Diet[],
    };

    readonly summaryAddress = computed(() =>
        [this.data.line1, this.data.city, this.data.region, this.data.country].filter(Boolean).join(', '),
    );

    constructor() {
        // Already onboarded? Skip the wizard and go to the live page.
        effect(() => {
            if (this.chefService.loaded() && this.chefService.onboarded()) {
                void this.router.navigate(['/chef']);
            }
        });
    }

    dietLabel(d: Diet): string {
        return DIET_LABEL[d];
    }

    toggleDiet(d: Diet): void {
        const i = this.dish.diets.indexOf(d);
        if (i >= 0) this.dish.diets.splice(i, 1);
        else this.dish.diets.push(d);
    }

    onPhoto(e: Event, field: 'selfieUrl' | 'timelineUrl'): void {
        this.readFile(e, (url) => (this.data[field] = url));
    }

    onDishPhoto(e: Event): void {
        this.readFile(e, (url) => (this.dish.imageUrl = url));
    }

    private readFile(e: Event, set: (url: string) => void): void {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => set(reader.result as string);
        reader.readAsDataURL(file);
    }

    /** Per-step validation that gates the Continue button. */
    canProceed(): boolean {
        switch (this.step()) {
            case 0:
                return !!this.data.kitchenName.trim() && !!this.data.name.trim();
            case 1:
                return !!this.data.selfieUrl && !!this.data.timelineUrl;
            case 2:
                return !!this.data.line1.trim() && !!this.data.city.trim() && this.data.country.trim().length === 2;
            case 3:
                // First dish is optional; if started, require description + price.
                return !this.dish.name.trim() || (!!this.dish.description.trim() && !!this.dish.price);
            default:
                return true;
        }
    }

    next(): void {
        if (!this.canProceed()) {
            this.error.set('Please complete the highlighted fields.');
            return;
        }
        this.error.set(null);
        this.step.update((s) => Math.min(s + 1, this.stepNames.length - 1));
    }

    back(): void {
        this.error.set(null);
        this.step.update((s) => Math.max(s - 1, 0));
    }

    async publish(): Promise<void> {
        this.busy.set(true);
        this.error.set(null);
        try {
            const meals =
                this.dish.name.trim() && this.dish.price
                    ? [
                          {
                              name: this.dish.name.trim(),
                              description: this.dish.description.trim(),
                              price: Number(this.dish.price),
                              currency: (this.dish.currency || 'ILS').toUpperCase(),
                              diets: this.dish.diets,
                              imageUrl: this.dish.imageUrl || undefined,
                              available: this.dish.available,
                              kosher: false,
                              allergens: [],
                          },
                      ]
                    : [];
            await this.chefService.completeOnboarding({
                name: this.data.name.trim(),
                kitchenName: this.data.kitchenName.trim(),
                bio: this.data.bio.trim(),
                selfieUrl: this.data.selfieUrl,
                timelineUrl: this.data.timelineUrl,
                address: {
                    line1: this.data.line1.trim(),
                    city: this.data.city.trim(),
                    region: this.data.region.trim() || undefined,
                    postalCode: this.data.postalCode.trim() || undefined,
                    country: (this.data.country || 'IL').toUpperCase(),
                },
                location: { lat: Number(this.data.lat), lng: Number(this.data.lng) },
                meals,
            });
            await this.router.navigate(['/chef']);
        } catch {
            this.error.set('Could not publish your page. Please try again.');
        } finally {
            this.busy.set(false);
        }
    }

    /** Quick-fill with a sample profile so the flow can be demoed fast. */
    prefill(): void {
        this.data = {
            name: 'Maya Cohen',
            kitchenName: "Maya's Levantine Table",
            bio: 'Home-cook from Florentin. I make the mezze and slow-cooked stews I grew up on — everything is made to order in my own kitchen, never frozen.',
            selfieUrl: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&h=400&fit=crop',
            timelineUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1600&h=500&fit=crop',
            line1: '14 Vital St',
            city: 'Tel Aviv-Yafo',
            region: 'Tel Aviv District',
            postalCode: '6603714',
            country: 'IL',
            lat: 32.0556,
            lng: 34.7686,
        };
        this.dish = {
            name: 'Green shakshuka',
            description: 'Chard, spinach, leek and feta simmered with eggs and za’atar. Comes with sourdough.',
            price: 39,
            currency: 'ILS',
            imageUrl: 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=600&h=400&fit=crop',
            available: true,
            diets: [Diet.VEGETARIAN, Diet.KETO, Diet.NUT_FREE],
        };
    }
}

import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Diet, Meal, Order, OrderStatus } from '@gusto/contracts';
import { ChefService } from '../../core/chef/chef.service';

type Tab = 'home' | 'meals' | 'orders' | 'settings';

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

/** The order lifecycle in working sequence, with display metadata. */
const ORDER_LANES: { status: OrderStatus; label: string; icon: string }[] = [
    { status: OrderStatus.NEW, label: 'New', icon: '🆕' },
    { status: OrderStatus.IN_PREPARATION, label: 'In preparation', icon: '🍳' },
    { status: OrderStatus.ON_THE_WAY, label: 'On the way', icon: '🛵' },
    { status: OrderStatus.DELIVERED, label: 'Delivered', icon: '✅' },
];

interface MealForm {
    name: string;
    description: string;
    price: number | null;
    currency: string;
    imageUrl: string;
    available: boolean;
    diets: Diet[];
}

@Component({
    selector: 'app-chef-onboarding',
    standalone: true,
    imports: [FormsModule, DatePipe],
    template: `
        <div class="page">
            <header class="topbar">
                <div class="brand"><span class="logo">🍳</span><span class="word">Gusto</span></div>
                <span class="role">Chef dashboard</span>
            </header>

            <div class="shell">
                @if (!onboarded()) {
                    <p class="loading">Setting up your kitchen…</p>
                } @else {
                    <!-- HERO: selfie overlaps the timeline, Facebook-style -->
                    <section class="hero">
                        <div class="timeline" [style.background-image]="'url(' + chef().timelineUrl + ')'"></div>
                        <div class="profile-bar">
                            <img class="selfie" [src]="chef().selfieUrl" [alt]="chef().name" />
                            <div class="who">
                                <h1>
                                    {{ chef().kitchenName }}
                                    @if (chef().verified) {
                                        <span class="verified" title="Vetted by Gusto">✔ Verified</span>
                                    }
                                </h1>
                                <p class="byline">by {{ chef().name }} · {{ chef().address.city }}</p>
                            </div>
                            <div class="status">
                                <span class="pill" [class.on]="chef().active">
                                    {{ chef().active ? '🟢 Live' : '⚪ Offline' }}
                                </span>
                                <span class="pill" [class.on]="chef().acceptingOrders">
                                    {{ chef().acceptingOrders ? '🟢 Taking orders' : '⛔ Paused' }}
                                </span>
                            </div>
                        </div>
                        <p class="bio">{{ chef().bio }}</p>
                        <p class="addr">📍 {{ fullAddress() }}</p>
                    </section>

                    <!-- TABS (under the timeline) -->
                    <nav class="tabs" role="tablist">
                        <button role="tab" [class.active]="tab() === 'home'" (click)="tab.set('home')">Home</button>
                        <button role="tab" [class.active]="tab() === 'meals'" (click)="tab.set('meals')">
                            Meals
                            <span class="badge">{{ chef().meals.length }}</span>
                        </button>
                        <button role="tab" [class.active]="tab() === 'orders'" (click)="tab.set('orders')">
                            Orders
                            @if (newOrderCount() > 0) {
                                <span class="badge alert">{{ newOrderCount() }}</span>
                            }
                        </button>
                        <button role="tab" [class.active]="tab() === 'settings'" (click)="tab.set('settings')">
                            Settings
                        </button>
                    </nav>

                    <!-- HOME -->
                    @if (tab() === 'home') {
                        <section class="tabpanel">
                            <h2 class="section-title">On the menu</h2>
                            <p class="section-sub">The dishes {{ chef().name }} cooks to order.</p>
                            <div class="cards">
                                @for (meal of chef().meals; track meal.id) {
                                    <article class="card" [class.suspended]="!meal.available">
                                        @if (meal.imageUrl) {
                                            <div class="thumb" [style.background-image]="'url(' + meal.imageUrl + ')'">
                                                @if (!meal.available) {
                                                    <span class="susp-tag">Not available</span>
                                                }
                                            </div>
                                        }
                                        <div class="body">
                                            <div class="card-head">
                                                <h3>{{ meal.name }}</h3>
                                                <span class="price">{{ priceLabel(meal) }}</span>
                                            </div>
                                            <p class="desc">{{ meal.description }}</p>
                                            @if (meal.ratingCount > 0) {
                                                <div class="rating" [title]="meal.rating + ' out of 5'">
                                                    <span class="stars">
                                                        <span class="fill" [style.width.%]="meal.rating * 20"
                                                            >★★★★★</span
                                                        >
                                                        <span class="track">★★★★★</span>
                                                    </span>
                                                    <span class="score">{{ meal.rating.toFixed(1) }}</span>
                                                    <span class="count">({{ meal.ratingCount }})</span>
                                                </div>
                                            } @else {
                                                <div class="rating"><span class="count">No ratings yet</span></div>
                                            }
                                            <div class="diets">
                                                @for (d of meal.diets; track d) {
                                                    <span class="diet">{{ dietLabel(d) }}</span>
                                                }
                                            </div>
                                        </div>
                                    </article>
                                }
                            </div>
                        </section>
                    }

                    <!-- MEALS (management) -->
                    @if (tab() === 'meals') {
                        <section class="tabpanel">
                            <h2 class="section-title">Your meals</h2>
                            <p class="section-sub">
                                Add dishes, edit prices, or suspend anything you’re not cooking today.
                            </p>

                            <div class="meal-rows">
                                @for (meal of chef().meals; track meal.id) {
                                    <div class="meal-row" [class.suspended]="!meal.available">
                                        <div
                                            class="row-thumb"
                                            [style.background-image]="meal.imageUrl ? 'url(' + meal.imageUrl + ')' : ''"
                                        ></div>
                                        <div class="row-main">
                                            <strong>{{ meal.name }}</strong>
                                            <span class="row-sub"
                                                >{{ priceLabel(meal) }} · {{ meal.diets.length }} diets</span
                                            >
                                        </div>
                                        <span class="avail" [class.off]="!meal.available">
                                            {{ meal.available ? 'Available' : 'Suspended' }}
                                        </span>
                                        <button class="ghost" (click)="toggleAvailable(meal)">
                                            {{ meal.available ? 'Suspend' : 'Resume' }}
                                        </button>
                                    </div>
                                }
                            </div>

                            <div class="add-meal">
                                <h3>Add a new meal</h3>
                                <div class="grid2">
                                    <div class="field">
                                        <label for="mname">Name</label>
                                        <input
                                            id="mname"
                                            [(ngModel)]="form.name"
                                            placeholder="e.g. Stuffed vine leaves"
                                        />
                                    </div>
                                    <div class="field">
                                        <label for="mprice">Price</label>
                                        <div class="price-row">
                                            <input
                                                id="mcurrency"
                                                class="cur"
                                                [(ngModel)]="form.currency"
                                                maxlength="3"
                                                aria-label="Currency"
                                            />
                                            <input
                                                id="mprice"
                                                type="number"
                                                min="1"
                                                step="1"
                                                [(ngModel)]="form.price"
                                                placeholder="42"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div class="field">
                                    <label for="mdesc">Description</label>
                                    <textarea
                                        id="mdesc"
                                        rows="2"
                                        [(ngModel)]="form.description"
                                        placeholder="What’s in it, how it’s served…"
                                    ></textarea>
                                </div>
                                <div class="field">
                                    <label>Diets it appeals to</label>
                                    <div class="diet-picker">
                                        @for (d of allDiets; track d) {
                                            <button
                                                type="button"
                                                class="diet-opt"
                                                [class.on]="form.diets.includes(d)"
                                                (click)="toggleDiet(d)"
                                            >
                                                {{ dietLabel(d) }}
                                            </button>
                                        }
                                    </div>
                                </div>
                                <div class="field">
                                    <label>Photo</label>
                                    <div class="photo-row">
                                        <div
                                            class="photo-preview"
                                            [style.background-image]="form.imageUrl ? 'url(' + form.imageUrl + ')' : ''"
                                        >
                                            @if (!form.imageUrl) {
                                                <span>No photo</span>
                                            }
                                        </div>
                                        <div class="photo-inputs">
                                            <input type="file" accept="image/*" (change)="onPhoto($event)" />
                                            <input
                                                [(ngModel)]="form.imageUrl"
                                                placeholder="…or paste an image URL"
                                                aria-label="Image URL"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div class="field-inline">
                                    <label class="check">
                                        <input type="checkbox" [(ngModel)]="form.available" />
                                        Available right away
                                    </label>
                                    @if (formError()) {
                                        <span class="error">{{ formError() }}</span>
                                    }
                                    <button class="primary" [disabled]="busy()" (click)="submitMeal()">
                                        {{ busy() ? 'Adding…' : 'Add meal' }}
                                    </button>
                                </div>
                            </div>
                        </section>
                    }

                    <!-- ORDERS -->
                    @if (tab() === 'orders') {
                        <section class="tabpanel">
                            <h2 class="section-title">Orders</h2>
                            <p class="section-sub">Track each order from new to delivered.</p>
                            <div class="board">
                                @for (lane of lanes; track lane.status) {
                                    <div class="lane">
                                        <div class="lane-head">
                                            <span>{{ lane.icon }} {{ lane.label }}</span>
                                            <span class="lane-count">{{ ordersIn(lane.status).length }}</span>
                                        </div>
                                        @for (order of ordersIn(lane.status); track order.id) {
                                            <article class="order">
                                                <div class="order-head">
                                                    <strong>{{ order.customerName }}</strong>
                                                    <span class="order-total">{{ orderTotal(order) }}</span>
                                                </div>
                                                <ul class="order-items">
                                                    @for (it of order.items; track it.mealId) {
                                                        <li>{{ it.qty }}× {{ it.name }}</li>
                                                    }
                                                </ul>
                                                <p class="order-addr">📍 {{ order.deliveryAddress }}</p>
                                                <p class="order-time">🕒 {{ order.placedAt | date: 'shortTime' }}</p>
                                                @if (nextStatus(order.status); as next) {
                                                    <button class="advance" (click)="advance(order, next)">
                                                        {{ advanceLabel(next) }}
                                                    </button>
                                                }
                                            </article>
                                        }
                                        @if (ordersIn(lane.status).length === 0) {
                                            <p class="lane-empty">Nothing here</p>
                                        }
                                    </div>
                                }
                            </div>
                        </section>
                    }

                    <!-- SETTINGS -->
                    @if (tab() === 'settings') {
                        <section class="tabpanel settings">
                            <h2 class="section-title">Kitchen settings</h2>

                            <div class="panel">
                                <h3>Availability</h3>
                                <label class="switch">
                                    <span>
                                        <strong>Profile is live</strong>
                                        <small>When off, customers can’t see your kitchen.</small>
                                    </span>
                                    <input type="checkbox" [checked]="chef().active" (change)="onActive($event)" />
                                </label>
                                <label class="switch">
                                    <span>
                                        <strong>Accepting orders</strong>
                                        <small>Pause this when you’re too busy to cook.</small>
                                    </span>
                                    <input
                                        type="checkbox"
                                        [checked]="chef().acceptingOrders"
                                        (change)="onAcceptingOrders($event)"
                                    />
                                </label>
                                <div class="verified-row">
                                    <span>
                                        <strong>Verified chef</strong>
                                        <small>Vetted by the Gusto team. Contact support to get verified.</small>
                                    </span>
                                    <span class="verified" [class.muted]="!chef().verified">
                                        {{ chef().verified ? '✔ Verified' : 'Not verified' }}
                                    </span>
                                </div>
                            </div>

                            <div class="panel">
                                <h3>About your kitchen</h3>
                                <label for="kitchen">Kitchen name</label>
                                <input id="kitchen" [(ngModel)]="settings.kitchenName" />
                                <label for="name">Your name</label>
                                <input id="name" [(ngModel)]="settings.name" />
                                <label for="bio">Bio</label>
                                <textarea id="bio" rows="3" [(ngModel)]="settings.bio"></textarea>
                                <label for="selfie">Selfie image URL</label>
                                <input id="selfie" [(ngModel)]="settings.selfieUrl" placeholder="https://…" />
                                <label for="timeline">Timeline (cover) image URL</label>
                                <input id="timeline" [(ngModel)]="settings.timelineUrl" placeholder="https://…" />
                            </div>

                            <div class="panel">
                                <h3>Location &amp; address</h3>
                                <p class="hint">We use your kitchen’s location to match you with nearby customers.</p>
                                <label for="line1">Street address</label>
                                <input id="line1" [(ngModel)]="settings.line1" />
                                <div class="row">
                                    <div>
                                        <label for="city">City</label>
                                        <input id="city" [(ngModel)]="settings.city" />
                                    </div>
                                    <div>
                                        <label for="postal">Postal code</label>
                                        <input id="postal" [(ngModel)]="settings.postalCode" />
                                    </div>
                                </div>
                                <div class="row">
                                    <div>
                                        <label for="region">Region</label>
                                        <input id="region" [(ngModel)]="settings.region" />
                                    </div>
                                    <div>
                                        <label for="country">Country</label>
                                        <input
                                            id="country"
                                            [(ngModel)]="settings.country"
                                            maxlength="2"
                                            placeholder="IL"
                                        />
                                    </div>
                                </div>
                                <div class="row">
                                    <div>
                                        <label for="lat">Latitude</label>
                                        <input id="lat" type="number" step="0.0001" [(ngModel)]="settings.lat" />
                                    </div>
                                    <div>
                                        <label for="lng">Longitude</label>
                                        <input id="lng" type="number" step="0.0001" [(ngModel)]="settings.lng" />
                                    </div>
                                </div>
                            </div>

                            <div class="actions">
                                @if (saved()) {
                                    <span class="saved">✔ Saved</span>
                                }
                                <button class="primary" (click)="saveSettings()">Save changes</button>
                            </div>
                        </section>
                    }
                }
            </div>
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
                min-height: 100vh;
                padding-bottom: 60px;
            }
            .topbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 7vw;
                background: #fff;
                border-bottom: 1px solid #f0e9dd;
                position: sticky;
                top: 0;
                z-index: 10;
            }
            .brand {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .logo {
                font-size: 28px;
            }
            .word {
                font-size: 24px;
                font-weight: 800;
                color: var(--gusto);
                letter-spacing: -0.5px;
            }
            .role {
                color: #8a8275;
                font-size: 14px;
                font-weight: 600;
            }

            .shell {
                max-width: 1000px;
                margin: 24px auto 0;
                padding: 0 7vw;
            }
            .loading {
                text-align: center;
                color: #8a8275;
                padding: 60px 0;
            }

            /* HERO — selfie overlaps the timeline (Facebook-style) */
            .hero {
                background: #fff;
                border: 1px solid #f0e9dd;
                border-radius: 18px;
                box-shadow: 0 12px 30px rgba(120, 60, 30, 0.06);
            }
            .timeline {
                height: 240px;
                background-size: cover;
                background-position: center;
                border-radius: 18px 18px 0 0;
            }
            .profile-bar {
                display: flex;
                align-items: flex-end;
                gap: 18px;
                padding: 0 24px;
                /* pull up so the selfie straddles the timeline's bottom edge */
                margin-top: -50px;
                position: relative;
                z-index: 2; /* paint the selfie on top of the timeline */
            }
            .selfie {
                width: 124px;
                height: 124px;
                border-radius: 50%;
                object-fit: cover;
                border: 5px solid #fff;
                box-shadow: 0 8px 20px rgba(120, 60, 30, 0.18);
                background: #f1ece3;
                flex: none;
            }
            .who {
                flex: 1;
                min-width: 0;
                padding-bottom: 8px;
            }
            .who h1 {
                margin: 0;
                font-size: 26px;
                letter-spacing: -0.5px;
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .byline {
                margin: 4px 0 0;
                color: #6b6457;
                font-size: 15px;
            }
            .bio {
                margin: 16px 0 0;
                padding: 0 24px;
                color: #44403a;
                font-size: 15px;
                line-height: 1.55;
                max-width: 640px;
            }
            .addr {
                margin: 8px 0 0;
                padding: 0 24px 22px;
                color: #6b6457;
                font-size: 14px;
            }
            .verified {
                font-size: 13px;
                font-weight: 700;
                color: #1d7a4a;
                background: #e6f4ec;
                padding: 3px 10px;
                border-radius: 999px;
            }
            .verified.muted {
                color: #8a8275;
                background: #f1ece3;
            }
            .status {
                display: flex;
                gap: 8px;
                padding-bottom: 10px;
                flex-wrap: wrap;
                justify-content: flex-end;
            }
            .pill {
                font-size: 13px;
                font-weight: 600;
                color: #6b6457;
                background: #f1ece3;
                border: 1px solid #e3ddd2;
                border-radius: 999px;
                padding: 6px 12px;
                white-space: nowrap;
            }
            .pill.on {
                color: #1d7a4a;
                background: #e6f4ec;
                border-color: #c4e6d3;
            }

            /* TABS */
            .tabs {
                display: flex;
                gap: 4px;
                background: #fff;
                border: 1px solid #f0e9dd;
                border-radius: 14px;
                margin-top: 14px;
                padding: 8px 12px;
                box-shadow: 0 12px 30px rgba(120, 60, 30, 0.06);
                position: sticky;
                top: 73px;
                z-index: 5;
            }
            .tabs button {
                border: 0;
                background: transparent;
                color: #6b6457;
                font-weight: 700;
                font-size: 15px;
                padding: 10px 16px;
                border-radius: 10px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 7px;
            }
            .tabs button.active {
                background: #fff5ef;
                color: var(--gusto);
                box-shadow: inset 0 0 0 1px #f3d9cc;
            }
            .badge {
                background: #f1ece3;
                color: #6b6457;
                font-size: 12px;
                font-weight: 700;
                border-radius: 999px;
                padding: 1px 8px;
            }
            .badge.alert {
                background: var(--gusto);
                color: #fff;
            }

            .tabpanel {
                margin-top: 28px;
            }
            .section-title {
                font-size: clamp(20px, 2.4vw, 26px);
                margin: 0;
                letter-spacing: -0.5px;
            }
            .section-sub {
                color: #6b6457;
                margin: 6px 0 22px;
            }

            /* MEAL CARDS (Home) */
            .cards {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
                gap: 20px;
            }
            .card {
                background: #fff;
                border: 1px solid #f0e9dd;
                border-radius: 16px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 6px 18px rgba(120, 60, 30, 0.06);
            }
            .card.suspended {
                opacity: 0.62;
            }
            .thumb {
                height: 150px;
                background-size: cover;
                background-position: center;
                position: relative;
            }
            .susp-tag {
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(29, 27, 22, 0.82);
                color: #fff;
                font-size: 12px;
                font-weight: 700;
                padding: 4px 10px;
                border-radius: 999px;
            }
            .body {
                padding: 16px 18px 18px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                flex: 1;
            }
            .card-head {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                gap: 10px;
            }
            .card-head h3 {
                margin: 0;
                font-size: 18px;
                letter-spacing: -0.3px;
            }
            .price {
                font-weight: 800;
                color: var(--gusto);
                white-space: nowrap;
                font-size: 16px;
            }
            .desc {
                margin: 0;
                color: #6b6457;
                font-size: 14px;
                line-height: 1.5;
                flex: 1;
            }
            .rating {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .stars {
                position: relative;
                display: inline-block;
                font-size: 16px;
                line-height: 1;
                letter-spacing: 2px;
            }
            .stars .track {
                color: #e3ddd2;
            }
            .stars .fill {
                position: absolute;
                top: 0;
                left: 0;
                overflow: hidden;
                white-space: nowrap;
                color: #f5a623;
            }
            .score {
                font-weight: 700;
                font-size: 14px;
            }
            .count {
                color: #8a8275;
                font-size: 13px;
            }
            .diets {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }
            .diet {
                background: #f6f1e8;
                border: 1px solid #ecdfd0;
                color: #7a4a36;
                border-radius: 999px;
                padding: 4px 10px;
                font-size: 12px;
                font-weight: 600;
            }

            /* MEALS MANAGEMENT */
            .meal-rows {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 28px;
            }
            .meal-row {
                display: flex;
                align-items: center;
                gap: 14px;
                background: #fff;
                border: 1px solid #f0e9dd;
                border-radius: 14px;
                padding: 12px 14px;
            }
            .meal-row.suspended {
                opacity: 0.66;
            }
            .row-thumb {
                width: 54px;
                height: 54px;
                border-radius: 10px;
                background: #f1ece3;
                background-size: cover;
                background-position: center;
                flex: none;
            }
            .row-main {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;
            }
            .row-sub {
                color: #8a8275;
                font-size: 13px;
            }
            .avail {
                font-size: 13px;
                font-weight: 700;
                color: #1d7a4a;
            }
            .avail.off {
                color: #b3261e;
            }
            .ghost {
                border: 1px solid #e3ddd2;
                background: #fff;
                color: #6b6457;
                font-weight: 600;
                padding: 8px 14px;
                border-radius: 10px;
                cursor: pointer;
                font-size: 14px;
            }
            .add-meal {
                background: #fff;
                border: 1px solid #f0e9dd;
                border-radius: 16px;
                padding: 22px 24px;
                display: flex;
                flex-direction: column;
                gap: 14px;
            }
            .add-meal h3 {
                margin: 0;
                font-size: 18px;
            }
            .grid2 {
                display: flex;
                gap: 14px;
            }
            .grid2 > .field {
                flex: 1;
            }
            .field {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .add-meal label {
                font-size: 13px;
                font-weight: 600;
                color: #44403a;
            }
            .add-meal input,
            .add-meal textarea {
                padding: 11px 13px;
                border: 1px solid #e3ddd2;
                border-radius: 10px;
                font-size: 15px;
                font-family: inherit;
                outline: none;
            }
            .add-meal input:focus,
            .add-meal textarea:focus {
                border-color: var(--gusto);
            }
            .price-row {
                display: flex;
                gap: 8px;
            }
            .price-row .cur {
                width: 64px;
                text-transform: uppercase;
                text-align: center;
            }
            .price-row input[type='number'] {
                flex: 1;
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
            .photo-row {
                display: flex;
                gap: 14px;
                align-items: stretch;
            }
            .photo-preview {
                width: 110px;
                height: 80px;
                border-radius: 10px;
                background: #f1ece3;
                background-size: cover;
                background-position: center;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #b6ab99;
                font-size: 12px;
                flex: none;
            }
            .photo-inputs {
                display: flex;
                flex-direction: column;
                gap: 8px;
                justify-content: center;
                flex: 1;
            }
            .field-inline {
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
            }
            .check {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                color: #44403a;
                font-weight: 600;
            }
            .field-inline .primary {
                margin-left: auto;
            }

            /* ORDERS BOARD */
            .board {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 14px;
            }
            .lane {
                background: #f4efe7;
                border: 1px solid #ece4d7;
                border-radius: 14px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .lane-head {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-weight: 700;
                font-size: 14px;
                color: #44403a;
            }
            .lane-count {
                background: #fff;
                border-radius: 999px;
                padding: 0 8px;
                font-size: 12px;
                color: #6b6457;
            }
            .lane-empty {
                color: #b6ab99;
                font-size: 13px;
                text-align: center;
                margin: 6px 0;
            }
            .order {
                background: #fff;
                border: 1px solid #f0e9dd;
                border-radius: 12px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .order-head {
                display: flex;
                justify-content: space-between;
                gap: 8px;
            }
            .order-total {
                font-weight: 800;
                color: var(--gusto);
                font-size: 14px;
            }
            .order-items {
                margin: 2px 0;
                padding-left: 16px;
                color: #44403a;
                font-size: 13px;
            }
            .order-addr,
            .order-time {
                margin: 0;
                color: #8a8275;
                font-size: 12px;
            }
            .advance {
                margin-top: 6px;
                border: 0;
                background: var(--gusto);
                color: #fff;
                font-weight: 700;
                font-size: 13px;
                padding: 8px;
                border-radius: 9px;
                cursor: pointer;
            }

            /* SETTINGS */
            .settings {
                max-width: 620px;
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            .panel {
                background: #fff;
                border: 1px solid #f0e9dd;
                border-radius: 16px;
                padding: 22px 24px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .panel h3 {
                margin: 0 0 4px;
                font-size: 18px;
            }
            .hint {
                margin: -4px 0 4px;
                color: #6b6457;
                font-size: 14px;
            }
            .panel label {
                font-size: 13px;
                font-weight: 600;
                color: #44403a;
            }
            .panel input,
            .panel textarea {
                padding: 11px 13px;
                border: 1px solid #e3ddd2;
                border-radius: 10px;
                font-size: 15px;
                font-family: inherit;
                outline: none;
            }
            .panel input:focus,
            .panel textarea:focus {
                border-color: var(--gusto);
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
            .switch,
            .verified-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                padding: 6px 0;
            }
            .switch span,
            .verified-row span:first-child {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .switch small,
            .verified-row small {
                color: #8a8275;
                font-weight: 400;
                font-size: 13px;
            }
            .switch input {
                appearance: none;
                width: 46px;
                height: 26px;
                border-radius: 999px;
                background: #e3ddd2;
                position: relative;
                cursor: pointer;
                transition: background 0.15s;
                flex: none;
            }
            .switch input::after {
                content: '';
                position: absolute;
                top: 3px;
                left: 3px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #fff;
                transition: transform 0.15s;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
            }
            .switch input:checked {
                background: var(--gusto);
            }
            .switch input:checked::after {
                transform: translateX(20px);
            }
            .actions {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 14px;
            }
            .saved {
                color: #1d7a4a;
                font-weight: 600;
                font-size: 14px;
            }
            .error {
                color: #b3261e;
                font-size: 14px;
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
                opacity: 0.55;
                cursor: default;
            }

            @media (max-width: 820px) {
                .profile-bar {
                    flex-wrap: wrap;
                }
                .who {
                    flex-basis: 100%;
                }
                .status {
                    justify-content: flex-start;
                    padding-bottom: 0;
                }
                .board {
                    grid-template-columns: 1fr 1fr;
                }
            }
            @media (max-width: 560px) {
                .grid2,
                .photo-row,
                .row {
                    flex-direction: column;
                }
                .board {
                    grid-template-columns: 1fr;
                }
            }
        `,
    ],
})
export class ChefOnboardingComponent {
    private readonly chefService = inject(ChefService);
    private readonly router = inject(Router);

    readonly chef = this.chefService.chef;
    readonly orders = this.chefService.orders;
    readonly onboarded = this.chefService.onboarded;
    readonly tab = signal<Tab>('home');

    readonly allDiets = Object.values(Diet);
    readonly lanes = ORDER_LANES;

    // Meals tab — add form
    form: MealForm = this.blankMeal();
    readonly formError = signal<string | null>(null);
    readonly busy = signal(false);

    // Settings tab
    settings = this.toSettings();
    readonly saved = signal(false);

    readonly fullAddress = computed(() => {
        const a = this.chef().address;
        return [a.line1, a.line2, a.city, a.region, a.postalCode, a.country].filter(Boolean).join(', ');
    });
    readonly newOrderCount = computed(() => this.orders().filter((o) => o.status === OrderStatus.NEW).length);

    constructor() {
        void this.chefService.loadOrders();
        // A chef who hasn't finished the wizard is sent to it (once the API load settles).
        effect(() => {
            if (this.chefService.loaded() && !this.chefService.onboarded()) {
                void this.router.navigate(['/chef/onboarding']);
            }
        });
    }

    dietLabel(d: Diet): string {
        return DIET_LABEL[d];
    }

    priceLabel(meal: { price: number; currency: string }): string {
        return `${this.symbol(meal.currency)}${meal.price}`;
    }

    orderTotal(order: Order): string {
        return `${this.symbol(order.currency)}${order.total}`;
    }

    private symbol(currency: string): string {
        return currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency + ' ';
    }

    // ---- Meals ----
    toggleDiet(d: Diet): void {
        const i = this.form.diets.indexOf(d);
        if (i >= 0) this.form.diets.splice(i, 1);
        else this.form.diets.push(d);
    }

    onPhoto(e: Event): void {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => (this.form.imageUrl = reader.result as string);
        reader.readAsDataURL(file);
    }

    async submitMeal(): Promise<void> {
        const f = this.form;
        if (!f.name.trim() || !f.description.trim() || !f.price || f.price <= 0) {
            this.formError.set('Add a name, description and a price above 0.');
            return;
        }
        this.formError.set(null);
        this.busy.set(true);
        try {
            await this.chefService.addMeal({
                name: f.name.trim(),
                description: f.description.trim(),
                price: Number(f.price),
                currency: (f.currency || 'ILS').toUpperCase(),
                diets: f.diets,
                imageUrl: f.imageUrl || undefined,
                available: f.available,
                kosher: false,
                allergens: [],
            });
            this.form = this.blankMeal();
        } finally {
            this.busy.set(false);
        }
    }

    toggleAvailable(meal: Meal): void {
        void this.chefService.setMealAvailable(meal.id, !meal.available);
    }

    // ---- Orders ----
    ordersIn(status: OrderStatus): Order[] {
        return this.orders().filter((o) => o.status === status);
    }

    nextStatus(status: OrderStatus): OrderStatus | null {
        const order = [OrderStatus.NEW, OrderStatus.IN_PREPARATION, OrderStatus.ON_THE_WAY, OrderStatus.DELIVERED];
        const i = order.indexOf(status);
        return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
    }

    advanceLabel(next: OrderStatus): string {
        switch (next) {
            case OrderStatus.IN_PREPARATION:
                return 'Start preparing →';
            case OrderStatus.ON_THE_WAY:
                return 'Send with Gus →';
            case OrderStatus.DELIVERED:
                return 'Mark delivered →';
            default:
                return 'Advance →';
        }
    }

    advance(order: Order, next: OrderStatus): void {
        void this.chefService.setOrderStatus(order.id, next);
    }

    // ---- Settings ----
    onActive(e: Event): void {
        this.chefService.setActive((e.target as HTMLInputElement).checked);
    }

    onAcceptingOrders(e: Event): void {
        this.chefService.setAcceptingOrders((e.target as HTMLInputElement).checked);
    }

    async saveSettings(): Promise<void> {
        const s = this.settings;
        await this.chefService.saveProfile({
            name: s.name,
            kitchenName: s.kitchenName,
            bio: s.bio,
            selfieUrl: s.selfieUrl,
            timelineUrl: s.timelineUrl,
            address: {
                line1: s.line1,
                city: s.city,
                region: s.region || undefined,
                postalCode: s.postalCode || undefined,
                country: (s.country || 'IL').toUpperCase(),
            },
            location: { lat: Number(s.lat), lng: Number(s.lng) },
        });
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2000);
    }

    private blankMeal(): MealForm {
        return { name: '', description: '', price: null, currency: 'ILS', imageUrl: '', available: true, diets: [] };
    }

    private toSettings() {
        const c = this.chefService.chef();
        return {
            name: c.name,
            kitchenName: c.kitchenName,
            bio: c.bio,
            selfieUrl: c.selfieUrl,
            timelineUrl: c.timelineUrl,
            line1: c.address.line1,
            city: c.address.city,
            region: c.address.region ?? '',
            postalCode: c.address.postalCode ?? '',
            country: c.address.country,
            lat: c.location.lat,
            lng: c.location.lng,
        };
    }
}

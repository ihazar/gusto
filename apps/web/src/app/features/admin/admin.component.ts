import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AdminChef } from '@gusto/contracts';
import { AdminService } from '../../core/admin/admin.service';
import { AuthService } from '../../core/auth/auth.service';

type Tab = 'chefs' | 'orders' | 'couriers';

@Component({
    selector: 'app-admin',
    standalone: true,
    imports: [DatePipe],
    template: `
        <div class="page">
            <header class="topbar">
                <div class="brand">
                    <span class="logo">🍳</span><span class="word">Gusto</span><span class="ops">Ops</span>
                </div>
                <button class="link" (click)="signOut()">Sign out</button>
            </header>

            <div class="shell">
                @if (stats(); as s) {
                    <div class="stats">
                        <div>
                            <span class="v">{{ s.chefs }}</span
                            ><span class="l">Chefs</span>
                        </div>
                        <div>
                            <span class="v">{{ s.activeChefs }}</span
                            ><span class="l">Active</span>
                        </div>
                        <div>
                            <span class="v warn">{{ s.pendingVerification }}</span
                            ><span class="l">Unverified</span>
                        </div>
                        <div>
                            <span class="v">{{ s.couriers }}</span
                            ><span class="l">Couriers</span>
                        </div>
                        <div>
                            <span class="v">{{ s.delivered }}/{{ s.orders }}</span
                            ><span class="l">Delivered/Orders</span>
                        </div>
                        <div>
                            <span class="v">₪{{ s.gmv }}</span
                            ><span class="l">GMV</span>
                        </div>
                    </div>
                }

                <nav class="tabs">
                    <button [class.active]="tab() === 'chefs'" (click)="tab.set('chefs')">Chefs</button>
                    <button [class.active]="tab() === 'orders'" (click)="tab.set('orders')">Orders</button>
                    <button [class.active]="tab() === 'couriers'" (click)="tab.set('couriers')">Couriers</button>
                </nav>

                @if (tab() === 'chefs') {
                    <table class="grid">
                        <thead>
                            <tr>
                                <th>Kitchen</th>
                                <th>City</th>
                                <th>Rating</th>
                                <th>Dishes</th>
                                <th>Orders</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            @for (c of chefs(); track c.id) {
                                <tr>
                                    <td>
                                        <strong>{{ c.kitchenName || '—' }}</strong
                                        ><br /><span class="muted">{{ c.name }}</span>
                                    </td>
                                    <td>{{ c.city || '—' }}</td>
                                    <td>{{ c.ratingCount ? '★ ' + c.rating + ' (' + c.ratingCount + ')' : '—' }}</td>
                                    <td>{{ c.dishCount }}</td>
                                    <td>{{ c.orderCount }}</td>
                                    <td>
                                        <span class="pill" [class.on]="c.verified">{{
                                            c.verified ? '✔ Verified' : 'Unverified'
                                        }}</span>
                                        <span class="pill" [class.on]="c.active">{{
                                            c.active ? 'Live' : 'Suspended'
                                        }}</span>
                                    </td>
                                    <td class="actions">
                                        <button (click)="toggleVerified(c)">
                                            {{ c.verified ? 'Unverify' : 'Verify' }}
                                        </button>
                                        <button class="danger" (click)="toggleActive(c)">
                                            {{ c.active ? 'Suspend' : 'Reactivate' }}
                                        </button>
                                    </td>
                                </tr>
                            }
                            @if (chefs().length === 0) {
                                <tr>
                                    <td colspan="7" class="muted center">No chefs yet.</td>
                                </tr>
                            }
                        </tbody>
                    </table>
                }

                @if (tab() === 'orders') {
                    <table class="grid">
                        <thead>
                            <tr>
                                <th>Kitchen</th>
                                <th>Customer</th>
                                <th>Status</th>
                                <th>Total</th>
                                <th>Placed</th>
                            </tr>
                        </thead>
                        <tbody>
                            @for (o of orders(); track o.id) {
                                <tr>
                                    <td>{{ o.kitchenName }}</td>
                                    <td>{{ o.customerName }}</td>
                                    <td>
                                        <span class="pill">{{ o.status }}</span>
                                    </td>
                                    <td>₪{{ o.total }}</td>
                                    <td class="muted">{{ o.placedAt | date: 'short' }}</td>
                                </tr>
                            }
                            @if (orders().length === 0) {
                                <tr>
                                    <td colspan="5" class="muted center">No orders yet.</td>
                                </tr>
                            }
                        </tbody>
                    </table>
                }

                @if (tab() === 'couriers') {
                    <table class="grid">
                        <thead>
                            <tr>
                                <th>Courier</th>
                                <th>Vehicle</th>
                                <th>Status</th>
                                <th>Deliveries</th>
                                <th>Earnings</th>
                            </tr>
                        </thead>
                        <tbody>
                            @for (c of couriers(); track c.id) {
                                <tr>
                                    <td>{{ c.displayName }}</td>
                                    <td>{{ c.vehicle }}</td>
                                    <td>
                                        <span class="pill" [class.on]="c.online">{{
                                            c.online ? 'Online' : 'Offline'
                                        }}</span>
                                    </td>
                                    <td>{{ c.deliveredCount }}</td>
                                    <td>₪{{ c.earnings }}</td>
                                </tr>
                            }
                            @if (couriers().length === 0) {
                                <tr>
                                    <td colspan="5" class="muted center">No couriers yet.</td>
                                </tr>
                            }
                        </tbody>
                    </table>
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
                min-height: 100vh;
                color: #1d1b16;
            }
            .topbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 5vw;
                background: #fff;
                border-bottom: 1px solid #f0e9dd;
            }
            .brand {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .logo {
                font-size: 24px;
            }
            .word {
                font-size: 22px;
                font-weight: 800;
                color: var(--gusto);
            }
            .ops {
                background: #1d1b16;
                color: #fff;
                font-size: 12px;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: 6px;
            }
            .link {
                border: 1px solid #e3ddd2;
                background: #fff;
                color: #6b6457;
                border-radius: 10px;
                padding: 8px 14px;
                font-weight: 600;
                cursor: pointer;
            }
            .shell {
                max-width: 1100px;
                margin: 24px auto;
                padding: 0 5vw;
            }
            .stats {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 12px;
                margin-bottom: 22px;
            }
            .stats > div {
                background: #fff;
                border: 1px solid #f0e9dd;
                border-radius: 14px;
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .v {
                font-size: 22px;
                font-weight: 800;
            }
            .v.warn {
                color: #b3261e;
            }
            .l {
                font-size: 12px;
                color: #8a8275;
            }
            .tabs {
                display: flex;
                gap: 6px;
                margin-bottom: 16px;
            }
            .tabs button {
                border: 1px solid #e3ddd2;
                background: #fff;
                color: #6b6457;
                font-weight: 700;
                padding: 9px 18px;
                border-radius: 10px;
                cursor: pointer;
            }
            .tabs button.active {
                background: var(--gusto);
                color: #fff;
                border-color: transparent;
            }
            .grid {
                width: 100%;
                border-collapse: collapse;
                background: #fff;
                border: 1px solid #f0e9dd;
                border-radius: 14px;
                overflow: hidden;
            }
            .grid th,
            .grid td {
                text-align: left;
                padding: 12px 14px;
                border-bottom: 1px solid #f3eee5;
                font-size: 14px;
                vertical-align: middle;
            }
            .grid th {
                background: #f6f1e8;
                color: #6b6457;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.4px;
            }
            .muted {
                color: #8a8275;
            }
            .center {
                text-align: center;
            }
            .pill {
                display: inline-block;
                background: #f1ece3;
                color: #6b6457;
                border-radius: 999px;
                padding: 3px 10px;
                font-size: 12px;
                font-weight: 600;
                margin-right: 4px;
            }
            .pill.on {
                background: #e6f4ec;
                color: #1d7a4a;
            }
            .actions {
                white-space: nowrap;
            }
            .actions button {
                border: 1px solid #e3ddd2;
                background: #fff;
                color: #44403a;
                border-radius: 9px;
                padding: 7px 12px;
                font-weight: 600;
                cursor: pointer;
                margin-left: 6px;
            }
            .actions button.danger {
                color: #b3261e;
            }
            @media (max-width: 760px) {
                .stats {
                    grid-template-columns: repeat(3, 1fr);
                }
            }
        `,
    ],
})
export class AdminComponent {
    private readonly admin = inject(AdminService);
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);

    readonly stats = this.admin.stats;
    readonly chefs = this.admin.chefs;
    readonly orders = this.admin.orders;
    readonly couriers = this.admin.couriers;
    readonly tab = signal<Tab>('chefs');

    constructor() {
        void this.admin.loadAll();
    }

    toggleVerified(c: AdminChef): void {
        void this.admin.setVerified(c.id, !c.verified);
    }

    toggleActive(c: AdminChef): void {
        void this.admin.setActive(c.id, !c.active);
    }

    async signOut(): Promise<void> {
        await this.auth.logout();
        await this.router.navigate(['/']);
    }
}

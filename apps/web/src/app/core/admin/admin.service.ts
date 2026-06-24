import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AdminChef, AdminCourier, AdminOrder, AdminStats } from '@gusto/contracts';
import { environment } from '../../../environments/environment';

/** Loads + mutates ops-console data. The auth interceptor adds the bearer token. */
@Injectable({ providedIn: 'root' })
export class AdminService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/admin`;

    private readonly statsState = signal<AdminStats | null>(null);
    private readonly chefsState = signal<AdminChef[]>([]);
    private readonly ordersState = signal<AdminOrder[]>([]);
    private readonly couriersState = signal<AdminCourier[]>([]);

    readonly stats = computed(() => this.statsState());
    readonly chefs = computed(() => this.chefsState());
    readonly orders = computed(() => this.ordersState());
    readonly couriers = computed(() => this.couriersState());

    async loadAll(): Promise<void> {
        const [stats, chefs, orders, couriers] = await Promise.all([
            firstValueFrom(this.http.get<AdminStats>(`${this.base}/stats`)),
            firstValueFrom(this.http.get<AdminChef[]>(`${this.base}/chefs`)),
            firstValueFrom(this.http.get<AdminOrder[]>(`${this.base}/orders`)),
            firstValueFrom(this.http.get<AdminCourier[]>(`${this.base}/couriers`)),
        ]);
        this.statsState.set(stats);
        this.chefsState.set(chefs);
        this.ordersState.set(orders);
        this.couriersState.set(couriers);
    }

    async setVerified(id: string, verified: boolean): Promise<void> {
        this.chefsState.set(
            await firstValueFrom(this.http.post<AdminChef[]>(`${this.base}/chefs/${id}/verify`, { verified })),
        );
        await this.refreshStats();
    }

    async setActive(id: string, active: boolean): Promise<void> {
        this.chefsState.set(
            await firstValueFrom(this.http.post<AdminChef[]>(`${this.base}/chefs/${id}/active`, { active })),
        );
        await this.refreshStats();
    }

    private async refreshStats(): Promise<void> {
        this.statsState.set(await firstValueFrom(this.http.get<AdminStats>(`${this.base}/stats`)));
    }
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
    Chef,
    ChefEarnings,
    CreateMealDto,
    Diet,
    OnboardingDto,
    Order,
    OrderStatus,
    UpdateChefProfileDto,
    UpdateChefSettingsDto,
    UpdateMealDto,
} from '@gusto/contracts';
import { environment } from '../../../environments/environment';

/**
 * Holds the signed-in chef's onboarding profile.
 *
 * The API (GET/PATCH /chef/me) is the source of truth. To keep the UI snappy
 * and usable offline, edits are applied optimistically to a local signal and
 * mirrored to localStorage, then synced to the server best-effort. If the API
 * is unreachable the seed/cached profile is used so onboarding still works.
 */

const STORAGE_KEY = 'gusto.chef';

function seedChef(): Chef {
    return {
        id: 'me',
        name: 'Maya Cohen',
        kitchenName: "Maya's Levantine Table",
        bio: 'Home-cook from Florentin. I make the mezze and slow-cooked stews I grew up on — everything is made to order in my own kitchen, never frozen.',
        selfieUrl: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&h=400&fit=crop',
        timelineUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1600&h=500&fit=crop',
        address: {
            line1: '14 Vital St',
            city: 'Tel Aviv-Yafo',
            region: 'Tel Aviv District',
            postalCode: '6603714',
            country: 'IL',
        },
        location: { lat: 32.0556, lng: 34.7686 },
        onboarded: true,
        verified: true,
        active: true,
        acceptingOrders: true,
        meals: [
            {
                id: 'm1',
                name: 'Slow-cooked lamb hummus',
                description: 'Stone-ground chickpea hummus topped with 6-hour braised lamb, pine nuts and warm pita.',
                rating: 4.8,
                ratingCount: 132,
                price: 52,
                currency: 'ILS',
                diets: [Diet.HALAL],
                imageUrl: 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?w=600&h=400&fit=crop',
                available: true,
            },
            {
                id: 'm2',
                name: 'Roasted aubergine sabich bowl',
                description: 'Smoky roasted aubergine, soft egg, amba, tahini and Israeli salad over herbed rice.',
                rating: 4.6,
                ratingCount: 88,
                price: 44,
                currency: 'ILS',
                diets: [Diet.VEGETARIAN, Diet.GLUTEN_FREE],
                imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop',
                available: true,
            },
            {
                id: 'm3',
                name: 'Green shakshuka',
                description: 'Chard, spinach, leek and feta simmered with eggs and za’atar. Comes with sourdough.',
                rating: 4.9,
                ratingCount: 201,
                price: 39,
                currency: 'ILS',
                diets: [Diet.VEGETARIAN, Diet.KETO, Diet.NUT_FREE],
                imageUrl: 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=600&h=400&fit=crop',
                available: true,
            },
            {
                id: 'm4',
                name: 'Vegan mujadara',
                description: 'Lentils and caramelised onions over spiced rice, with a cucumber-mint salad on the side.',
                rating: 4.4,
                ratingCount: 47,
                price: 36,
                currency: 'ILS',
                diets: [Diet.VEGAN, Diet.DAIRY_FREE, Diet.NUT_FREE],
                imageUrl: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=600&h=400&fit=crop',
                available: false,
            },
        ],
    };
}

@Injectable({ providedIn: 'root' })
export class ChefService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/chef`;
    private readonly state = signal<Chef>(this.restore());

    constructor() {
        // Adopt the server's profile in the background; ignore failures so the
        // cached/seed profile keeps working when the API is down or signed-out.
        void this.refresh();
    }

    private readonly ordersState = signal<Order[]>([]);
    private readonly earningsState = signal<ChefEarnings | null>(null);
    private readonly loadedState = signal(false);

    /** The current chef profile. */
    readonly chef = computed(() => this.state());
    /** Meals shown as cards on the profile. */
    readonly meals = computed(() => this.state().meals);
    /** Customer orders for the Orders tab. */
    readonly orders = computed(() => this.ordersState());
    /** Chef earnings summary (payouts). */
    readonly earnings = computed(() => this.earningsState());
    /** True once the first API load has settled (so routing can trust `onboarded`). */
    readonly loaded = computed(() => this.loadedState());
    /** Whether the chef has finished the onboarding wizard. */
    readonly onboarded = computed(() => this.state().onboarded);

    /** Pull the authoritative profile from the API, if reachable. */
    async refresh(): Promise<void> {
        try {
            const chef = await firstValueFrom(this.http.get<Chef>(`${this.base}/me`));
            this.persist(chef);
        } catch {
            // offline or not authenticated — keep the local profile
        } finally {
            this.loadedState.set(true);
        }
    }

    /** Finish onboarding: publish the profile + first dishes, then go live. */
    async completeOnboarding(dto: OnboardingDto): Promise<void> {
        try {
            const chef = await firstValueFrom(this.http.post<Chef>(`${this.base}/me/onboarding/complete`, dto));
            this.persist(chef);
        } catch {
            // offline: apply locally so the chef still reaches their page
            const meals = dto.meals.map((m, i) => ({
                ...m,
                id: `local_${Date.now()}_${i}`,
                rating: 0,
                ratingCount: 0,
                diets: m.diets ?? [],
                available: m.available ?? true,
            })) as Chef['meals'];
            this.persist({
                ...this.state(),
                ...dto,
                meals,
                onboarded: true,
                active: true,
                acceptingOrders: true,
            });
        }
    }

    /** Load the chef's orders + earnings from the API. */
    async loadOrders(): Promise<void> {
        try {
            const [orders, earnings] = await Promise.all([
                firstValueFrom(this.http.get<Order[]>(`${this.base}/me/orders`)),
                firstValueFrom(this.http.get<ChefEarnings>(`${this.base}/me/earnings`)),
            ]);
            this.ordersState.set(orders);
            this.earningsState.set(earnings);
        } catch {
            // offline — leave whatever we have
        }
    }

    /** Reject a new order (refunds the customer). */
    rejectOrder(id: string): Promise<void> {
        return this.setOrderStatus(id, OrderStatus.CANCELLED);
    }

    /** Save the editable profile fields (Settings → "Save changes"). */
    async saveProfile(patch: UpdateChefProfileDto): Promise<void> {
        this.persist({
            ...this.state(),
            ...patch,
            address: patch.address ?? this.state().address,
            location: patch.location ?? this.state().location,
        });
        await this.patch('/me', patch);
    }

    /** Toggle whether the profile is live to customers. */
    setActive(active: boolean): void {
        this.persist({ ...this.state(), active });
        void this.patch('/me/settings', { active });
    }

    /** Toggle whether the chef is taking new orders right now. */
    setAcceptingOrders(acceptingOrders: boolean): void {
        this.persist({ ...this.state(), acceptingOrders });
        void this.patch('/me/settings', { acceptingOrders });
    }

    /** Add a meal to the menu. */
    async addMeal(input: CreateMealDto): Promise<void> {
        try {
            const chef = await firstValueFrom(this.http.post<Chef>(`${this.base}/me/meals`, input));
            this.persist(chef);
        } catch {
            // offline: append locally so the UI still reflects the change
            const meal = {
                ...input,
                id: `local_${Date.now()}`,
                rating: 0,
                ratingCount: 0,
                diets: input.diets ?? [],
                available: input.available ?? true,
            } as Chef['meals'][number];
            this.persist({ ...this.state(), meals: [...this.state().meals, meal] });
        }
    }

    /** Edit a meal (e.g. suspend it with `{ available: false }`). */
    async updateMeal(id: string, patch: UpdateMealDto): Promise<void> {
        this.persist({
            ...this.state(),
            meals: this.state().meals.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        });
        try {
            const chef = await firstValueFrom(this.http.patch<Chef>(`${this.base}/me/meals/${id}`, patch));
            this.persist(chef);
        } catch {
            // keep the optimistic local change
        }
    }

    /** Suspend/unsuspend a meal. */
    setMealAvailable(id: string, available: boolean): Promise<void> {
        return this.updateMeal(id, { available });
    }

    /** Move an order to a new status (refreshes earnings on capture/refund). */
    async setOrderStatus(id: string, status: OrderStatus): Promise<void> {
        this.ordersState.update((os) => os.map((o) => (o.id === id ? { ...o, status } : o)));
        try {
            const orders = await firstValueFrom(this.http.patch<Order[]>(`${this.base}/me/orders/${id}`, { status }));
            this.ordersState.set(orders);
            if (status === OrderStatus.DELIVERED || status === OrderStatus.CANCELLED) {
                this.earningsState.set(await firstValueFrom(this.http.get<ChefEarnings>(`${this.base}/me/earnings`)));
            }
        } catch {
            // keep the optimistic local change
        }
    }

    /** PATCH the server and adopt its response; stay optimistic if it fails. */
    private async patch(
        path: '/me' | '/me/settings',
        body: UpdateChefProfileDto | UpdateChefSettingsDto,
    ): Promise<void> {
        try {
            const chef = await firstValueFrom(this.http.patch<Chef>(`${this.base}${path}`, body));
            this.persist(chef);
        } catch {
            // keep the optimistic local change
        }
    }

    private persist(chef: Chef): void {
        this.state.set(chef);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chef));
    }

    private restore(): Chef {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Chef) : seedChef();
    }
}

import { Injectable } from '@nestjs/common';
import {
    Chef,
    CreateMealDto,
    Meal,
    OnboardingDto,
    Order,
    OrderStatus,
    UpdateChefProfileDto,
    UpdateChefSettingsDto,
    UpdateMealDto,
} from '@gusto/contracts';

/**
 * In-memory chef store for onboarding.
 *
 * Phase 0 of Gusto is auth-only; the chef/menu Prisma models land in a later
 * phase (see prisma/schema.prisma). Until then this keeps each authenticated
 * user's chef profile in memory so the web onboarding flow has a real API to
 * talk to. The public surface matches what a Prisma-backed repository will
 * expose, so swapping the storage out later is a drop-in change.
 */
@Injectable()
export class ChefService {
    private readonly byUserId = new Map<string, Chef>();
    private readonly ordersByUserId = new Map<string, Order[]>();
    private seq = 0;

    /** The caller's chef profile, seeded on first access. */
    getForUser(userId: string): Chef {
        let chef = this.byUserId.get(userId);
        if (!chef) {
            chef = seedChef(userId);
            this.byUserId.set(userId, chef);
        }
        return chef;
    }

    /** Finish the onboarding wizard: fill the profile, add dishes, go live. */
    completeOnboarding(userId: string, dto: OnboardingDto): Chef {
        const current = this.getForUser(userId);
        const meals: Meal[] = dto.meals.map((m) => this.buildMeal(userId, m));
        const next: Chef = {
            ...current,
            name: dto.name,
            kitchenName: dto.kitchenName,
            bio: dto.bio,
            selfieUrl: dto.selfieUrl,
            timelineUrl: dto.timelineUrl,
            address: dto.address,
            location: dto.location,
            meals,
            onboarded: true,
            active: true,
            acceptingOrders: true,
        };
        this.byUserId.set(userId, next);
        return next;
    }

    /** Patch editable profile fields. Unknown/absent fields are left untouched. */
    updateProfile(userId: string, patch: UpdateChefProfileDto): Chef {
        const current = this.getForUser(userId);
        const next: Chef = {
            ...current,
            ...patch,
            address: patch.address ?? current.address,
            location: patch.location ?? current.location,
        };
        this.byUserId.set(userId, next);
        return next;
    }

    /** Flip availability toggles (active / accepting orders). */
    updateSettings(userId: string, patch: UpdateChefSettingsDto): Chef {
        const current = this.getForUser(userId);
        const next: Chef = {
            ...current,
            active: patch.active ?? current.active,
            acceptingOrders: patch.acceptingOrders ?? current.acceptingOrders,
        };
        this.byUserId.set(userId, next);
        return next;
    }

    /** Add a meal to the chef's menu; returns the updated profile. */
    addMeal(userId: string, input: CreateMealDto): Chef {
        const chef = this.getForUser(userId);
        const next: Chef = { ...chef, meals: [...chef.meals, this.buildMeal(userId, input)] };
        this.byUserId.set(userId, next);
        return next;
    }

    /** Turn a meal input into a stored Meal with a fresh id and zeroed ratings. */
    private buildMeal(userId: string, input: CreateMealDto): Meal {
        return {
            id: `m_${++this.seq}_${userId.slice(-4)}`,
            name: input.name,
            description: input.description,
            price: input.price,
            currency: input.currency,
            diets: input.diets,
            imageUrl: input.imageUrl,
            available: input.available,
            rating: 0,
            ratingCount: 0,
        };
    }

    /** Edit a meal (including suspending it via available: false). */
    updateMeal(userId: string, mealId: string, patch: UpdateMealDto): Chef {
        const chef = this.getForUser(userId);
        const next: Chef = {
            ...chef,
            meals: chef.meals.map((m) => (m.id === mealId ? { ...m, ...patch } : m)),
        };
        this.byUserId.set(userId, next);
        return next;
    }

    /** The caller's orders, seeded on first access. */
    listOrders(userId: string): Order[] {
        let orders = this.ordersByUserId.get(userId);
        if (!orders) {
            orders = seedOrders();
            this.ordersByUserId.set(userId, orders);
        }
        return orders;
    }

    /** Move an order to a new status; returns the full list. */
    updateOrderStatus(userId: string, orderId: string, status: OrderStatus): Order[] {
        const orders = this.listOrders(userId).map((o) => (o.id === orderId ? { ...o, status } : o));
        this.ordersByUserId.set(userId, orders);
        return orders;
    }
}

/**
 * A blank, un-onboarded profile for a brand-new chef. The web app sees
 * `onboarded: false` and sends them through the onboarding wizard, which fills
 * these fields in and flips the flag. Keyed to the caller's user id.
 */
function seedChef(userId: string): Chef {
    return {
        id: userId,
        name: '',
        kitchenName: '',
        bio: '',
        // Neutral placeholders so the dashboard isn't broken before photos are set.
        selfieUrl: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&h=400&fit=crop',
        timelineUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1600&h=500&fit=crop',
        address: { line1: '', city: '', country: 'IL' },
        location: { lat: 32.0853, lng: 34.7818 },
        onboarded: false,
        verified: false,
        active: false,
        acceptingOrders: false,
        meals: [],
    };
}

/** Demo orders so the Orders tab has something in each lane. */
function seedOrders(): Order[] {
    return [
        {
            id: 'o1',
            customerName: 'Daniel R.',
            items: [{ mealId: 'm1', name: 'Slow-cooked lamb hummus', qty: 2, price: 52 }],
            total: 104,
            currency: 'ILS',
            status: OrderStatus.NEW,
            placedAt: '2026-06-16T11:40:00.000Z',
            deliveryAddress: '8 Rothschild Blvd, Tel Aviv-Yafo',
        },
        {
            id: 'o2',
            customerName: 'Noa B.',
            items: [
                { mealId: 'm3', name: 'Green shakshuka', qty: 1, price: 39 },
                { mealId: 'm2', name: 'Roasted aubergine sabich bowl', qty: 1, price: 44 },
            ],
            total: 83,
            currency: 'ILS',
            status: OrderStatus.IN_PREPARATION,
            placedAt: '2026-06-16T11:15:00.000Z',
            deliveryAddress: '22 Dizengoff St, Tel Aviv-Yafo',
        },
        {
            id: 'o3',
            customerName: 'Yossi K.',
            items: [{ mealId: 'm3', name: 'Green shakshuka', qty: 3, price: 39 }],
            total: 117,
            currency: 'ILS',
            status: OrderStatus.ON_THE_WAY,
            placedAt: '2026-06-16T10:50:00.000Z',
            deliveryAddress: '5 Allenby St, Tel Aviv-Yafo',
        },
        {
            id: 'o4',
            customerName: 'Maya L.',
            items: [{ mealId: 'm1', name: 'Slow-cooked lamb hummus', qty: 1, price: 52 }],
            total: 52,
            currency: 'ILS',
            status: OrderStatus.DELIVERED,
            placedAt: '2026-06-16T09:30:00.000Z',
            deliveryAddress: '14 Florentin St, Tel Aviv-Yafo',
        },
    ];
}

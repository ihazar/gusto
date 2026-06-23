import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
    Chef,
    CreateMealDto,
    OnboardingDto,
    Order,
    OrderStatus,
    UpdateChefProfileDto,
    UpdateChefSettingsDto,
    UpdateMealDto,
} from '@gusto/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { MENU_INCLUDE, ProfileWithMenu, toChef } from './chef.mapper';

/**
 * Persists each chef's profile + menu in Postgres (Prisma). A chef profile is
 * created lazily on first access (blank + un-onboarded) so the onboarding
 * wizard has something to fill in. Orders are still demo data in memory — they
 * become real in M3 (cart/checkout).
 */
@Injectable()
export class ChefService {
    private readonly ordersByUserId = new Map<string, Order[]>();

    constructor(private readonly prisma: PrismaService) {}

    /** The caller's chef profile, created blank on first access. */
    async getForUser(userId: string): Promise<Chef> {
        return toChef(await this.ensureProfile(userId));
    }

    /** Finish the onboarding wizard: fill the profile, add dishes, go live. */
    async completeOnboarding(userId: string, dto: OnboardingDto): Promise<Chef> {
        await this.ensureProfile(userId);
        const profile = await this.prisma.chefProfile.update({
            where: { userId },
            data: {
                name: dto.name,
                kitchenName: dto.kitchenName,
                bio: dto.bio,
                selfieUrl: dto.selfieUrl,
                timelineUrl: dto.timelineUrl,
                ...addressData(dto.address),
                lat: dto.location.lat,
                lng: dto.location.lng,
                onboarded: true,
                active: true,
                acceptingOrders: true,
                dishes: { create: dto.meals.map(dishCreateData) },
            },
            include: MENU_INCLUDE,
        });
        return toChef(profile);
    }

    /** Patch editable profile fields. Absent fields are left untouched. */
    async updateProfile(userId: string, patch: UpdateChefProfileDto): Promise<Chef> {
        await this.ensureProfile(userId);
        const data: Prisma.ChefProfileUpdateInput = {};
        if (patch.name !== undefined) data.name = patch.name;
        if (patch.kitchenName !== undefined) data.kitchenName = patch.kitchenName;
        if (patch.bio !== undefined) data.bio = patch.bio;
        if (patch.selfieUrl !== undefined) data.selfieUrl = patch.selfieUrl;
        if (patch.timelineUrl !== undefined) data.timelineUrl = patch.timelineUrl;
        if (patch.address) Object.assign(data, addressData(patch.address));
        if (patch.location) {
            data.lat = patch.location.lat;
            data.lng = patch.location.lng;
        }
        const profile = await this.prisma.chefProfile.update({ where: { userId }, data, include: MENU_INCLUDE });
        return toChef(profile);
    }

    /** Flip availability toggles (active / accepting orders). */
    async updateSettings(userId: string, patch: UpdateChefSettingsDto): Promise<Chef> {
        await this.ensureProfile(userId);
        const data: Prisma.ChefProfileUpdateInput = {};
        if (patch.active !== undefined) data.active = patch.active;
        if (patch.acceptingOrders !== undefined) data.acceptingOrders = patch.acceptingOrders;
        const profile = await this.prisma.chefProfile.update({ where: { userId }, data, include: MENU_INCLUDE });
        return toChef(profile);
    }

    /** Add a meal to the chef's menu. */
    async addMeal(userId: string, input: CreateMealDto): Promise<Chef> {
        const profile = await this.ensureProfile(userId);
        await this.prisma.dish.create({ data: { chefProfileId: profile.id, ...dishCreateData(input) } });
        return this.getForUser(userId);
    }

    /** Edit a meal (including suspending it via available: false). */
    async updateMeal(userId: string, mealId: string, patch: UpdateMealDto): Promise<Chef> {
        await this.ensureProfile(userId);
        // updateMany with a relation filter scopes the edit to this chef's dishes.
        await this.prisma.dish.updateMany({ where: { id: mealId, chef: { userId } }, data: dishUpdateData(patch) });
        return this.getForUser(userId);
    }

    /** The caller's orders, seeded on first access (demo until M3). */
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

    /** Find or lazily create the caller's (blank) chef profile. */
    private ensureProfile(userId: string): Promise<ProfileWithMenu> {
        return this.prisma.chefProfile.upsert({
            where: { userId },
            create: { userId },
            update: {},
            include: MENU_INCLUDE,
        });
    }
}

// ── mappers ───────────────────────────────────────────────────────────────

function addressData(a: {
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode?: string;
    country: string;
}) {
    return {
        addressLine1: a.line1,
        addressLine2: a.line2 ?? null,
        city: a.city,
        region: a.region ?? null,
        postalCode: a.postalCode ?? null,
        country: a.country,
    };
}

function dishCreateData(input: CreateMealDto): Prisma.DishCreateWithoutChefInput {
    return {
        name: input.name,
        description: input.description,
        price: input.price,
        currency: input.currency,
        imageUrl: input.imageUrl ?? null,
        available: input.available,
        category: input.category ?? null,
        prepMinutes: input.prepMinutes ?? null,
        kosher: input.kosher,
        diets: input.diets,
        allergens: input.allergens,
    };
}

function dishUpdateData(patch: UpdateMealDto): Prisma.DishUpdateManyMutationInput {
    const data: Prisma.DishUpdateManyMutationInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.price !== undefined) data.price = patch.price;
    if (patch.currency !== undefined) data.currency = patch.currency;
    if (patch.imageUrl !== undefined) data.imageUrl = patch.imageUrl;
    if (patch.available !== undefined) data.available = patch.available;
    if (patch.category !== undefined) data.category = patch.category;
    if (patch.prepMinutes !== undefined) data.prepMinutes = patch.prepMinutes;
    if (patch.kosher !== undefined) data.kosher = patch.kosher;
    if (patch.diets !== undefined) data.diets = patch.diets;
    if (patch.allergens !== undefined) data.allergens = patch.allergens;
    return data;
}

/** Demo orders so the Orders tab has something in each lane (until M3). */
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

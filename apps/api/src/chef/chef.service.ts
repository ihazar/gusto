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
import { ORDER_INCLUDE, toOrder } from '../orders/orders.mapper';

/**
 * Persists each chef's profile + menu in Postgres (Prisma). A chef profile is
 * created lazily on first access (blank + un-onboarded) so the onboarding
 * wizard has something to fill in. The chef's order queue reads real customer
 * orders (placed via M3 checkout).
 */
@Injectable()
export class ChefService {
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

    /** The caller's incoming orders (newest first). */
    async listOrders(userId: string): Promise<Order[]> {
        const profile = await this.prisma.chefProfile.findUnique({ where: { userId }, select: { id: true } });
        if (!profile) return [];
        const rows = await this.prisma.order.findMany({
            where: { chefProfileId: profile.id },
            orderBy: { placedAt: 'desc' },
            include: ORDER_INCLUDE,
        });
        return rows.map(toOrder);
    }

    /** Move one of the chef's orders to a new status; returns the full list. */
    async updateOrderStatus(userId: string, orderId: string, status: OrderStatus): Promise<Order[]> {
        const profile = await this.prisma.chefProfile.findUnique({ where: { userId }, select: { id: true } });
        if (profile) {
            await this.prisma.order.updateMany({ where: { id: orderId, chefProfileId: profile.id }, data: { status } });
        }
        return this.listOrders(userId);
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

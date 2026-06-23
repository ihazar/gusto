import { Injectable, NotFoundException } from '@nestjs/common';
import { Dish as PDish } from '@prisma/client';
import { CatalogQuery, Diet, distanceKm, KitchenDetail, KitchenSummary } from '@gusto/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { MENU_INCLUDE, toChef } from '../chef/chef.mapper';

/**
 * Read-only customer catalog: discover live kitchens near you and view a
 * kitchen's public page. Only onboarded + active chefs are visible, and only
 * their available dishes are shown.
 */
@Injectable()
export class CatalogService {
    constructor(private readonly prisma: PrismaService) {}

    async listKitchens(query: CatalogQuery, viewerId?: string): Promise<KitchenSummary[]> {
        const profiles = await this.prisma.chefProfile.findMany({
            where: { onboarded: true, active: true },
            include: { dishes: { where: { available: true } } },
        });
        const favorites = viewerId ? await this.favoriteIds(viewerId) : new Set<string>();

        let items = profiles.map((p) => toSummary(p, p.dishes, query.lat, query.lng, favorites.has(p.id)));

        if (query.q) {
            const q = query.q.toLowerCase();
            items = items.filter((k) => k.kitchenName.toLowerCase().includes(q) || k.bio.toLowerCase().includes(q));
        }
        if (query.kosher === 'true') items = items.filter((k) => k.hasKosher);
        if (query.diet) items = items.filter((k) => k.diets.includes(query.diet as Diet));
        if (query.radiusKm !== undefined) {
            items = items.filter((k) => k.distanceKm !== undefined && k.distanceKm <= query.radiusKm!);
        }

        const sort = query.sort ?? (query.lat !== undefined ? 'distance' : 'rating');
        items.sort((a, b) =>
            sort === 'distance' ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) : b.rating - a.rating,
        );
        return items;
    }

    async getKitchen(id: string, viewerId?: string): Promise<KitchenDetail> {
        const profile = await this.prisma.chefProfile.findFirst({
            where: { id, onboarded: true, active: true },
            include: MENU_INCLUDE,
        });
        if (!profile) throw new NotFoundException('Kitchen not found');
        const favorited = viewerId ? (await this.favoriteIds(viewerId)).has(id) : undefined;
        // Only surface available dishes to customers.
        const chef = toChef({ ...profile, dishes: profile.dishes.filter((d) => d.available) });
        return { ...chef, favorited };
    }

    async listFavorites(userId: string): Promise<KitchenSummary[]> {
        const favs = await this.prisma.favorite.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { chef: { include: { dishes: { where: { available: true } } } } },
        });
        return favs.map((f) => toSummary(f.chef, f.chef.dishes, undefined, undefined, true));
    }

    async setFavorite(userId: string, chefProfileId: string, favorited: boolean): Promise<{ favorited: boolean }> {
        const exists = await this.prisma.chefProfile.findUnique({ where: { id: chefProfileId }, select: { id: true } });
        if (!exists) throw new NotFoundException('Kitchen not found');
        if (favorited) {
            await this.prisma.favorite.upsert({
                where: { userId_chefProfileId: { userId, chefProfileId } },
                create: { userId, chefProfileId },
                update: {},
            });
        } else {
            await this.prisma.favorite.deleteMany({ where: { userId, chefProfileId } });
        }
        return { favorited };
    }

    private async favoriteIds(userId: string): Promise<Set<string>> {
        const rows = await this.prisma.favorite.findMany({ where: { userId }, select: { chefProfileId: true } });
        return new Set(rows.map((r) => r.chefProfileId));
    }
}

function toSummary(
    p: {
        id: string;
        kitchenName: string;
        name: string;
        bio: string;
        selfieUrl: string;
        timelineUrl: string;
        city: string;
        lat: number;
        lng: number;
    },
    dishes: PDish[],
    lat?: number,
    lng?: number,
    favorited?: boolean,
): KitchenSummary {
    const rated = dishes.filter((d) => d.ratingCount > 0);
    const ratingCount = rated.reduce((n, d) => n + d.ratingCount, 0);
    const rating = ratingCount ? rated.reduce((s, d) => s + d.rating * d.ratingCount, 0) / ratingCount : 0;
    const prices = dishes.map((d) => d.price);
    return {
        id: p.id,
        kitchenName: p.kitchenName,
        name: p.name,
        bio: p.bio,
        selfieUrl: p.selfieUrl,
        timelineUrl: p.timelineUrl,
        city: p.city,
        location: { lat: p.lat, lng: p.lng },
        distanceKm:
            lat !== undefined && lng !== undefined
                ? Math.round(distanceKm({ lat, lng }, { lat: p.lat, lng: p.lng }) * 10) / 10
                : undefined,
        rating: Math.round(rating * 10) / 10,
        ratingCount,
        dishCount: dishes.length,
        hasKosher: dishes.some((d) => d.kosher),
        diets: [...new Set(dishes.flatMap((d) => d.diets))] as Diet[],
        priceFrom: prices.length ? Math.min(...prices) : undefined,
        currency: dishes[0]?.currency ?? 'ILS',
        favorited,
    };
}

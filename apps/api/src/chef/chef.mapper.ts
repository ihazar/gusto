import { Availability as PAvailability, ChefProfile as PChefProfile, Dish as PDish, Prisma } from '@prisma/client';
import { Allergen, Chef, Diet, Meal } from '@gusto/contracts';

export type ProfileWithMenu = PChefProfile & { dishes: PDish[]; availability: PAvailability[] };

/** Include needed to map a ChefProfile row to the Chef DTO. */
export const MENU_INCLUDE = {
    dishes: { orderBy: { createdAt: 'asc' } },
    availability: true,
} satisfies Prisma.ChefProfileInclude;

export function toMeal(d: PDish): Meal {
    return {
        id: d.id,
        name: d.name,
        description: d.description,
        rating: d.rating,
        ratingCount: d.ratingCount,
        price: d.price,
        currency: d.currency,
        diets: d.diets as Diet[],
        imageUrl: d.imageUrl ?? undefined,
        available: d.available,
        category: d.category ?? undefined,
        prepMinutes: d.prepMinutes ?? undefined,
        kosher: d.kosher,
        allergens: d.allergens as Allergen[],
    };
}

export function toChef(p: ProfileWithMenu): Chef {
    return {
        id: p.id,
        name: p.name,
        kitchenName: p.kitchenName,
        bio: p.bio,
        selfieUrl: p.selfieUrl,
        timelineUrl: p.timelineUrl,
        address: {
            line1: p.addressLine1,
            line2: p.addressLine2 ?? undefined,
            city: p.city,
            region: p.region ?? undefined,
            postalCode: p.postalCode ?? undefined,
            country: p.country,
        },
        location: { lat: p.lat, lng: p.lng },
        onboarded: p.onboarded,
        verified: p.verified,
        active: p.active,
        acceptingOrders: p.acceptingOrders,
        meals: p.dishes.map(toMeal),
        availability: p.availability.map((a) => ({
            id: a.id,
            weekday: a.weekday,
            startTime: a.startTime,
            endTime: a.endTime,
            maxOrders: a.maxOrders,
        })),
    };
}

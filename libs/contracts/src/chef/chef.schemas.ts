import { z } from 'zod';
import { Diet, OrderStatus } from './chef.types';

/** A map pin. Bounds are the valid WGS-84 ranges. */
export const geoLocationSchema = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
});

export const chefAddressSchema = z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(120),
    region: z.string().max(120).optional(),
    postalCode: z.string().max(20).optional(),
    /** ISO 3166-1 alpha-2, e.g. "IL". */
    country: z
        .string()
        .length(2)
        .transform((c) => c.toUpperCase()),
});

/** Fields a chef can edit on the Settings tab. All optional → partial update. */
export const updateChefProfileSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    kitchenName: z.string().min(1).max(120).optional(),
    bio: z.string().max(1000).optional(),
    selfieUrl: z.string().url().optional(),
    timelineUrl: z.string().url().optional(),
    address: chefAddressSchema.optional(),
    location: geoLocationSchema.optional(),
});

/** Availability toggles. `verified` is intentionally not editable here. */
export const updateChefSettingsSchema = z.object({
    active: z.boolean().optional(),
    acceptingOrders: z.boolean().optional(),
});

export type UpdateChefProfileDto = z.infer<typeof updateChefProfileSchema>;
export type UpdateChefSettingsDto = z.infer<typeof updateChefSettingsSchema>;

/** A new meal a chef adds from the Meals tab. */
export const createMealSchema = z.object({
    name: z.string().min(1).max(120),
    description: z.string().min(1).max(600),
    price: z.number().positive().max(100000),
    currency: z.string().length(3).default('ILS'),
    diets: z.array(z.nativeEnum(Diet)).max(10).default([]),
    /** Image URL or a data: URL from an uploaded photo. */
    imageUrl: z.string().min(1).optional(),
    available: z.boolean().default(true),
});

/** Edit an existing meal, including suspending it (available: false). */
export const updateMealSchema = createMealSchema.partial();

/** Everything a new chef submits at the end of the onboarding wizard. */
export const onboardingSchema = z.object({
    name: z.string().min(1).max(120),
    kitchenName: z.string().min(1).max(120),
    bio: z.string().max(1000).default(''),
    selfieUrl: z.string().min(1),
    timelineUrl: z.string().min(1),
    address: chefAddressSchema,
    location: geoLocationSchema,
    /** Optional dishes the chef adds while onboarding. */
    meals: z.array(createMealSchema).max(20).default([]),
});

/** Move an order along its lifecycle. */
export const updateOrderStatusSchema = z.object({
    status: z.nativeEnum(OrderStatus),
});

export type CreateMealDto = z.infer<typeof createMealSchema>;
export type UpdateMealDto = z.infer<typeof updateMealSchema>;
export type OnboardingDto = z.infer<typeof onboardingSchema>;
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;

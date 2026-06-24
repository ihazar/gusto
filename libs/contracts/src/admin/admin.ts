import { z } from 'zod';

/** Marketplace overview for the ops dashboard. */
export interface AdminStats {
    chefs: number;
    activeChefs: number;
    pendingVerification: number;
    couriers: number;
    orders: number;
    delivered: number;
    /** Gross merchandise value: sum of delivered order totals. */
    gmv: number;
    currency: string;
}

/** A chef row in the admin chef list. */
export interface AdminChef {
    id: string;
    kitchenName: string;
    name: string;
    city: string;
    onboarded: boolean;
    active: boolean;
    verified: boolean;
    rating: number;
    ratingCount: number;
    dishCount: number;
    orderCount: number;
    createdAt: string;
}

/** A recent order in the admin order list. */
export interface AdminOrder {
    id: string;
    kitchenName: string;
    customerName: string;
    status: string;
    total: number;
    currency: string;
    placedAt: string;
}

/** A courier row in the admin courier list. */
export interface AdminCourier {
    id: string;
    displayName: string;
    vehicle: string;
    online: boolean;
    deliveredCount: number;
    earnings: number;
}

export const setVerifiedSchema = z.object({ verified: z.boolean() });
export const setActiveSchema = z.object({ active: z.boolean() });
export type SetVerifiedDto = z.infer<typeof setVerifiedSchema>;
export type SetActiveDto = z.infer<typeof setActiveSchema>;

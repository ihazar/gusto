import { Chef, Diet, GeoLocation } from '../chef/chef.types';

/** A kitchen as it appears in the customer's discovery list. */
export interface KitchenSummary {
    id: string;
    kitchenName: string;
    name: string;
    bio: string;
    selfieUrl: string;
    timelineUrl: string;
    city: string;
    location: GeoLocation;
    /** Distance from the customer in km, when a location was provided. */
    distanceKm?: number;
    /** Aggregate kitchen rating (0–5) and how many ratings back it. */
    rating: number;
    ratingCount: number;
    /** Number of available dishes. */
    dishCount: number;
    /** True if the kitchen has at least one kosher dish. */
    hasKosher: boolean;
    /** Union of diets across the kitchen's available dishes. */
    diets: Diet[];
    /** Cheapest available dish price, if any. */
    priceFrom?: number;
    currency: string;
    /** Whether the signed-in customer has favorited this kitchen. */
    favorited?: boolean;
}

/** A kitchen's full public page: the chef profile + available dishes. */
export interface KitchenDetail extends Chef {
    distanceKm?: number;
    favorited?: boolean;
    /** Aggregate customer rating (0–5) and how many ratings back it. */
    rating: number;
    ratingCount: number;
}

/**
 * A concrete, orderable delivery window: one Availability window on one
 * calendar date, with live remaining capacity. Customers pick one at checkout
 * when the kitchen takes scheduled (order-ahead) orders.
 */
export interface DeliverySlot {
    availabilityId: string;
    /** "YYYY-MM-DD" in the kitchen's local time (Asia/Jerusalem). */
    date: string;
    /** 0 = Sunday … 6 = Saturday. */
    weekday: number;
    /** "HH:mm" window bounds. */
    startTime: string;
    endTime: string;
    maxOrders: number;
    /** Orders still available in this slot (0 = full). */
    remaining: number;
}

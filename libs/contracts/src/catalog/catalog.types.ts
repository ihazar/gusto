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
}

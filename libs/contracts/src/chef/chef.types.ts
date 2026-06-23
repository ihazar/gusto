/** Diets a meal may appeal to. Used to tag meals so customers can filter. */
export enum Diet {
    VEGETARIAN = 'VEGETARIAN',
    VEGAN = 'VEGAN',
    PESCATARIAN = 'PESCATARIAN',
    PALEO = 'PALEO',
    KETO = 'KETO',
    GLUTEN_FREE = 'GLUTEN_FREE',
    DAIRY_FREE = 'DAIRY_FREE',
    NUT_FREE = 'NUT_FREE',
    HALAL = 'HALAL',
    KOSHER = 'KOSHER',
}

/** Common allergens a dish may contain, surfaced to customers. */
export enum Allergen {
    GLUTEN = 'GLUTEN',
    DAIRY = 'DAIRY',
    EGGS = 'EGGS',
    PEANUTS = 'PEANUTS',
    TREE_NUTS = 'TREE_NUTS',
    SOY = 'SOY',
    FISH = 'FISH',
    SHELLFISH = 'SHELLFISH',
    SESAME = 'SESAME',
}

/** A point on the map, used to compute how far a chef is from a customer. */
export interface GeoLocation {
    lat: number;
    lng: number;
}

/** A weekly capacity window during which a kitchen takes orders. */
export interface Availability {
    id: string;
    /** 0 = Sunday … 6 = Saturday. */
    weekday: number;
    /** "HH:mm" local time. */
    startTime: string;
    endTime: string;
    /** Max orders the chef will take in this window. */
    maxOrders: number;
}

/** Human-readable address for a chef's kitchen. */
export interface ChefAddress {
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode?: string;
    /** ISO 3166-1 alpha-2 country code, e.g. "IL". */
    country: string;
}

/** A dish a chef cooks, shown as a card on the chef's profile. */
export interface Meal {
    id: string;
    name: string;
    description: string;
    /** Average 0–5 rating from customers who have tried it. */
    rating: number;
    /** How many ratings back the average. */
    ratingCount: number;
    /** Price in the chef's currency, in major units (e.g. 42 = ₪42.00). */
    price: number;
    /** ISO 4217 currency code, e.g. "ILS". */
    currency: string;
    /** Diets this meal appeals to. */
    diets: Diet[];
    imageUrl?: string;
    /** When false, the meal is suspended and hidden from customers. */
    available: boolean;
    /** Optional menu section, e.g. "Mains", "Mezze", "Desserts". */
    category?: string;
    /** Estimated prep time in minutes. */
    prepMinutes?: number;
    /** Whether the dish is kosher. */
    kosher?: boolean;
    /** Allergens present in the dish. */
    allergens?: Allergen[];
}

/** Lifecycle of a customer order, in the sequence a chef works through it. */
export enum OrderStatus {
    NEW = 'NEW',
    IN_PREPARATION = 'IN_PREPARATION',
    ON_THE_WAY = 'ON_THE_WAY',
    DELIVERED = 'DELIVERED',
    /** Rejected by the chef, cancelled, or auto-cancelled on accept timeout. */
    CANCELLED = 'CANCELLED',
}

/** A chef's earnings summary, net of platform commission. */
export interface ChefEarnings {
    currency: string;
    /** Sum of payouts already captured (orders delivered). */
    paidOut: number;
    /** Payouts pending settlement. */
    pending: number;
    /** Number of completed (delivered) orders. */
    deliveredCount: number;
}

/** Lifecycle of the payment backing an order. */
export enum PaymentStatus {
    AUTHORIZED = 'AUTHORIZED',
    CAPTURED = 'CAPTURED',
    REFUNDED = 'REFUNDED',
    FAILED = 'FAILED',
}

/** Itemized money breakdown shown to the customer at checkout. */
export interface OrderTotals {
    subtotal: number;
    serviceFee: number;
    deliveryFee: number;
    tip: number;
    /** Israeli VAT on fees + delivery. */
    vat: number;
    total: number;
    currency: string;
}

/** A single line on an order. */
export interface OrderItem {
    mealId: string;
    name: string;
    qty: number;
    /** Unit price at time of order, in major units. */
    price: number;
}

/** A customer order placed against a chef. */
export interface Order {
    id: string;
    customerName: string;
    items: OrderItem[];
    total: number;
    currency: string;
    status: OrderStatus;
    /** ISO-8601 timestamp the order was placed. */
    placedAt: string;
    /** Where it's going. */
    deliveryAddress: string;
    /** Full money breakdown (present on orders created via checkout). */
    totals?: OrderTotals;
    /** State of the payment backing this order. */
    paymentStatus?: PaymentStatus;
    /** The kitchen this order is for (customer-facing views). */
    kitchenId?: string;
    kitchenName?: string;
}

/** A home-chef profile, as built during onboarding. */
export interface Chef {
    id: string;
    /** The chef's display name. */
    name: string;
    /** The name of the chef's kitchen / brand. */
    kitchenName: string;
    bio: string;
    /** Profile photo (the "selfie"), shown Facebook-style over the cover. */
    selfieUrl: string;
    /** Wide cover/banner image (the "timeline" photo). */
    timelineUrl: string;
    address: ChefAddress;
    /** Geocoded kitchen location, used for distance to customers. */
    location: GeoLocation;
    /** False until the chef finishes the onboarding wizard. */
    onboarded: boolean;
    /** Vetted by Gusto. Controlled by admins, not the chef. */
    verified: boolean;
    /** Whether the chef's profile is live and visible to customers. */
    active: boolean;
    /** Whether the chef is currently taking new orders. */
    acceptingOrders: boolean;
    meals: Meal[];
    /** Weekly capacity windows (optional; present once configured). */
    availability?: Availability[];
}

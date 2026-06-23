import { GeoLocation, OrderStatus } from '../chef/chef.types';

/** Lifecycle of a single delivery. */
export enum DeliveryStatus {
    /** Awaiting a courier in the job pool. */
    PENDING = 'PENDING',
    /** Claimed by a courier, heading to the kitchen. */
    ASSIGNED = 'ASSIGNED',
    /** Picked up, en route to the customer. */
    PICKED_UP = 'PICKED_UP',
    DELIVERED = 'DELIVERED',
    CANCELLED = 'CANCELLED',
}

export enum Vehicle {
    BIKE = 'bike',
    SCOOTER = 'scooter',
    CAR = 'car',
}

/** A "Gus" courier profile. */
export interface Courier {
    id: string;
    displayName: string;
    vehicle: Vehicle;
    online: boolean;
}

/** A delivery job as a courier sees it (with the order summary it carries). */
export interface DeliveryJob {
    id: string;
    orderId: string;
    status: DeliveryStatus;
    pickup: { name: string; location: GeoLocation };
    dropoff: { address: string; location: GeoLocation };
    /** Courier earnings for this delivery (delivery fee + tip). */
    fee: number;
    currency: string;
    /** Pickup → dropoff distance in km. */
    distanceKm: number;
    itemCount: number;
    orderTotal: number;
    customerName: string;
}

export interface CourierEarnings {
    currency: string;
    total: number;
    deliveredCount: number;
}

/** What a customer sees on the order-tracking screen. */
export interface OrderTracking {
    orderStatus: OrderStatus;
    delivery?: {
        status: DeliveryStatus;
        courierName?: string;
        vehicle?: Vehicle;
        pickup: GeoLocation;
        dropoff: GeoLocation;
        /** Interpolated courier position while en route. */
        courierPosition?: GeoLocation;
        /** Estimated minutes to arrival. */
        etaMinutes?: number;
        /** 0–1 progress along the route. */
        progress?: number;
    };
}

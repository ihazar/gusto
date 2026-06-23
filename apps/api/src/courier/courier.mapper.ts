import { Courier as PCourier, DeliveryJob as PDeliveryJob } from '@prisma/client';
import { Courier, DeliveryJob, DeliveryStatus, distanceKm, Vehicle } from '@gusto/contracts';

export type JobRow = PDeliveryJob & {
    order: { customerName: string; total: number; items: { qty: number }[] };
};

export function toCourier(c: PCourier): Courier {
    return { id: c.id, displayName: c.displayName, vehicle: c.vehicle as Vehicle, online: c.online };
}

export function toDeliveryJob(j: JobRow): DeliveryJob {
    const pickup = { lat: j.pickupLat, lng: j.pickupLng };
    const dropoff = { lat: j.dropoffLat, lng: j.dropoffLng };
    return {
        id: j.id,
        orderId: j.orderId,
        status: j.status as DeliveryStatus,
        pickup: { name: j.pickupName, location: pickup },
        dropoff: { address: j.dropoffAddress, location: dropoff },
        fee: j.fee,
        currency: j.currency,
        distanceKm: Math.round(distanceKm(pickup, dropoff) * 10) / 10,
        itemCount: j.order.items.reduce((n, i) => n + i.qty, 0),
        orderTotal: j.order.total,
        customerName: j.order.customerName,
    };
}

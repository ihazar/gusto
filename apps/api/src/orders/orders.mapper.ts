import { Order as POrder, OrderItem as POrderItem, Payment as PPayment, Prisma } from '@prisma/client';
import { Order, OrderStatus, PaymentStatus } from '@gusto/contracts';

export const ORDER_INCLUDE = {
    items: true,
    payment: true,
    chef: { select: { kitchenName: true } },
} satisfies Prisma.OrderInclude;

export type OrderRow = POrder & {
    items: POrderItem[];
    payment: PPayment | null;
    chef?: { kitchenName: string } | null;
};

export function toOrder(o: OrderRow): Order {
    return {
        id: o.id,
        customerName: o.customerName,
        items: o.items.map((i) => ({ mealId: i.dishId, name: i.name, qty: i.qty, price: i.unitPrice })),
        total: o.total,
        currency: o.currency,
        status: o.status as OrderStatus,
        placedAt: o.placedAt.toISOString(),
        deliveryAddress: o.deliveryAddress,
        totals: {
            subtotal: o.subtotal,
            serviceFee: o.serviceFee,
            deliveryFee: o.deliveryFee,
            tip: o.tip,
            vat: o.vat,
            total: o.total,
            currency: o.currency,
        },
        paymentStatus: (o.payment?.status as PaymentStatus) ?? undefined,
        kitchenId: o.chefProfileId,
        kitchenName: o.chef?.kitchenName ?? undefined,
    };
}

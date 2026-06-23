import { z } from 'zod';

/** A line the customer is ordering: a dish id + quantity. */
export const orderItemInputSchema = z.object({
    dishId: z.string().min(1),
    qty: z.number().int().positive().max(50),
});

/** Place an order from a single kitchen (carts are single-kitchen by design). */
export const createOrderSchema = z.object({
    kitchenId: z.string().min(1),
    items: z.array(orderItemInputSchema).min(1).max(50),
    deliveryAddress: z.string().min(1).max(300),
    /** Optional tip in major units. */
    tip: z.number().min(0).max(100000).default(0),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderDto = z.infer<typeof createOrderSchema>;

import { z } from 'zod';

/** A line the customer is ordering: a dish id + quantity. */
export const orderItemInputSchema = z.object({
    dishId: z.string().min(1),
    qty: z.number().int().positive().max(50),
});

/** The delivery slot the customer picked: an availability window + a date. */
export const orderSlotInputSchema = z.object({
    availabilityId: z.string().min(1),
    /** "YYYY-MM-DD" in the kitchen's local time. */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Place an order from a single kitchen (carts are single-kitchen by design). */
export const createOrderSchema = z.object({
    kitchenId: z.string().min(1),
    items: z.array(orderItemInputSchema).min(1).max(50),
    deliveryAddress: z.string().min(1).max(300),
    /** Optional tip in major units. */
    tip: z.number().min(0).max(100000).default(0),
    /** Required when the kitchen has ordering windows configured. */
    slot: orderSlotInputSchema.optional(),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type OrderSlotInput = z.infer<typeof orderSlotInputSchema>;
export type CreateOrderDto = z.infer<typeof createOrderSchema>;

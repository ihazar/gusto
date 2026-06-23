import { z } from 'zod';

/** A customer's review of a completed order / its chef. */
export interface Review {
    id: string;
    orderId: string;
    rating: number;
    comment: string;
    /** ISO-8601 timestamp. */
    createdAt: string;
}

/** Leave a review on a delivered order. */
export const createReviewSchema = z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).default(''),
});

export type CreateReviewDto = z.infer<typeof createReviewSchema>;

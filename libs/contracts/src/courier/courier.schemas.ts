import { z } from 'zod';
import { Vehicle } from './courier.types';

/** Update the courier profile / availability. */
export const updateCourierSchema = z.object({
    online: z.boolean().optional(),
    vehicle: z.nativeEnum(Vehicle).optional(),
    displayName: z.string().max(80).optional(),
});

export type UpdateCourierDto = z.infer<typeof updateCourierSchema>;

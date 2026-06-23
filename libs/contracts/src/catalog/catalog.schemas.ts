import { z } from 'zod';
import { Diet } from '../chef/chef.types';

/** Query params for `GET /kitchens` (coerced from strings). */
export const catalogQuerySchema = z.object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(200).optional(),
    /** Free-text search over kitchen name, bio, and dish names. */
    q: z.string().trim().max(100).optional(),
    /** "true" → only kitchens with at least one kosher dish. */
    kosher: z.enum(['true', 'false']).optional(),
    /** Only kitchens offering a dish for this diet. */
    diet: z.nativeEnum(Diet).optional(),
    sort: z.enum(['distance', 'rating']).optional(),
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

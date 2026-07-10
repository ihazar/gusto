import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CatalogQuery, catalogQuerySchema, DeliverySlot, KitchenDetail, KitchenSummary } from '@gusto/contracts';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CatalogService } from './catalog.service';

/** Public kitchen discovery. Optional auth lets us mark `favorited`. */
@Controller('kitchens')
@UseGuards(OptionalJwtAuthGuard)
export class CatalogController {
    constructor(private readonly catalog: CatalogService) {}

    @Get()
    list(
        @Query(new ZodValidationPipe(catalogQuerySchema)) query: CatalogQuery,
        @CurrentUser() user: AuthenticatedUser | null,
    ): Promise<KitchenSummary[]> {
        return this.catalog.listKitchens(query, user?.id);
    }

    @Get(':id')
    get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser | null): Promise<KitchenDetail> {
        return this.catalog.getKitchen(id, user?.id);
    }

    /** Upcoming order-ahead delivery windows (empty = ASAP-only kitchen). */
    @Get(':id/slots')
    slots(@Param('id') id: string): Promise<DeliverySlot[]> {
        return this.catalog.listSlots(id);
    }
}

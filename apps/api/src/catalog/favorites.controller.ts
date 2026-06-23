import { Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { KitchenSummary } from '@gusto/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CatalogService } from './catalog.service';

/** The signed-in customer's favorited kitchens. */
@Controller('me/favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
    constructor(private readonly catalog: CatalogService) {}

    @Get()
    list(@CurrentUser() user: AuthenticatedUser): Promise<KitchenSummary[]> {
        return this.catalog.listFavorites(user.id);
    }

    @Put(':chefId')
    add(@CurrentUser() user: AuthenticatedUser, @Param('chefId') chefId: string): Promise<{ favorited: boolean }> {
        return this.catalog.setFavorite(user.id, chefId, true);
    }

    @Delete(':chefId')
    remove(@CurrentUser() user: AuthenticatedUser, @Param('chefId') chefId: string): Promise<{ favorited: boolean }> {
        return this.catalog.setFavorite(user.id, chefId, false);
    }
}

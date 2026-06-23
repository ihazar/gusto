import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogController } from './catalog.controller';
import { FavoritesController } from './favorites.controller';
import { CatalogService } from './catalog.service';

@Module({
    imports: [AuthModule],
    controllers: [CatalogController, FavoritesController],
    providers: [CatalogService],
})
export class CatalogModule {}

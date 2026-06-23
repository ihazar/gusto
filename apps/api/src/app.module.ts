import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ChefModule } from './chef/chef.module';
import { CatalogModule } from './catalog/catalog.module';
import { MeController } from './me/me.controller';
import { HealthController } from './health/health.controller';

// Serve the built Angular SPA from the same dyno (when it has been built).
// API routes live under /api and are excluded from the static/SPA fallback.
const webDist = join(process.cwd(), '..', 'web', 'dist');
const staticImports = existsSync(join(webDist, 'index.html'))
    ? [ServeStaticModule.forRoot({ rootPath: webDist, exclude: ['/api', '/api/(.*)'] })]
    : [];

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        ...staticImports,
        PrismaModule,
        AuthModule,
        ChefModule,
        CatalogModule,
    ],
    controllers: [HealthController, MeController],
})
export class AppModule {}

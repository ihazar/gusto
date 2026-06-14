import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Behind Heroku's router: redirect http -> https so the browser always runs
  // in a secure context (crypto.randomUUID, etc.). No header locally => skipped.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const proto = req.headers['x-forwarded-proto'];
    if (proto && proto !== 'https') {
      res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
      return;
    }
    next();
  });

  app.enableCors();
  app.setGlobalPrefix('api');

  const config = app.get(ConfigService);
  const port = config.get<number>('port', 5000);

  await app.listen(port);
  Logger.log(`Gusto API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();

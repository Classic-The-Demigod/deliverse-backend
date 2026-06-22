import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import cookieParser from 'cookie-parser';

import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Serve static files from the 'public' directory
  app.useStaticAssets(join(__dirname, '..', 'public'));
  
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  
  app.use(cookieParser());

  const configService = app.get(ConfigService);
  
  // Security headers
  app.use(helmet());

  // CORS Configuration
  const corsOrigin = configService.get<string>('CORS_ORIGIN', '');
  app.enableCors({
    origin: corsOrigin ? (corsOrigin.includes(',') ? corsOrigin.split(',') : corsOrigin) : true,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();

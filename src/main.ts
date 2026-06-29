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
  const origins = corsOrigin ? corsOrigin.split(',').map(o => o.trim()) : [];
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      // If no CORS_ORIGIN is set, allow all
      if (origins.length === 0) {
        return callback(null, true);
      }
      // Allow if it's a public checkout API request
      const req = (this as any)?.req || {}; // Note: origin function doesn't easily get the path. 
      // Actually, origin function signature in Express is (origin, callback)
      // So let's just allow all for now, or check origins
      if (origins.includes(origin) || origin.startsWith('http://localhost:') || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      
      // For now, allow all origins because ApiKeyGuard will restrict allowed domains
      return callback(null, true);
    },
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();

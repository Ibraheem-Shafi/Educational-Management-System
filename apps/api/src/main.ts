import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { isAllowedCorsOrigin } from './common/utils/cors.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(compression());
  app.setGlobalPrefix('api/v1');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (
      req.headers['access-control-request-private-network'] === 'true' &&
      isAllowedCorsOrigin(origin)
    ) {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    next();
  });
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, isAllowedCorsOrigin(origin));
    },
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
  });
  app.useGlobalFilters(new GlobalExceptionFilter());

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('EIMS API')
      .setDescription('Educational Institution Management System API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();

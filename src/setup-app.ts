import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { DbExceptionFilter } from './common/filters/db-exception.filter';

/** Shared between main.ts and e2e tests so both run the exact same pipeline. */
export function setupApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // ...and reject requests that send them
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new DbExceptionFilter(app.get(HttpAdapterHost).httpAdapter));
  app.enableShutdownHooks();
}

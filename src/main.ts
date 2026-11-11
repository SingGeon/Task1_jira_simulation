import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { APP_CONFIG, AppConfig } from './config/configuration';
import { setupApp } from './setup-app';

async function bootstrap() {
  try {
    process.loadEnvFile?.('.env');
  } catch {
    /* .env is optional; real env vars take precedence anyway */
  }
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));
  setupApp(app);

  const swagger = new DocumentBuilder()
    .setTitle('Task Tracker API')
    .setDescription('Jira-like task tracker: projects, Scrum/Kanban boards, sprints, workflow & role-based access')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port);
  console.log(`Task Tracker running on http://localhost:${config.port}/api (docs: /api/docs)`);
}
bootstrap();

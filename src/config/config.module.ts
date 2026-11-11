import { Global, Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { APP_CONFIG, loadConfig } from './configuration';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  controllers: [ConfigController],
  exports: [APP_CONFIG],
})
export class ConfigModule {}

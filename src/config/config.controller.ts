import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { APP_CONFIG, AppConfig } from './configuration';

@ApiTags('config')
@Public()
@Controller('config')
export class ConfigController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get('public')
  @ApiOperation({ summary: 'Feature flags the client needs before login (no auth required)' })
  publicConfig() {
    return {
      registrationEnabled: this.config.registrationEnabled,
      teamProjectsEnabled: this.config.teamProjectsEnabled,
    };
  }
}

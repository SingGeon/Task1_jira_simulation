import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { ActivityService } from './activity.service';
import { ListActivityQueryDto } from './dto/activity.dto';

@ApiTags('activity')
@ApiBearerAuth()
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  @AdminOnly()
  @ApiOperation({ summary: '[Admin] System-wide activity log, across all projects and tasks' })
  list(@Query() q: ListActivityQueryDto) {
    return this.activity.listAll(q);
  }
}

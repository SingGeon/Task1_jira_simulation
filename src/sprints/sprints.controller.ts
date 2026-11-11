import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessControlService } from '../access/access-control.service';
import { Permission } from '../access/permission.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { SprintsService } from './sprints.service';
import { CompleteSprintDto, CreateSprintDto, ListSprintsQueryDto, StartSprintDto, UpdateSprintDto } from './dto/sprint.dto';

@ApiTags('sprints')
@ApiBearerAuth()
@Controller('projects/:projectId/sprints')
export class SprintsController {
  constructor(
    private readonly sprints: SprintsService,
    private readonly acl: AccessControlService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() q: ListSprintsQueryDto,
  ) {
    await this.acl.forProject(user, projectId);
    return this.sprints.list(projectId, q);
  }

  @Get(':sprintId')
  async get(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
  ) {
    await this.acl.forProject(user, projectId);
    return this.sprints.get(projectId, sprintId);
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateSprintDto,
  ) {
    (await this.acl.forProject(user, projectId)).assert(Permission.SPRINT_MANAGE);
    return this.sprints.create(projectId, dto);
  }

  @Patch(':sprintId')
  async update(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() dto: UpdateSprintDto,
  ) {
    (await this.acl.forProject(user, projectId)).assert(Permission.SPRINT_MANAGE);
    return this.sprints.update(projectId, sprintId, dto);
  }

  @Post(':sprintId/start')
  @HttpCode(200)
  async start(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() dto: StartSprintDto,
  ) {
    (await this.acl.forProject(user, projectId)).assert(Permission.SPRINT_MANAGE);
    return this.sprints.start(projectId, sprintId, dto);
  }

  @Post(':sprintId/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Close the active sprint; unfinished tasks move to backlog or a planned sprint' })
  async complete(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() dto: CompleteSprintDto,
  ) {
    (await this.acl.forProject(user, projectId)).assert(Permission.SPRINT_MANAGE);
    return this.sprints.complete(projectId, sprintId, dto);
  }

  @Delete(':sprintId')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
  ) {
    (await this.acl.forProject(user, projectId)).assert(Permission.SPRINT_MANAGE);
    await this.sprints.remove(projectId, sprintId);
  }
}

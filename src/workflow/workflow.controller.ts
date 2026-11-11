import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessControlService } from '../access/access-control.service';
import { Permission } from '../access/permission.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { WorkflowService } from './workflow.service';
import { CreateStatusDto, CreateTransitionDto, UpdateStatusDto } from './dto/workflow.dto';

@ApiTags('workflow')
@ApiBearerAuth()
@Controller('projects/:projectId/workflow')
export class WorkflowController {
  constructor(
    private readonly workflow: WorkflowService,
    private readonly acl: AccessControlService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Statuses (board columns) and allowed transitions' })
  async get(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string) {
    await this.acl.forProject(user, projectId);
    return this.workflow.getWorkflow(projectId);
  }

  @Post('statuses')
  async createStatus(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateStatusDto,
  ) {
    (await this.acl.forProject(user, projectId)).assert(Permission.PROJECT_UPDATE);
    return this.workflow.createStatus(projectId, dto);
  }

  @Patch('statuses/:statusId')
  async updateStatus(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('statusId', ParseUUIDPipe) statusId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    (await this.acl.forProject(user, projectId)).assert(Permission.PROJECT_UPDATE);
    return this.workflow.updateStatus(projectId, statusId, dto);
  }

  @Delete('statuses/:statusId')
  @HttpCode(204)
  async deleteStatus(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('statusId', ParseUUIDPipe) statusId: string,
  ) {
    (await this.acl.forProject(user, projectId)).assert(Permission.PROJECT_UPDATE);
    await this.workflow.deleteStatus(projectId, statusId);
  }

  @Post('transitions')
  async createTransition(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTransitionDto,
  ) {
    (await this.acl.forProject(user, projectId)).assert(Permission.PROJECT_UPDATE);
    return this.workflow.createTransition(projectId, dto);
  }

  @Delete('transitions/:transitionId')
  @HttpCode(204)
  async deleteTransition(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('transitionId', ParseUUIDPipe) transitionId: string,
  ) {
    (await this.acl.forProject(user, projectId)).assert(Permission.PROJECT_UPDATE);
    await this.workflow.deleteTransition(projectId, transitionId);
  }
}

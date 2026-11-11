import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessControlService } from '../access/access-control.service';
import { Permission } from '../access/permission.enum';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { ProjectsService } from './projects.service';
import { AddMemberDto, ChangeMemberRoleDto, CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly acl: AccessControlService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Create a project (default workflow is created automatically). Admins may create either management type; ' +
      'everyone else can only create a Team-managed project (if enabled) and becomes its PM.',
  })
  create(@CurrentUser() user: User, @Body() dto: CreateProjectDto) {
    return this.projects.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Projects visible to the current user' })
  list(@CurrentUser() user: User) {
    return this.projects.listFor(user);
  }

  @Get('directory')
  @ApiOperation({ summary: 'Every project (id/key/name/boardType only) — to pick one when requesting access' })
  directory() {
    return this.projects.listDirectory();
  }

  @Get(':projectId')
  async get(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string) {
    const access = await this.acl.forProject(user, projectId);
    const project = await this.projects.get(projectId);
    return {
      ...project,
      myRole: access.membership?.role ?? null,
      myPermissions: Object.values(Permission).filter((p) => access.can(p)),
    };
  }

  @Patch(':projectId')
  async update(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    (await this.acl.forProject(user, projectId)).assert(Permission.PROJECT_UPDATE);
    return this.projects.update(projectId, dto);
  }

  @Delete(':projectId')
  @AdminOnly()
  @HttpCode(204)
  remove(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.projects.remove(projectId);
  }

  // ----- members -----

  @Get(':projectId/members')
  async members(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string) {
    await this.acl.forProject(user, projectId);
    return this.projects.listMembers(projectId);
  }

  @Post(':projectId/members')
  async addMember(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AddMemberDto,
  ) {
    (await this.acl.forProject(user, projectId)).assert(Permission.MEMBERS_MANAGE);
    return this.projects.addMember(projectId, dto);
  }

  @Patch(':projectId/members/:userId')
  async changeRole(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ChangeMemberRoleDto,
  ) {
    (await this.acl.forProject(user, projectId)).assert(Permission.MEMBERS_MANAGE);
    return this.projects.changeRole(projectId, userId, dto);
  }

  @Delete(':projectId/members/:userId')
  @HttpCode(204)
  async removeMember(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    (await this.acl.forProject(user, projectId)).assert(Permission.MEMBERS_MANAGE);
    await this.projects.removeMember(projectId, userId);
  }
}

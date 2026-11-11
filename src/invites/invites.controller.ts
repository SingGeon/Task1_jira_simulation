import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessControlService } from '../access/access-control.service';
import { Permission } from '../access/permission.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { CreateInviteDto } from './dto/invite.dto';
import { InvitesService } from './invites.service';

@ApiTags('invites')
@ApiBearerAuth()
@Controller()
export class InvitesController {
  constructor(
    private readonly invites: InvitesService,
    private readonly acl: AccessControlService,
  ) {}

  @Post('projects/:projectId/invites')
  @ApiOperation({ summary: 'Invite an account directly, with a role; they accept or decline' })
  async create(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateInviteDto) {
    (await this.acl.forProject(user, projectId)).assert(Permission.MEMBERS_MANAGE);
    return this.invites.create(projectId, user, dto);
  }

  @Get('projects/:projectId/invites')
  @ApiOperation({ summary: 'Invites sent for this project (any status)' })
  async listForProject(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string) {
    (await this.acl.forProject(user, projectId)).assert(Permission.MEMBERS_MANAGE);
    return this.invites.listForProject(projectId);
  }

  @Get('invites/mine')
  @ApiOperation({ summary: 'Invites addressed to you' })
  mine(@CurrentUser() user: User) {
    return this.invites.listMine(user);
  }

  @Post('invites/:id/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.invites.accept(user, id);
  }

  @Post('invites/:id/decline')
  @HttpCode(200)
  decline(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.invites.decline(user, id);
  }
}

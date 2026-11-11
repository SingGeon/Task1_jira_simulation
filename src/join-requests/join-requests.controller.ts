import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { CreateJoinRequestDto } from './dto/join-request.dto';
import { JoinRequestsService } from './join-requests.service';

@ApiTags('join-requests')
@ApiBearerAuth()
@Controller('join-requests')
export class JoinRequestsController {
  constructor(private readonly joinRequests: JoinRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Request to join a project with a given role' })
  create(@CurrentUser() user: User, @Body() dto: CreateJoinRequestDto) {
    return this.joinRequests.create(user, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Your own join requests and their status' })
  mine(@CurrentUser() user: User) {
    return this.joinRequests.listMine(user);
  }

  @Get()
  @ApiOperation({ summary: "Pending requests you can decide: every project for an admin, only yours for a project manager (needs 'project.members.manage')" })
  pending(@CurrentUser() user: User) {
    return this.joinRequests.listPending(user);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: "Approve a request: adds the user to the project with the requested role (admin or project manager)" })
  approve(@CurrentUser() actor: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.joinRequests.approve(actor, id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a request (admin or project manager)' })
  reject(@CurrentUser() actor: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.joinRequests.reject(actor, id);
  }
}

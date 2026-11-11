import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
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
  @AdminOnly()
  @ApiOperation({ summary: '[Admin] Pending join requests awaiting a decision' })
  pending() {
    return this.joinRequests.listPending();
  }

  @Post(':id/approve')
  @AdminOnly()
  @ApiOperation({ summary: '[Admin] Approve a request: adds the user to the project with the requested role' })
  approve(@CurrentUser() admin: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.joinRequests.approve(admin, id);
  }

  @Post(':id/reject')
  @AdminOnly()
  @ApiOperation({ summary: '[Admin] Reject a request' })
  reject(@CurrentUser() admin: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.joinRequests.reject(admin, id);
  }
}

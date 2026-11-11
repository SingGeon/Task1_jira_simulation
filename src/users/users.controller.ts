import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { AdminUpdateUserDto, CreateUserDto, ListUsersQueryDto, UpdateMeDto } from './dto/user.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: User) {
    return user;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own name / change own password' })
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Search users (e.g. to add them to a project)' })
  list(@Query() q: ListUsersQueryDto) {
    return this.users.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findById(id);
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: '[Admin] Create a user account' })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({ summary: '[Admin] Update a user (system role, active flag, password reset)' })
  update(@CurrentUser() actor: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdateUserDto) {
    return this.users.adminUpdate(actor, id, dto);
  }
}

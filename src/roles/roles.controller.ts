import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List project roles and their grants' })
  list() {
    return this.roles.list();
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Catalogue of permissions/scopes a role can be built from' })
  permissions() {
    return this.roles.permissionCatalogue();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.findById(id);
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: '[Admin] Create a new role from permission grants' })
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @Patch(':id')
  @AdminOnly()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.remove(id);
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  GrantScope,
  Permission,
  PERMISSION_DESCRIPTIONS,
  PermissionGrant,
  TASK_SCOPED_PERMISSIONS,
} from '../access/permission.enum';
import { ProjectMember } from '../projects/project-member.entity';
import { Role } from './role.entity';
import { CreateRoleDto, PermissionGrantDto, UpdateRoleDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
    private readonly dataSource: DataSource,
  ) {}

  permissionCatalogue() {
    return {
      permissions: Object.values(Permission).map((key) => ({
        key,
        description: PERMISSION_DESCRIPTIONS[key],
        supportsConditions: TASK_SCOPED_PERMISSIONS.includes(key),
      })),
      scopes: Object.values(GrantScope),
    };
  }

  list() {
    return this.roles.find({ order: { isSystem: 'DESC', name: 'ASC' } });
  }

  async findById(id: string): Promise<Role> {
    const role = await this.roles.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async getDefaultRole(): Promise<Role> {
    const role = await this.roles.findOne({ where: { isDefault: true } });
    if (!role) throw new NotFoundException('No default role configured');
    return role;
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    await this.assertNameFree(dto.name);
    const grants = this.normalizeGrants(dto.grants);
    return this.dataSource.transaction(async (em) => {
      if (dto.isDefault) await em.update(Role, { isDefault: true }, { isDefault: false });
      return em.save(
        em.create(Role, {
          name: dto.name,
          description: dto.description ?? '',
          grants,
          isDefault: !!dto.isDefault,
          isSystem: false,
        }),
      );
    });
  }

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findById(id);
    if (dto.name !== undefined && dto.name !== role.name) {
      if (role.isSystem) throw new BadRequestException('System roles cannot be renamed');
      await this.assertNameFree(dto.name, id);
      role.name = dto.name;
    }
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.grants !== undefined) role.grants = this.normalizeGrants(dto.grants);
    if (dto.isDefault === false && role.isDefault) {
      throw new BadRequestException('Mark another role as default instead of un-setting the current one');
    }
    return this.dataSource.transaction(async (em) => {
      if (dto.isDefault && !role.isDefault) {
        await em.update(Role, { isDefault: true }, { isDefault: false });
        role.isDefault = true;
      }
      return em.save(role);
    });
  }

  async remove(id: string): Promise<void> {
    const role = await this.findById(id);
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted');
    if (role.isDefault) throw new BadRequestException('The default role cannot be deleted');
    const inUse = await this.members.count({ where: { roleId: id } });
    if (inUse > 0) {
      throw new ConflictException(`Role is assigned to ${inUse} project member(s); reassign them first`);
    }
    await this.roles.delete(id);
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const clash = await this.roles
      .createQueryBuilder('r')
      .where('LOWER(r.name) = LOWER(:name)', { name })
      .andWhere(exceptId ? 'r.id <> :exceptId' : '1=1', { exceptId })
      .getExists();
    if (clash) throw new ConflictException('A role with this name already exists');
  }

  /** Rejects conditions on permissions that are not evaluated against a task. */
  private normalizeGrants(grants: PermissionGrantDto[]): PermissionGrant[] {
    return grants.map((g) => {
      const conditional = (g.scope && g.scope !== GrantScope.ANY) || (g.statuses?.length ?? 0) > 0;
      if (conditional && !TASK_SCOPED_PERMISSIONS.includes(g.permission)) {
        throw new BadRequestException(
          `'${g.permission}' does not support scope/statuses conditions (only ${TASK_SCOPED_PERMISSIONS.join(', ')})`,
        );
      }
      const out: PermissionGrant = { permission: g.permission };
      if (g.scope && g.scope !== GrantScope.ANY) out.scope = g.scope;
      if (g.statuses?.length) out.statuses = g.statuses;
      return out;
    });
  }
}


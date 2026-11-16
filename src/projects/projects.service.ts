import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SYSTEM_ROLE_NAMES } from '../roles/system-roles';
import { Role } from '../roles/role.entity';
import { RolesService } from '../roles/roles.service';
import { Task } from '../tasks/task.entity';
import { SystemRole, User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { WorkflowService } from '../workflow/workflow.service';
import { Project } from './project.entity';
import { ProjectMember } from './project-member.entity';
import { AddMemberDto, ChangeMemberRoleDto, CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
    private readonly dataSource: DataSource,
    private readonly workflow: WorkflowService,
    private readonly roles: RolesService,
    private readonly users: UsersService,
  ) {}

  async create(dto: CreateProjectDto): Promise<Project> {
    if (await this.projects.exist({ where: { key: dto.key } })) {
      throw new ConflictException(`Project key '${dto.key}' is already used`);
    }
    if (dto.leadId) await this.assertActiveUser(dto.leadId);

    const project = await this.dataSource.transaction(async (em) => {
      const p = await em.save(
        em.create(Project, {
          key: dto.key,
          name: dto.name,
          description: dto.description ?? '',
          boardType: dto.boardType,
        }),
      );
      await this.workflow.seedDefault(em, p.id);
      if (dto.leadId) {
        const pm = await em.findOne(Role, { where: { name: SYSTEM_ROLE_NAMES.PROJECT_MANAGER } });
        if (!pm) throw new BadRequestException('Project Manager role is missing');
        await em.save(em.create(ProjectMember, { projectId: p.id, userId: dto.leadId, roleId: pm.id }));
      }
      return p;
    });
    return this.get(project.id);
  }

  /** Admins see everything; other users only projects they are members of. */
  async listFor(user: User) {
    const qb = this.projects.createQueryBuilder('p').orderBy('p.name', 'ASC');
    if (user.systemRole !== SystemRole.ADMIN) {
      qb.innerJoin(ProjectMember, 'm', 'm.project_id = p.id AND m.user_id = :uid', { uid: user.id });
    }
    return qb.getMany();
  }

  async get(id: string): Promise<Project> {
    const p = await this.projects.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const p = await this.get(id);
    Object.assign(p, dto);
    return this.projects.save(p);
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      // tasks reference statuses with RESTRICT, so delete tasks first
      await em.delete(Task, { projectId: id });
      const res = await em.delete(Project, { id });
      if (!res.affected) throw new NotFoundException('Project not found');
    });
  }

  // ----- members -----

  listMembers(projectId: string) {
    return this.members.find({
      where: { projectId },
      relations: { user: true, role: true },
      order: { createdAt: 'ASC' },
    });
  }

  async addMember(projectId: string, dto: AddMemberDto): Promise<ProjectMember> {
    await this.assertActiveUser(dto.userId);
    if (await this.members.exist({ where: { projectId, userId: dto.userId } })) {
      throw new ConflictException('User is already a member of this project');
    }
    const role = dto.roleId ? await this.roles.findById(dto.roleId) : await this.roles.getDefaultRole();
    const m = await this.members.save(this.members.create({ projectId, userId: dto.userId, roleId: role.id }));
    return this.getMember(projectId, m.userId);
  }

  async changeRole(projectId: string, userId: string, dto: ChangeMemberRoleDto): Promise<ProjectMember> {
    const m = await this.getMember(projectId, userId);
    const role = await this.roles.findById(dto.roleId);
    await this.members.update(m.id, { roleId: role.id });
    return this.getMember(projectId, userId);
  }

  /** Removing a member also unassigns their tasks in that project. */
  async removeMember(projectId: string, userId: string): Promise<void> {
    const m = await this.getMember(projectId, userId);
    await this.dataSource.transaction(async (em) => {
      await em.update(Task, { projectId, assigneeId: userId }, { assigneeId: null });
      await em.delete(ProjectMember, { id: m.id });
    });
  }

  private async getMember(projectId: string, userId: string): Promise<ProjectMember> {
    const m = await this.members.findOne({ where: { projectId, userId }, relations: { user: true, role: true } });
    if (!m) throw new NotFoundException('Member not found');
    return m;
  }

  private async assertActiveUser(userId: string) {
    const u = await this.users.findById(userId);
    if (!u.isActive) throw new BadRequestException('User is deactivated');
  }
}

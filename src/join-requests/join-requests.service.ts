import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AccessControlService } from '../access/access-control.service';
import { Permission } from '../access/permission.enum';
import { Project } from '../projects/project.entity';
import { ProjectMember } from '../projects/project-member.entity';
import { ProjectsService } from '../projects/projects.service';
import { RolesService } from '../roles/roles.service';
import { User } from '../users/user.entity';
import { CreateJoinRequestDto } from './dto/join-request.dto';
import { JoinRequest, JoinRequestStatus } from './join-request.entity';

const RELATIONS = { project: true, user: true, role: true, decidedBy: true };

@Injectable()
export class JoinRequestsService {
  constructor(
    @InjectRepository(JoinRequest) private readonly requests: Repository<JoinRequest>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
    private readonly roles: RolesService,
    private readonly projectsService: ProjectsService,
    private readonly acl: AccessControlService,
  ) {}

  async create(user: User, dto: CreateJoinRequestDto): Promise<JoinRequest> {
    if (!(await this.projects.exist({ where: { id: dto.projectId } }))) {
      throw new NotFoundException('Project not found');
    }
    await this.roles.findById(dto.roleId); // throws if missing

    // Already a member: this becomes a role-change request instead of a join request.
    const membership = await this.members.findOne({ where: { projectId: dto.projectId, userId: user.id } });
    if (membership && membership.roleId === dto.roleId) {
      throw new ConflictException('You already have this role in the project');
    }
    if (
      await this.requests.exist({
        where: { projectId: dto.projectId, userId: user.id, status: JoinRequestStatus.PENDING },
      })
    ) {
      throw new ConflictException('You already have a pending request for this project');
    }

    const saved = await this.requests.save(
      this.requests.create({
        projectId: dto.projectId,
        userId: user.id,
        roleId: dto.roleId,
        message: dto.message ?? '',
      }),
    );
    return this.reload(saved.id);
  }

  listMine(user: User): Promise<JoinRequest[]> {
    return this.requests.find({ where: { userId: user.id }, relations: RELATIONS, order: { createdAt: 'DESC' } });
  }

  /** Admins see every pending request; a project manager only sees the ones for projects they manage. */
  async listPending(user: User): Promise<JoinRequest[]> {
    const projectIds = await this.acl.projectIdsWithPermission(user, Permission.MEMBERS_MANAGE);
    if (projectIds !== null && projectIds.length === 0) return [];
    return this.requests.find({
      where: { status: JoinRequestStatus.PENDING, ...(projectIds ? { projectId: In(projectIds) } : {}) },
      relations: RELATIONS,
      order: { createdAt: 'ASC' },
    });
  }

  async approve(actor: User, id: string): Promise<JoinRequest> {
    const req = await this.getPending(actor, id);
    const isMember = await this.members.exist({ where: { projectId: req.projectId, userId: req.userId } });
    if (isMember) {
      await this.projectsService.changeRole(req.projectId, req.userId, { roleId: req.roleId });
    } else {
      await this.projectsService.addMember(req.projectId, { userId: req.userId, roleId: req.roleId });
    }
    await this.requests.update(req.id, {
      status: JoinRequestStatus.APPROVED,
      decidedById: actor.id,
      decidedAt: new Date(),
    });
    return this.reload(req.id);
  }

  async reject(actor: User, id: string): Promise<JoinRequest> {
    const req = await this.getPending(actor, id);
    await this.requests.update(req.id, {
      status: JoinRequestStatus.REJECTED,
      decidedById: actor.id,
      decidedAt: new Date(),
    });
    return this.reload(req.id);
  }

  /** Loads a pending request and requires `project.members.manage` on its project (admin or PM). */
  private async getPending(actor: User, id: string): Promise<JoinRequest> {
    const req = await this.requests.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== JoinRequestStatus.PENDING) throw new BadRequestException('Request was already decided');
    const access = await this.acl.forProject(actor, req.projectId);
    access.assert(Permission.MEMBERS_MANAGE);
    return req;
  }

  private reload(id: string): Promise<JoinRequest> {
    return this.requests.findOneOrFail({ where: { id }, relations: RELATIONS });
  }
}
